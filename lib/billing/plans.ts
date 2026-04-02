import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type {
  AccessTier,
  BillingInterval,
  EffectiveEntitlements,
  PlanSnapshot,
  PlanSlug,
} from "@/lib/billing/types";

const MEGABYTE = 1024 * 1024;

const guestModelIds = [
  DEFAULT_CHAT_MODEL,
  "mistral/mistral-small",
  "deepseek/deepseek-v3.2",
] as const;

const freeModelIds = [
  ...guestModelIds,
  "openai/gpt-oss-20b",
] as const;

const proModelIds = [
  ...freeModelIds,
  "mistral/codestral",
  "moonshotai/kimi-k2.5",
  "openai/gpt-oss-120b",
] as const;

const maxModelIds = chatModels.map((model) => model.id);

type TierDefinition = Omit<EffectiveEntitlements, "tier">;

const tierDefinitions: Record<AccessTier, TierDefinition> = {
  guest: {
    allowedModelIds: [...guestModelIds],
    attachmentLimits: {
      maxDocumentSizeBytes: 10 * MEGABYTE,
      maxFilesPerChat: 2,
      maxImageSizeBytes: 3 * MEGABYTE,
    },
    defaultModelId: DEFAULT_CHAT_MODEL,
    features: {
      integrations: 0,
      projects: false,
      videoGeneration: false,
    },
    includedCredits: null,
    maxMessagesPerHour: 10,
  },
  free: {
    allowedModelIds: [...freeModelIds],
    attachmentLimits: {
      maxDocumentSizeBytes: 15 * MEGABYTE,
      maxFilesPerChat: 4,
      maxImageSizeBytes: 5 * MEGABYTE,
    },
    defaultModelId: DEFAULT_CHAT_MODEL,
    features: {
      integrations: 0,
      projects: false,
      videoGeneration: false,
    },
    includedCredits: 100,
    maxMessagesPerHour: 30,
  },
  pro: {
    allowedModelIds: [...proModelIds],
    attachmentLimits: {
      maxDocumentSizeBytes: 25 * MEGABYTE,
      maxFilesPerChat: 8,
      maxImageSizeBytes: 10 * MEGABYTE,
    },
    defaultModelId: "moonshotai/kimi-k2.5",
    features: {
      integrations: 3,
      projects: true,
      videoGeneration: false,
    },
    includedCredits: 1_500,
    maxMessagesPerHour: 120,
  },
  max: {
    allowedModelIds: [...maxModelIds],
    attachmentLimits: {
      maxDocumentSizeBytes: 40 * MEGABYTE,
      maxFilesPerChat: 12,
      maxImageSizeBytes: 20 * MEGABYTE,
    },
    defaultModelId: "xai/grok-4.1-fast-non-reasoning",
    features: {
      integrations: 10,
      projects: true,
      videoGeneration: true,
    },
    includedCredits: 5_000,
    maxMessagesPerHour: 300,
  },
};

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
    description: "Higher-quality models and more workspace headroom.",
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
    description: "Full access to flagship models and the biggest limits.",
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

export function getEntitlementsForTier(tier: AccessTier): EffectiveEntitlements {
  const definition = tierDefinitions[tier];

  return {
    ...definition,
    tier,
  };
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
