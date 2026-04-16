"use client";

import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  SparklesIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { EffectiveEntitlements, PlanSnapshot } from "@/lib/billing/types";
import type { BillingCheckout, Subscription } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type BillingOverviewProps = {
  currentPlan: PlanSnapshot | null;
  entitlements: EffectiveEntitlements;
  recentCheckouts: BillingCheckout[];
  remainingCredits: number | null;
  subscription: Subscription | null;
};

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(date: Date | string | null) {
  if (!date) {
    return "—";
  }

  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-600 border-zinc-200",
  max: "bg-amber-500/10 text-amber-600 border-amber-200",
  pro: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const CHECKOUT_STATUS_CONFIG: Record<
  string,
  { badge: string; className: string; icon: typeof CheckCircle2Icon }
> = {
  expired: {
    badge: "Expired",
    className: "text-red-600 bg-red-500/10 border-red-200",
    icon: XCircleIcon,
  },
  failed: {
    badge: "Failed",
    className: "text-red-600 bg-red-500/10 border-red-200",
    icon: XCircleIcon,
  },
  paid: {
    badge: "Paid",
    className: "text-emerald-600 bg-emerald-500/10 border-emerald-200",
    icon: CheckCircle2Icon,
  },
  pending: {
    badge: "Pending",
    className: "text-amber-600 bg-amber-500/10 border-amber-200",
    icon: ClockIcon,
  },
};

export function BillingOverview({
  currentPlan,
  entitlements,
  recentCheckouts,
  remainingCredits,
  subscription,
}: BillingOverviewProps) {
  const router = useRouter();

  const planSlug = currentPlan?.planSlug ?? "free";
  const planName = currentPlan?.name ?? "Free";
  const includedCredits = entitlements.includedCredits ?? 0;
  const credits = remainingCredits ?? 0;
  const creditPercentage =
    includedCredits > 0 ? Math.round((credits / includedCredits) * 100) : 0;

  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild size="icon" variant="ghost">
              <Link aria-label="Back to home" href="/">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Billing</h1>
              <p className="text-muted-foreground text-sm">
                Manage your subscription and payments
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/plans">
              <SparklesIcon className="mr-2 size-4" />
              View Plans
            </Link>
          </Button>
        </div>

        {/* Subscription + Credits Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Subscription Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Current Plan
                </h2>
                <Badge
                  className={cn(
                    "text-xs",
                    PLAN_BADGE_STYLES[planSlug] ?? PLAN_BADGE_STYLES.free
                  )}
                  variant="outline"
                >
                  {subscription?.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <ZapIcon className="size-5 text-primary" />
                <span className="text-2xl font-bold">{planName}</span>
                {subscription?.interval && (
                  <Badge className="ml-1" variant="secondary">
                    {subscription.interval}
                  </Badge>
                )}
              </div>

              {subscription && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-3.5" />
                    <span>
                      {formatDate(subscription.currentPeriodStart)} —{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  {currentPlan && currentPlan.priceIdr > 0 && (
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="size-3.5" />
                      <span>
                        {formatRupiah(currentPlan.priceIdr)} /{" "}
                        {subscription.interval}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="mt-4 w-full"
                onClick={() => router.push("/plans")}
                variant="outline"
              >
                Change Plan
              </Button>
            </CardContent>
          </Card>

          {/* Credits Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  AI Credits
                </h2>
                <span className="text-xs text-muted-foreground">
                  Resets{" "}
                  {subscription
                    ? formatDate(subscription.currentPeriodEnd)
                    : "—"}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-3xl font-bold">
                  {credits.toLocaleString("en-US")}
                </span>
                <span className="text-muted-foreground text-sm">
                  {" "}
                  / {includedCredits.toLocaleString("en-US")}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    creditPercentage > 50
                      ? "bg-emerald-500"
                      : creditPercentage > 20
                        ? "bg-amber-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(creditPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {creditPercentage}% remaining
              </p>

              <Separator className="my-4" />

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Max files per chat</span>
                  <span className="font-medium text-foreground">
                    {entitlements.attachmentLimits.maxFilesPerChat}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages per hour</span>
                  <span className="font-medium text-foreground">
                    {entitlements.maxMessagesPerHour}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">Payment History</h2>

            {recentCheckouts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No payments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {recentCheckouts.map((checkout) => {
                  const statusConfig =
                    CHECKOUT_STATUS_CONFIG[checkout.status] ??
                    CHECKOUT_STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const planSnapshot = checkout.planSnapshot as {
                    name?: string;
                  } | null;

                  return (
                    <button
                      className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                      key={checkout.id}
                      onClick={() =>
                        router.push(`/billing/checkout/${checkout.merchantRef}`)
                      }
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon
                          className={cn(
                            "size-4 shrink-0",
                            statusConfig.className.split(" ")[0]
                          )}
                        />
                        <div>
                          <p className="font-medium">
                            {planSnapshot?.name ?? checkout.planSlug}{" "}
                            <span className="text-muted-foreground font-normal">
                              ({checkout.interval})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(checkout.createdAt)}
                            {checkout.paymentName &&
                              ` · ${checkout.paymentName}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatRupiah(checkout.amountIdr)}
                          </p>
                          <Badge
                            className={cn(
                              "text-[10px]",
                              statusConfig.className
                            )}
                            variant="outline"
                          >
                            {statusConfig.badge}
                          </Badge>
                        </div>
                        <ArrowUpRightIcon className="size-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
