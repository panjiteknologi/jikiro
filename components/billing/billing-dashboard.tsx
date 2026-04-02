"use client";

import { createTripayCheckout } from "@/app/billing/actions";
import Pricing, {
  type Plans,
  type PricingBillingPeriod,
} from "@/components/billing/pricing";
import type { TripayChannel } from "@/lib/billing/tripay";
import type {
  BillingInterval,
  EffectiveEntitlements,
  PlanSlug,
  PlanSnapshot,
} from "@/lib/billing/types";
import type { BillingCheckout, Subscription } from "@/lib/db/schema";
import { Crown, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { startTransition, useState } from "react";
import { toast } from "sonner";

type DisplayPlan = {
  description: string;
  entitlements: EffectiveEntitlements;
  name: string;
  offers: Record<
    BillingInterval,
    {
      interval: BillingInterval;
      priceIdr: number;
    }
  >;
  planSlug: PlanSlug;
};

type BillingDashboardProps = {
  channels: TripayChannel[];
  currentPlan: PlanSnapshot | null;
  displayPlans: DisplayPlan[];
  isGuest: boolean;
  recentCheckouts: BillingCheckout[];
  remainingCredits: number | null;
  subscription: Subscription | null;
  tripayConfigured: boolean;
};

const PLAN_ICONS: Record<PlanSlug, ReactNode> = {
  free: <Sparkles />,
  pro: <Zap />,
  max: <Crown />,
};

function getPlanDiscount(plan: DisplayPlan) {
  const monthly = plan.offers.monthly.priceIdr;
  const yearly = plan.offers.yearly.priceIdr;

  if (monthly <= 0 || yearly <= 0) {
    return "Included";
  }

  const fullYearPrice = monthly * 12;
  const savings = Math.round(((fullYearPrice - yearly) / fullYearPrice) * 100);

  return savings > 0 ? `${savings}% off` : "Best value";
}

function getPlanTarget(planSlug: PlanSlug) {
  switch (planSlug) {
    case "free":
      return "For new accounts and lightweight usage";
    case "pro":
      return "For active builders who need better models";
    case "max":
      return "For power users who want the highest limits";
    default:
      return "For every Jikiro workspace";
  }
}

function getPlanDescription({
  currentPlan,
  isGuest,
  plan,
  remainingCredits,
}: {
  currentPlan: PlanSnapshot | null;
  isGuest: boolean;
  plan: DisplayPlan;
  remainingCredits: number | null;
}) {
  if (currentPlan?.planSlug === plan.planSlug && remainingCredits !== null) {
    return `Current active plan with ${remainingCredits.toLocaleString("en-US")} AI credits remaining in this cycle.`;
  }

  if (plan.planSlug === "free" && isGuest) {
    return "Starter tier becomes available right after you create an account.";
  }

  return plan.description;
}

function getPlanFeatures(plan: DisplayPlan) {
  const documentSizeMb = Math.round(
    plan.entitlements.attachmentLimits.maxDocumentSizeBytes / (1024 * 1024)
  );

  return [
    `${
      plan.entitlements.includedCredits === null
        ? "Limited guest AI credits"
        : `${plan.entitlements.includedCredits.toLocaleString("en-US")} AI credits per cycle`
    }`,
    `${plan.entitlements.allowedModelIds.length} available AI models`,
    `Up to ${plan.entitlements.attachmentLimits.maxFilesPerChat} attachments per chat`,
    `Document uploads up to ${documentSizeMb} MB`,
    plan.entitlements.features.projects
      ? "Project creation (coming soon)"
      : "Project creation not included",
    plan.entitlements.features.integrations > 0
      ? `${plan.entitlements.features.integrations} app integrations (coming soon)`
      : "App integrations not included",
    plan.entitlements.features.videoGeneration
      ? "Video generation (coming soon)"
      : "Video generation not included",
  ];
}

function getCtaLabel({
  currentPlan,
  hasChannels,
  isGuest,
  pendingKey,
  plan,
  tripayConfigured,
}: {
  currentPlan: PlanSnapshot | null;
  hasChannels: boolean;
  isGuest: boolean;
  pendingKey: string | null;
  plan: DisplayPlan;
  tripayConfigured: boolean;
}) {
  if (plan.planSlug === "free") {
    if (isGuest) {
      return "Create account";
    }

    return currentPlan?.planSlug === "free" ? "Current plan" : "Included";
  }

  if (isGuest) {
    return "Create account";
  }

  if (!tripayConfigured || !hasChannels) {
    return "Checkout unavailable";
  }

  return {
    monthly:
      pendingKey === `${plan.planSlug}:monthly`
        ? "Creating checkout..."
        : currentPlan?.planSlug === plan.planSlug
          ? "Renew monthly"
          : "Purchase monthly",
    yearly:
      pendingKey === `${plan.planSlug}:yearly`
        ? "Creating checkout..."
        : currentPlan?.planSlug === plan.planSlug
          ? "Renew yearly"
          : "Purchase yearly",
  } satisfies Partial<Record<PricingBillingPeriod, string>>;
}

function getCtaDisabled({
  hasChannels,
  isGuest,
  pendingKey,
  plan,
  tripayConfigured,
}: {
  hasChannels: boolean;
  isGuest: boolean;
  pendingKey: string | null;
  plan: DisplayPlan;
  tripayConfigured: boolean;
}) {
  if (plan.planSlug === "free") {
    return !isGuest;
  }

  if (isGuest) {
    return false;
  }

  if (!tripayConfigured || !hasChannels) {
    return true;
  }

  return pendingKey !== null;
}

export function BillingDashboard({
  channels,
  currentPlan,
  displayPlans,
  isGuest,
  remainingCredits,
  tripayConfigured,
}: BillingDashboardProps) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const selectedMethod = channels[0]?.code ?? "BRIVA";
  const hasChannels = channels.length > 0;

  const handleCheckout = (planSlug: PlanSlug, interval: BillingInterval) => {
    setPendingKey(`${planSlug}:${interval}`);

    startTransition(async () => {
      const result = await createTripayCheckout({
        interval,
        paymentMethod: selectedMethod,
        planSlug,
      });

      if (!result.ok) {
        toast.error(result.error);
        setPendingKey(null);
        return;
      }

      if (!result.checkoutUrl) {
        toast.error("Tripay did not return a checkout URL.");
        setPendingKey(null);
        return;
      }

      window.location.href = result.checkoutUrl;
    });
  };

  const plans: Plans = displayPlans.map((plan) => ({
    ctaDisabled: getCtaDisabled({
      hasChannels,
      isGuest,
      pendingKey,
      plan,
      tripayConfigured,
    }),
    ctaLabel: getCtaLabel({
      currentPlan,
      hasChannels,
      isGuest,
      pendingKey,
      plan,
      tripayConfigured,
    }),
    description: getPlanDescription({
      currentPlan,
      isGuest,
      plan,
      remainingCredits,
    }),
    discount: getPlanDiscount(plan),
    features: getPlanFeatures(plan),
    icon: PLAN_ICONS[plan.planSlug],
    isPopular: currentPlan
      ? currentPlan.planSlug === plan.planSlug
      : plan.planSlug === "pro",
    name: plan.name,
    onSelect: (billingPeriod) => {
      if (plan.planSlug === "free") {
        if (isGuest) {
          router.push("/register");
          return;
        }

        toast.message("Free tier is already included for registered accounts.");
        return;
      }

      if (isGuest) {
        router.push("/register");
        return;
      }

      if (!tripayConfigured) {
        toast.error("Tripay is not configured in this environment yet.");
        return;
      }

      if (!hasChannels) {
        toast.error("No Tripay payment channels are available right now.");
        return;
      }

      handleCheckout(plan.planSlug, billingPeriod);
    },
    price: {
      monthly: plan.offers.monthly.priceIdr,
      yearly: plan.offers.yearly.priceIdr,
    },
    pricePrefix: "Rp",
    target: getPlanTarget(plan.planSlug),
  }));

  return <Pricing backHref="/" plans={plans} />;
}
