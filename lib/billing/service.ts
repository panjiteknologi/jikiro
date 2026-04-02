import "server-only";

import { addMonths, addYears, formatISO } from "date-fns";
import type { UserType } from "@/app/(auth)/auth";
import {
  FREE_MODEL_IDS,
  type GatewayModelWithCapabilities,
  getAllGatewayModels,
  isBlockedModelId,
} from "@/lib/ai/models";
import {
  convertMicrosToCredits,
  estimateCreditsFromEmbeddingUsage,
  estimateCreditsFromLanguageUsage,
} from "@/lib/billing/credits";
import {
  getDisplayPlans,
  getPlanSnapshot,
  getSelectionLimitForTier,
  isPaidPlan,
  resolveEntitlementsForTier,
} from "@/lib/billing/plans";
import type {
  EffectiveEntitlements,
  PlanSlug,
  UsageKind,
} from "@/lib/billing/types";
import {
  createAiGenerationUsage,
  createCreditLedgerEntry,
  getRecentBillingCheckoutsByUserId,
  getSubscriptionByUserId,
  getUserCreditBalance,
  resetAndGrantCreditsForCycle,
  saveSubscription,
} from "@/lib/db/billing-queries";
import { getUserById, updateUserSelectedModelIds } from "@/lib/db/queries";
import type { Subscription } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";

type ResolvedBillingState = {
  entitlements: EffectiveEntitlements;
  remainingCredits: number | null;
  subscription: Subscription | null;
};

export type ModelSettingsData = {
  catalogSource: "gateway";
  eligibleModels: GatewayModelWithCapabilities[];
  freeModelIds: string[];
  selectedModelIds: string[];
  selectionLimit: number | null;
  tier: Exclude<EffectiveEntitlements["tier"], "guest">;
};

function addBillingInterval(start: Date, interval: "monthly" | "yearly") {
  return interval === "yearly" ? addYears(start, 1) : addMonths(start, 1);
}

function createCycleGrantExternalId({
  currentPeriodStart,
  planSlug,
  userId,
}: {
  currentPeriodStart: Date;
  planSlug: PlanSlug;
  userId: string;
}) {
  return `grant:${userId}:${planSlug}:${formatISO(currentPeriodStart)}`;
}

async function ensureRegularSubscription(userId: string) {
  const now = new Date();
  const existing = await getSubscriptionByUserId({ userId });

  if (!existing) {
    return saveSubscription({
      currentPeriodEnd: addBillingInterval(now, "monthly"),
      currentPeriodStart: now,
      interval: "monthly",
      planSlug: "free",
      planSnapshot: getPlanSnapshot("free", "monthly"),
      status: "active",
      userId,
    });
  }

  if (existing.currentPeriodEnd > now && existing.status === "active") {
    return existing;
  }

  if (existing.planSlug === "free") {
    return saveSubscription({
      currentPeriodEnd: addBillingInterval(now, "monthly"),
      currentPeriodStart: now,
      interval: "monthly",
      lastCheckoutId: existing.lastCheckoutId,
      planSlug: "free",
      planSnapshot: getPlanSnapshot("free", "monthly"),
      status: "active",
      subscriptionId: existing.id,
      userId,
    });
  }

  return saveSubscription({
    currentPeriodEnd: addBillingInterval(now, "monthly"),
    currentPeriodStart: now,
    interval: "monthly",
    lastCheckoutId: existing.lastCheckoutId,
    planSlug: "free",
    planSnapshot: getPlanSnapshot("free", "monthly"),
    status: "active",
    subscriptionId: existing.id,
    userId,
  });
}

async function ensureCreditsForCurrentCycle({
  subscription,
  userId,
}: {
  subscription: NonNullable<
    Awaited<ReturnType<typeof getSubscriptionByUserId>>
  >;
  userId: string;
}) {
  const includedCredits = subscription.planSnapshot.includedCredits;

  if (includedCredits <= 0) {
    return;
  }

  await resetAndGrantCreditsForCycle({
    amount: includedCredits,
    checkoutId: subscription.lastCheckoutId,
    grantExternalId: createCycleGrantExternalId({
      currentPeriodStart: subscription.currentPeriodStart,
      planSlug: subscription.planSlug,
      userId,
    }),
    note: `${subscription.planSnapshot.name} cycle credits`,
    subscriptionId: subscription.id,
    userId,
  });
}

