export const planSlugs = ["free", "pro", "max"] as const;
export type PlanSlug = (typeof planSlugs)[number];

export const billingIntervals = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export const accessTiers = ["guest", ...planSlugs] as const;
export type AccessTier = (typeof accessTiers)[number];

export const subscriptionStatuses = [
  "active",
  "pending",
  "expired",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const checkoutStatuses = [
  "pending",
  "paid",
  "failed",
  "expired",
] as const;
export type CheckoutStatus = (typeof checkoutStatuses)[number];

export const creditLedgerEntryKinds = [
  "grant",
  "usage",
  "reset",
  "adjustment",
] as const;
export type CreditLedgerEntryKind = (typeof creditLedgerEntryKinds)[number];

export const usageKinds = [
  "chat_generation",
  "retrieval_embedding",
  "attachment_embedding",
] as const;
export type UsageKind = (typeof usageKinds)[number];

export type PlanFeatureFlags = {
  integrations: number;
  projects: boolean;
  videoGeneration: boolean;
};

export type AttachmentEntitlements = {
  maxDocumentSizeBytes: number;
  maxFilesPerChat: number;
  maxImageSizeBytes: number;
};

export type EffectiveEntitlements = {
  allowedModelIds: string[];
  attachmentLimits: AttachmentEntitlements;
  defaultModelId: string;
  features: PlanFeatureFlags;
  includedCredits: number | null;
  maxMessagesPerHour: number;
  tier: AccessTier;
};

export type PlanSnapshot = {
  allowedModelIds: string[];
  attachmentLimits: AttachmentEntitlements;
  defaultModelId: string;
  features: PlanFeatureFlags;
  includedCredits: number;
  interval: BillingInterval;
  name: string;
  planSlug: PlanSlug;
  priceIdr: number;
};
