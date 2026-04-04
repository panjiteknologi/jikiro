import {
  DEFAULT_CHAT_MODEL,
  FREE_MODEL_IDS,
  GUEST_MODEL_IDS,
  getActiveModels,
  getAllGatewayModels,
  getFreeModels,
} from "@/lib/ai/models";
import type {
  AccessTier,
  BillingInterval,
  EffectiveEntitlements,
  PlanSlug,
  PlanSnapshot,
} from "@/lib/billing/types";

const MEGABYTE = 1024 * 1024;

export const PRO_SELECTION_LIMIT = 10;

const guestModelIds = Array.from(new Set(GUEST_MODEL_IDS));
const freeModelIds = Array.from(new Set(FREE_MODEL_IDS));
const fallbackCatalogModelIds = getActiveModels().map((model) => model.id);
const guestModelIdSet = new Set<string>(guestModelIds);
const freeModelIdSet = new Set<string>(freeModelIds);

function uniqueModelIds(modelIds: Iterable<string>) {
  return Array.from(new Set(modelIds));
}

function getSyncEligibleModelIds(tier: AccessTier) {
  switch (tier) {
    case "guest":
      return guestModelIds;
    case "free":
      return freeModelIds;
    case "pro":
    case "max":
      return uniqueModelIds([...freeModelIds, ...fallbackCatalogModelIds]);
    default:
      return freeModelIds;
  }
}

function getDefaultAllowedModelIdsForTier({
  eligibleModelIds,
  tier,
}: {
  eligibleModelIds: string[];
  tier: AccessTier;
}) {
  switch (tier) {
    case "guest":
      return eligibleModelIds.filter((modelId) => guestModelIdSet.has(modelId));
    case "free":
      return eligibleModelIds.filter((modelId) => freeModelIdSet.has(modelId));
    case "pro":
      return eligibleModelIds.slice(0, PRO_SELECTION_LIMIT);
    case "max":
      return eligibleModelIds;
    default:
      return eligibleModelIds;
  }
}

export function getSelectionLimitForTier(tier: AccessTier) {
  switch (tier) {
    case "pro":
      return PRO_SELECTION_LIMIT;
    case "max":
      return null;
    default:
      return null;
  }
}

type TierDefinition = Omit<
  EffectiveEntitlements,
  "allowedModelIds" | "defaultModelId" | "tier"
>;

const tierDefinitions: Record<AccessTier, TierDefinition> = {
  guest: {
    attachmentLimits: {
      maxDocumentSizeBytes: 10 * MEGABYTE,
      maxFilesPerChat: 2,
      maxImageSizeBytes: 3 * MEGABYTE,
    },
    catalogSource: "gateway",
    features: {
      integrations: 0,
      projects: false,
      videoGeneration: false,
    },
    includedCredits: null,
    maxMessagesPerHour: 10,
    selectionLimit: null,
  },
  free: {
    attachmentLimits: {
      maxDocumentSizeBytes: 15 * MEGABYTE,
      maxFilesPerChat: 4,
      maxImageSizeBytes: 5 * MEGABYTE,
    },
    catalogSource: "gateway",
    features: {
      integrations: 0,
      projects: false,
      videoGeneration: false,
    },
    includedCredits: 100,
    maxMessagesPerHour: 30,
    selectionLimit: null,
  },
  pro: {
    attachmentLimits: {
      maxDocumentSizeBytes: 25 * MEGABYTE,
      maxFilesPerChat: 8,
      maxImageSizeBytes: 10 * MEGABYTE,
    },
    catalogSource: "gateway",
    features: {
      integrations: 3,
      projects: true,
      videoGeneration: false,
    },
    includedCredits: 1500,
    maxMessagesPerHour: 120,
    selectionLimit: PRO_SELECTION_LIMIT,
  },
  max: {
    attachmentLimits: {
      maxDocumentSizeBytes: 40 * MEGABYTE,
      maxFilesPerChat: 12,
      maxImageSizeBytes: 20 * MEGABYTE,
    },
    catalogSource: "gateway",
    features: {
      integrations: 10,
      projects: true,
      videoGeneration: true,
    },
    includedCredits: 5000,
    maxMessagesPerHour: 300,
    selectionLimit: null,
  },
};

function buildEntitlements({
  allowedModelIds,
  tier,
}: {
  allowedModelIds: string[];
  tier: AccessTier;
}): EffectiveEntitlements {
  const definition = tierDefinitions[tier];
  const resolvedModelIds = uniqueModelIds(allowedModelIds);
  const defaultModelId = getFallbackModelId(resolvedModelIds);

  return {
    ...definition,
    allowedModelIds: resolvedModelIds,
    defaultModelId,
    tier,
  };
}