export async function resolveBillingState({
  userId,
  userType,
}: {
  userId: string;
  userType: UserType;
}): Promise<ResolvedBillingState> {
  if (userType === "guest") {
    return {
      entitlements: await resolveEntitlementsForTier({ tier: "guest" }),
      remainingCredits: null,
      subscription: null,
    };
  }

  const activeSubscription = await ensureRegularSubscription(userId);

  if (!activeSubscription) {
    return {
      entitlements: await resolveEntitlementsForTier({ tier: "free" }),
      remainingCredits: 0,
      subscription: null,
    };
  }

  const [userRecord] = await Promise.all([
    getUserById({ userId }),
    ensureCreditsForCurrentCycle({
      subscription: activeSubscription,
      userId,
    }),
  ]);
  const remainingCredits = await getUserCreditBalance({ userId });

  return {
    entitlements: await resolveEntitlementsForTier({
      selectedModelIds: userRecord?.selectedModelIds ?? null,
      tier: activeSubscription.planSlug,
    }),
    remainingCredits,
    subscription: activeSubscription,
  };
}

export async function getBillingPageData({
  userId,
  userType,
}: {
  userId: string;
  userType: UserType;
}) {
  const billingState = await resolveBillingState({ userId, userType });
  const recentCheckouts =
    userType === "guest"
      ? []
      : await getRecentBillingCheckoutsByUserId({
          limit: 10,
          userId,
        });

  return {
    currentPlan: billingState.subscription?.planSnapshot ?? null,
    displayPlans: getDisplayPlans(),
    entitlements: billingState.entitlements,
    recentCheckouts,
    remainingCredits: billingState.remainingCredits,
    subscription: billingState.subscription,
  };
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function getEligibleModelsForTier({
  catalog,
  tier,
}: {
  catalog: GatewayModelWithCapabilities[];
  tier: EffectiveEntitlements["tier"];
}) {
  if (tier === "free") {
    return catalog.filter((model) =>
      FREE_MODEL_IDS.includes(model.id as (typeof FREE_MODEL_IDS)[number])
    );
  }

  if (tier === "pro" || tier === "max") {
    return catalog;
  }

  return [];
}

export async function getModelSettingsData({
  userId,
  userType,
}: {
  userId: string;
  userType: UserType;
}): Promise<ModelSettingsData> {
  if (userType === "guest") {
    throw new ChatbotError("forbidden:billing");
  }

  const [billingState, catalog] = await Promise.all([
    resolveBillingState({ userId, userType }),
    getAllGatewayModels(),
  ]);
  const tier = billingState.entitlements.tier as ModelSettingsData["tier"];
  const eligibleModels = getEligibleModelsForTier({
    catalog,
    tier,
  });

  return {
    catalogSource: "gateway",
    eligibleModels,
    freeModelIds: eligibleModels
      .map((model) => model.id)
      .filter((modelId) =>
        FREE_MODEL_IDS.includes(modelId as (typeof FREE_MODEL_IDS)[number])
      ),
    selectedModelIds: billingState.entitlements.allowedModelIds,
    selectionLimit: billingState.entitlements.selectionLimit,
    tier,
  };
}

export async function updateModelSettingsSelection({
  selectedModelIds,
  userId,
  userType,
}: {
  selectedModelIds: string[];
  userId: string;
  userType: UserType;
}) {
  if (userType === "guest") {
    throw new ChatbotError("forbidden:billing");
  }

  const billingState = await resolveBillingState({ userId, userType });
  const tier = billingState.entitlements.tier;

  if (tier !== "pro" && tier !== "max") {
    throw new ChatbotError("forbidden:billing");
  }

  const catalog = await getAllGatewayModels();
  const eligibleModels = getEligibleModelsForTier({ catalog, tier });
  const eligibleModelIds = eligibleModels.map((model) => model.id);
  const requestedModelIds = Array.from(new Set(selectedModelIds.map(String)));
  const selectionLimit = getSelectionLimitForTier(tier);

  if (requestedModelIds.length === 0) {
    throw new ChatbotError("bad_request:billing", "Select at least one model.");
  }

  if (requestedModelIds.some((modelId) => isBlockedModelId(modelId))) {
    throw new ChatbotError(
      "bad_request:billing",
      "Blocked models cannot be selected."
    );
  }

  if (
    requestedModelIds.some((modelId) => !eligibleModelIds.includes(modelId))
  ) {
    throw new ChatbotError(
      "bad_request:billing",
      "One or more selected models are unavailable for your plan."
    );
  }

  if (
    typeof selectionLimit === "number" &&
    requestedModelIds.length > selectionLimit
  ) {
    throw new ChatbotError(
      "bad_request:billing",
      `You can select up to ${selectionLimit} models on this plan.`
    );
  }

  const orderedSelectedModelIds = eligibleModelIds.filter((modelId) =>
    requestedModelIds.includes(modelId)
  );
  const defaultEntitlements = await resolveEntitlementsForTier({ tier });
  const selectedModelIdsToStore = arraysEqual(
    orderedSelectedModelIds,
    defaultEntitlements.allowedModelIds
  )
    ? null
    : orderedSelectedModelIds;

  await updateUserSelectedModelIds({
    selectedModelIds: selectedModelIdsToStore,
    userId,
  });

  return getModelSettingsData({ userId, userType });
}

export async function activateSubscriptionFromCheckout({
  checkoutId,
  interval,
  planSlug,
  userId,
}: {
  checkoutId: string;
  interval: "monthly" | "yearly";
  planSlug: PlanSlug;
  userId: string;
}) {
  const existing = await getSubscriptionByUserId({ userId });
  const now = new Date();
  const currentPeriodStart =
    existing &&
    existing.planSlug === planSlug &&
    existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const currentPeriodEnd = addBillingInterval(currentPeriodStart, interval);
  const nextSnapshot = getPlanSnapshot(planSlug, interval);

  const saved = await saveSubscription({
    currentPeriodEnd,
    currentPeriodStart,
    interval,
    lastCheckoutId: checkoutId,
    planSlug,
    planSnapshot: nextSnapshot,
    status: "active",
    subscriptionId: existing?.id,
    userId,
  });

  if (!saved) {
    return null;
  }

  await ensureCreditsForCurrentCycle({
    subscription: saved,
    userId,
  });

  return saved;
}

export async function recordAiUsage({
  billingState,
  cachedInputTokens,
  chatId,
  completionTokens,
  costMicrosUsd,
  generationId,
  modelId,
  promptTokens,
  providerMetadata,
  providerName,
  reasoningTokens,
  responseBody,
  totalTokens,
  usageKind,
  userId,
  userType,
}: {
  billingState?: ResolvedBillingState | null;
  cachedInputTokens?: number;
  chatId?: string | null;
  completionTokens?: number;
  costMicrosUsd?: number | null;
  generationId?: string | null;
  modelId: string;
  promptTokens?: number;
  providerMetadata?: unknown;
  providerName?: string | null;
  reasoningTokens?: number;
  responseBody?: unknown;
  totalTokens?: number;
  usageKind: UsageKind;
  userId: string;
  userType: UserType;
}) {
  const resolvedState =
    typeof billingState === "undefined"
      ? await resolveBillingState({ userId, userType })
      : billingState;

  const creditCost =
    userType === "guest"
      ? 0
      : typeof costMicrosUsd === "number"
        ? convertMicrosToCredits(costMicrosUsd)
        : usageKind === "chat_generation"
          ? estimateCreditsFromLanguageUsage({
              cachedInputTokens,
              inputTokens: promptTokens,
              outputTokens: completionTokens,
              reasoningTokens,
              totalTokens,
            })
          : estimateCreditsFromEmbeddingUsage({
              tokens: totalTokens ?? promptTokens ?? 0,
            });

  const usage = await createAiGenerationUsage({
    cachedInputTokens,
    chatId,
    checkoutId: resolvedState?.subscription?.lastCheckoutId ?? null,
    completionTokens,
    costMicrosUsd,
    creditCost,
    generationId,
    modelId,
    promptTokens,
    providerMetadata,
    providerName,
    reasoningTokens,
    responseBody,
    subscriptionId: resolvedState?.subscription?.id ?? null,
    totalTokens,
    usageKind,
    userId,
  });

  if (userType !== "guest" && usage && creditCost > 0) {
    await createCreditLedgerEntry({
      aiUsageId: usage.id,
      amount: -creditCost,
      balanceNote: `${usageKind.replaceAll("_", " ")} debit`,
      checkoutId: resolvedState?.subscription?.lastCheckoutId ?? null,
      kind: "usage",
      metadata: {
        generationId,
        modelId,
        usageKind,
      },
      subscriptionId: resolvedState?.subscription?.id ?? null,
      userId,
    });
  }

  return usage;
}

export function getAccessTierFromUserType(userType: UserType) {
  return userType === "guest" ? "guest" : "free";
}

export function getIsPaidSubscriptionActive(
  state: Pick<ResolvedBillingState, "subscription">
) {
  return Boolean(state.subscription && isPaidPlan(state.subscription.planSlug));
}

export type { ResolvedBillingState };
