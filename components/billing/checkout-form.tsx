"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CreditCardIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { createTripayCheckout } from "@/app/billing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { TripayChannel } from "@/lib/billing/tripay";
import type { BillingInterval, PlanSlug } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

type CheckoutFormProps = {
  channels: TripayChannel[];
  interval: BillingInterval;
  planName: string;
  planSlug: PlanSlug;
  priceIdr: number;
};

function groupChannels(channels: TripayChannel[]) {
  const groups = new Map<string, TripayChannel[]>();

  for (const channel of channels) {
    const key = channel.group ?? "Other";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)?.push(channel);
  }

  return groups;
}

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function CheckoutForm({
  channels,
  interval,
  planName,
  planSlug,
  priceIdr,
}: CheckoutFormProps) {
  const router = useRouter();
  const [selectedChannel, setSelectedChannel] = useState<TripayChannel | null>(
    null
  );
  const [isPending, setIsPending] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groupChannels(channels).keys())
  );

  const grouped = groupChannels(channels);
  const customerFee = selectedChannel?.feeCustomer ?? 0;
  const total = priceIdr + customerFee;

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);

      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }

      return next;
    });
  }

  function handlePay() {
    if (!selectedChannel) {
      return;
    }

    setIsPending(true);

    startTransition(async () => {
      const result = await createTripayCheckout({
        interval,
        paymentMethod: selectedChannel.code,
        planSlug,
      });

      if (!result.ok) {
        toast.error(result.error);
        setIsPending(false);
        return;
      }

      router.push(`/billing/checkout/${result.merchantRef}`);
    });
  }

  return (
    <section className="min-h-screen py-8 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link aria-label="Back to plans" href="/plans">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Checkout</h1>
            <p className="text-muted-foreground text-sm">
              Complete your purchase
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Payment Methods */}
          <div className="lg:col-span-3">
            <Card className="pt-0">
              <CardContent className="pt-6">
                <h2 className="mb-4 text-lg font-semibold">Payment Method</h2>

                {channels.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    No payment methods available at this time.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Array.from(grouped.entries()).map(
                      ([group, groupChannels]) => (
                        <div
                          className="overflow-hidden rounded-lg border"
                          key={group}
                        >
                          <button
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
                            onClick={() => toggleGroup(group)}
                            type="button"
                          >
                            <span>{group}</span>
                            <ChevronDownIcon
                              className={cn(
                                "size-4 text-muted-foreground transition-transform",
                                expandedGroups.has(group) && "rotate-180"
                              )}
                            />
                          </button>

                          {expandedGroups.has(group) && (
                            <div className="border-t px-2 py-2">
                              {groupChannels.map((channel) => {
                                const isSelected =
                                  selectedChannel?.code === channel.code;

                                return (
                                  <button
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                                      isSelected
                                        ? "bg-primary/10 border-primary border"
                                        : "hover:bg-muted/50"
                                    )}
                                    key={channel.code}
                                    onClick={() => setSelectedChannel(channel)}
                                    type="button"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={cn(
                                          "flex size-5 items-center justify-center rounded-full border-2",
                                          isSelected
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground/30"
                                        )}
                                      >
                                        {isSelected && (
                                          <CheckIcon className="size-3 text-primary-foreground" />
                                        )}
                                      </div>
                                      <span className="font-medium">
                                        {channel.name}
                                      </span>
                                    </div>
                                    {channel.feeCustomer ? (
                                      <span className="text-muted-foreground text-xs">
                                        Fee {formatRupiah(channel.feeCustomer)}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-emerald-600">
                                        No fee
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <Card className="sticky top-8 pt-0">
              <CardContent className="pt-6">
                <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {planName}{" "}
                        <Badge className="ml-1" variant="secondary">
                          {interval}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Jikiro {planName} Plan
                      </p>
                    </div>
                    <span className="font-medium">
                      {formatRupiah(priceIdr)}
                    </span>
                  </div>

                  {selectedChannel && customerFee > 0 && (
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="min-w-0 shrink text-muted-foreground">
                        Payment fee ({selectedChannel.name})
                      </span>
                      <span className="shrink-0 text-right">
                        {formatRupiah(customerFee)}
                      </span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg">{formatRupiah(total)}</span>
                  </div>
                </div>

                <Button
                  className="mt-6 w-full"
                  disabled={!selectedChannel || isPending}
                  onClick={handlePay}
                  size="lg"
                >
                  {isPending ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCardIcon className="mr-2 size-4" />
                      Pay {formatRupiah(total)}
                    </>
                  )}
                </Button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheckIcon className="size-3.5" />
                  <span>Secured by Tripay</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