type PaidPlanOffer = {
  interval: BillingInterval;
  priceIdr: number;
};

type PlanDefinition = {
  description: string;
  name: string;
  offers: Record<BillingInterval, PaidPlanOffer>;
};

const freePlanOffers: Record<BillingInterval, PaidPlanOffer> = {
  monthly: {
    interval: "monthly",
    priceIdr: 0,
  },
  yearly: {
    interval: "yearly",
    priceIdr: 0,
  },
};

const planDefinitions: Record<PlanSlug, PlanDefinition> = {
  free: {
    description: "Starter tier for registered users.",
    name: "Free",
    offers: freePlanOffers,
  },
  pro: {
    description: "Choose your own working set of stronger models.",
    name: "Pro",
    offers: {
      monthly: {
        interval: "monthly",
        priceIdr: 149_000,
      },
      yearly: {
        interval: "yearly",
        priceIdr: 1_490_000,
      },
    },
  },
  max: {
    description: "Pick from the full eligible catalog with the biggest limits.",
    name: "Max",
    offers: {
      monthly: {
        interval: "monthly",
        priceIdr: 399_000,
      },
      yearly: {
        interval: "yearly",
        priceIdr: 3_990_000,
      },
    },
  },
};

export const paidPlanSlugs: PlanSlug[] = ["pro", "max"];

export function getEntitlementsForTier(
  tier: AccessTier
): EffectiveEntitlements {
  const eligibleModelIds = getSyncEligibleModelIds(tier);

  return buildEntitlements({
    allowedModelIds: getDefaultAllowedModelIdsForTier({
      eligibleModelIds,
      tier,
    }),
    tier,
  });
}

export async function resolveEntitlementsForTier({
  selectedModelIds,
  tier,
}: {
  selectedModelIds?: string[] | null;
  tier: AccessTier;
}): Promise<EffectiveEntitlements> {
  const freeModels = await getFreeModels();
  const freeModelIds = freeModels.map((model) => model.id);

  const catalogModelIds =
    tier === "pro" || tier === "max"
      ? (await getAllGatewayModels()).map((model) => model.id)
      : freeModelIds;

  const eligibleModelIds =
    tier === "guest"
      ? freeModelIds.filter((modelId) => guestModelIdSet.has(modelId))
      : tier === "free"
        ? freeModelIds
        : catalogModelIds;

  const selectionLimit = getSelectionLimitForTier(tier);
  const sanitizedSelectedModelIds =
    tier === "pro" || tier === "max"
      ? uniqueModelIds(selectedModelIds ?? []).filter((modelId) =>
          eligibleModelIds.includes(modelId)
        )
      : [];
  const limitedSelectedModelIds =
    typeof selectionLimit === "number"
      ? sanitizedSelectedModelIds.slice(0, selectionLimit)
      : sanitizedSelectedModelIds;
  const allowedModelIds =
    limitedSelectedModelIds.length > 0
      ? limitedSelectedModelIds
      : getDefaultAllowedModelIdsForTier({
          eligibleModelIds,
          tier,
        });

  return buildEntitlements({
    allowedModelIds,
    tier,
  });
}

export function getPlanDefinition(planSlug: PlanSlug) {
  return planDefinitions[planSlug];
}

export function getPlanOffer(planSlug: PlanSlug, interval: BillingInterval) {
  return planDefinitions[planSlug].offers[interval];
}

export function getPlanSnapshot(
  planSlug: PlanSlug,
  interval: BillingInterval
): PlanSnapshot {
  const entitlements = getEntitlementsForTier(planSlug);
  const plan = getPlanDefinition(planSlug);
  const offer = getPlanOffer(planSlug, interval);

  return {
    allowedModelIds: entitlements.allowedModelIds,
    attachmentLimits: entitlements.attachmentLimits,
    defaultModelId: entitlements.defaultModelId,
    features: entitlements.features,
    includedCredits: entitlements.includedCredits ?? 0,
    interval,
    name: plan.name,
    planSlug,
    priceIdr: offer.priceIdr,
  };
}

export function getDisplayPlans() {
  return (Object.keys(planDefinitions) as PlanSlug[]).map((planSlug) => ({
    ...planDefinitions[planSlug],
    entitlements: getEntitlementsForTier(planSlug),
    planSlug,
  }));
}

export function getFallbackModelId(allowedModelIds: string[]) {
  return (
    allowedModelIds.find((modelId) => modelId === DEFAULT_CHAT_MODEL) ??
    allowedModelIds[0] ??
    DEFAULT_CHAT_MODEL
  );
}

export function isPaidPlan(planSlug: PlanSlug) {
  return paidPlanSlugs.includes(planSlug);
}
