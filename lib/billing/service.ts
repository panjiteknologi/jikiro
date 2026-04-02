import "server-only";

import { addMonths, addYears, formatISO } from "date-fns";
import type { UserType } from "@/app/(auth)/auth";
import {
  convertMicrosToCredits,
  estimateCreditsFromEmbeddingUsage,
  estimateCreditsFromLanguageUsage,
} from "@/lib/billing/credits";
import {
  getDisplayPlans,
  getEntitlementsForTier,
  getPlanSnapshot,
  isPaidPlan,
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
import type { Subscription } from "@/lib/db/schema";

type ResolvedBillingState = {
  entitlements: EffectiveEntitlements;
  remainingCredits: number | null;
  subscription: Subscription | null;
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
  subscription: NonNullable<Awaited<ReturnType<typeof getSubscriptionByUserId>>>;
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
      entitlements: getEntitlementsForTier("guest"),
      remainingCredits: null,
      subscription: null,
    };
  }

  const activeSubscription = await ensureRegularSubscription(userId);

  if (!activeSubscription) {
    return {
      entitlements: getEntitlementsForTier("free"),
      remainingCredits: 0,
      subscription: null,
    };
  }

  await ensureCreditsForCurrentCycle({
    subscription: activeSubscription,
    userId,
  });

  const remainingCredits = await getUserCreditBalance({ userId });

  return {
    entitlements: getEntitlementsForTier(activeSubscription.planSlug),
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
    existing && existing.planSlug === planSlug && existing.currentPeriodEnd > now
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
