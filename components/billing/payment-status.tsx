"use client";

import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { refreshCheckoutStatus } from "@/app/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { BillingCheckout } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type PaymentStatusProps = {
  checkout: BillingCheckout;
};

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function getTimeRemaining(expiresAt: Date) {
  const diff = expiresAt.getTime() - Date.now();

  if (diff <= 0) {
    return null;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds };
}

function formatCountdown(time: {
  hours: number;
  minutes: number;
  seconds: number;
}) {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:${String(time.seconds).padStart(2, "0")}`;
}

const STATUS_CONFIG = {
  expired: {
    badge: "Payment Expired",
    badgeClass: "bg-red-500/10 text-red-600 border-red-200",
    icon: XCircleIcon,
    iconClass: "text-red-500",
  },
  failed: {
    badge: "Payment Failed",
    badgeClass: "bg-red-500/10 text-red-600 border-red-200",
    icon: XCircleIcon,
    iconClass: "text-red-500",
  },
  paid: {
    badge: "Payment Successful",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    icon: CheckCircle2Icon,
    iconClass: "text-emerald-500",
  },
  pending: {
    badge: "Awaiting Payment",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200",
    icon: ClockIcon,
    iconClass: "text-amber-500",
  },
} as const;

export function PaymentStatus({ checkout: initial }: PaymentStatusProps) {
  const [checkout, setCheckout] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState<string | null>(null);

  const status = checkout.status as keyof typeof STATUS_CONFIG;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  // Countdown timer
  useEffect(() => {
    if (checkout.status !== "pending" || !checkout.expiresAt) {
      setCountdown(null);
      return;
    }

    function tick() {
      const time = getTimeRemaining(new Date(checkout.expiresAt as Date));

      if (!time) {
        setCountdown(null);
        return;
      }

      setCountdown(formatCountdown(time));
    }

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [checkout.status, checkout.expiresAt]);

  const handleRefresh = useCallback(() => {
    startTransition(async () => {
      const result = await refreshCheckoutStatus({
        merchantRef: checkout.merchantRef,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setCheckout(result.checkout);

      if (result.checkout.status === "paid") {
        toast.success("Payment confirmed!");
      }
    });
  }, [checkout.merchantRef]);

  function copyPayCode() {
    if (!checkout.payCode) {
      return;
    }
    navigator.clipboard.writeText(checkout.payCode);
    toast.success("Pay code copied!");
  }

  const customerFee = checkout.feeCustomerIdr ?? 0;
  const total = checkout.amountIdr + customerFee;

  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link aria-label="Back to billing" href="/billing">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Payment Details</h1>
            <p className="text-muted-foreground text-sm">
              Order {checkout.merchantRef}
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <StatusIcon className={cn("mb-4 size-16", config.iconClass)} />
            <Badge
              className={cn("mb-3 px-3 py-1 text-sm", config.badgeClass)}
              variant="outline"
            >
              {config.badge}
            </Badge>

            {checkout.status === "paid" && (
              <div className="mt-2 space-y-2">
                <p className="text-muted-foreground text-sm">
                  Your{" "}
                  <span className="font-medium text-foreground">
                    {(checkout.planSnapshot as { name?: string })?.name ??
                      checkout.planSlug}
                  </span>{" "}
                  plan is now active.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/">Start chatting</Link>
                </Button>
              </div>
            )}

            {(checkout.status === "expired" ||
              checkout.status === "failed") && (
              <div className="mt-2 space-y-2">
                <p className="text-muted-foreground text-sm">
                  {checkout.status === "expired"
                    ? "This payment has expired. Please try again."
                    : "Something went wrong with your payment. Please try again."}
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/plans">Try again</Link>
                </Button>
              </div>
            )}

            {checkout.status === "pending" && countdown && (
              <div className="mt-2 space-y-1">
                <p className="text-muted-foreground text-sm">
                  Complete payment before it expires
                </p>
                <p className="font-mono text-2xl font-bold text-amber-600">
                  {countdown}
                </p>
              </div>
            )}

            {checkout.status === "pending" &&
              !countdown &&
              checkout.expiresAt && (
                <p className="text-muted-foreground mt-2 text-sm">
                  This payment may have expired. Click &quot;Check Status&quot;
                  to verify.
                </p>
              )}
          </CardContent>
        </Card>

        {/* Payment Instructions (pending only) */}
        {checkout.status === "pending" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="mb-4 text-lg font-semibold">
                Payment Instructions
              </h2>

              {checkout.paymentName && (
                <div className="mb-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    Payment Method
                  </p>
                  <p className="mt-1 font-medium">{checkout.paymentName}</p>
                </div>
              )}

              {checkout.payCode && (
                <div className="mb-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">
                    Pay Code / Virtual Account
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded-md bg-muted px-3 py-2 font-mono text-lg font-bold tracking-widest">
                      {checkout.payCode}
                    </code>
                    <Button onClick={copyPayCode} size="icon" variant="outline">
                      <CopyIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {checkout.payUrl && (
                <div className="mb-4">
                  <Button asChild variant="outline">
                    <a
                      href={checkout.payUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLinkIcon className="mr-2 size-4" />
                      Open Payment Page
                    </a>
                  </Button>
                </div>
              )}

              {checkout.checkoutUrl && (
                <div>
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={checkout.checkoutUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLinkIcon className="mr-2 size-3.5" />
                      Open Tripay Checkout
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {(checkout.planSnapshot as { name?: string })?.name ??
                    checkout.planSlug}{" "}
                  ({checkout.interval})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRupiah(checkout.amountIdr)}</span>
              </div>
              {customerFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment fee</span>
                  <span>{formatRupiah(customerFee)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatRupiah(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check Status Button */}
        {checkout.status === "pending" && (
          <Button
            className="w-full"
            disabled={isPending}
            onClick={handleRefresh}
            size="lg"
            variant="outline"
          >
            {isPending ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-2 size-4" />
            )}
            Check Status
          </Button>
        )}
      </div>
    </section>
  );
}
