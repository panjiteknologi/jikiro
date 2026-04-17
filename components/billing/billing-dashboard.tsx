"use client";

import { Crown, Loader2Icon, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { downgradeToFree } from "@/app/billing/actions";
import Pricing, {
  type Plans,
  type PricingBillingPeriod,
} from "@/components/billing/pricing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  BillingInterval,
  EffectiveEntitlements,
  PlanSlug,
  PlanSnapshot,
} from "@/lib/billing/types";

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
  currentPlan: PlanSnapshot | null;
  defaultBillingPeriod: PricingBillingPeriod;
  displayPlans: DisplayPlan[];
  isGuest: boolean;
  remainingCredits: number | null;
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
  const modelAccessLabel =
    plan.planSlug === "free"
      ? "5 available AI models"
      : plan.planSlug === "pro"
        ? "Custom model access (up to 10)"
        : "Custom model access (all eligible models)";

  return [
    `${
      plan.entitlements.includedCredits === null
        ? "Limited guest AI credits"
        : `${plan.entitlements.includedCredits.toLocaleString("en-US")} AI credits per cycle`
    }`,
    modelAccessLabel,
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

const PLAN_RANK: Record<PlanSlug, number> = {
  free: 0,
  pro: 1,
  max: 2,
};

function getCtaLabel({
  currentPlan,
  isGuest,
  plan,
}: {
  currentPlan: PlanSnapshot | null;
  isGuest: boolean;
  plan: DisplayPlan;
}) {
  if (isGuest) {
    return "Create account";
  }

  if (!currentPlan) {
    return plan.planSlug === "free" ? "Current plan" : "Upgrade";
  }

  const currentRank = PLAN_RANK[currentPlan.planSlug] ?? 0;
  const planRank = PLAN_RANK[plan.planSlug] ?? 0;

  if (planRank === currentRank) {
    return "Current plan";
  }

  return planRank > currentRank ? "Upgrade" : "Downgrade";
}

function getCtaDisabled({
  currentPlan,
  isGuest,
  plan,
}: {
  currentPlan: PlanSnapshot | null;
  isGuest: boolean;
  plan: DisplayPlan;
}) {
  if (isGuest) {
    return false;
  }

  return currentPlan?.planSlug === plan.planSlug;
}

export function BillingDashboard({
  currentPlan,
  defaultBillingPeriod,
  displayPlans,
  isGuest,
  remainingCredits,
}: BillingDashboardProps) {
  const router = useRouter();
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDowngrade() {
    startTransition(async () => {
      const result = await downgradeToFree();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Your plan has been downgraded to Free.");
      setShowDowngradeDialog(false);
      router.refresh();
    });
  }

  const plans: Plans = displayPlans.map((plan) => ({
    ctaDisabled: getCtaDisabled({ currentPlan, isGuest, plan }),
    ctaLabel: getCtaLabel({ currentPlan, isGuest, plan }),
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
      if (isGuest) {
        router.push("/register");
        return;
      }

      if (plan.planSlug === "free") {
        setShowDowngradeDialog(true);
        return;
      }

      router.push(
        `/billing/checkout?plan=${plan.planSlug}&interval=${billingPeriod}`
      );
    },
    price: {
      monthly: plan.offers.monthly.priceIdr,
      yearly: plan.offers.yearly.priceIdr,
    },
    pricePrefix: "Rp",
    target: getPlanTarget(plan.planSlug),
  }));

  return (
    <>
      <Pricing
        defaultBillingPeriod={defaultBillingPeriod}
        onBack={() => router.back()}
        plans={plans}
      />

      <AlertDialog
        onOpenChange={setShowDowngradeDialog}
        open={showDowngradeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade to Free?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to paid models and your credits will be reset
              to the Free tier limit (100 credits). This change takes effect
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={handleDowngrade}
              variant="destructive"
            >
              {isPending ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : null}
              Confirm Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
