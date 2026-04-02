"use server";

import { auth } from "@/app/(auth)/auth";
import { getPlanSnapshot, isPaidPlan } from "@/lib/billing/plans";
import type { BillingInterval, PlanSlug } from "@/lib/billing/types";
import { createTripayCheckout as createTripayCheckoutRequest } from "@/lib/billing/tripay";
import {
  createBillingCheckout,
  updateBillingCheckout,
} from "@/lib/db/billing-queries";
import { generateUUID } from "@/lib/utils";

export async function createTripayCheckout({
  interval,
  paymentMethod,
  planSlug,
}: {
  interval: BillingInterval;
  paymentMethod: string;
  planSlug: PlanSlug;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: "You need to sign in before starting checkout.",
      ok: false as const,
    };
  }

  if (session.user.type === "guest") {
    return {
      error: "Guest sessions need a registered account before upgrading.",
      ok: false as const,
    };
  }

  if (!isPaidPlan(planSlug)) {
    return {
      error: "Free users do not need checkout.",
      ok: false as const,
    };
  }

  if (!paymentMethod.trim()) {
    return {
      error: "Choose a payment method first.",
      ok: false as const,
    };
  }

  const planSnapshot = getPlanSnapshot(planSlug, interval);
  const merchantRef = `SUB-${Date.now()}-${generateUUID().slice(0, 8).toUpperCase()}`;
  const pendingCheckout = await createBillingCheckout({
    amountIdr: planSnapshot.priceIdr,
    interval,
    merchantRef,
    planSlug,
    planSnapshot,
    rawRequest: {
      interval,
      paymentMethod,
      planSlug,
    },
    userId: session.user.id,
  });

  if (!pendingCheckout) {
    return {
      error: "Failed to create checkout draft.",
      ok: false as const,
    };
  }

  try {
    const checkout = await createTripayCheckoutRequest({
      amountIdr: planSnapshot.priceIdr,
      customerEmail: session.user.email ?? `${session.user.id}@jikiro.local`,
      customerName: session.user.name ?? session.user.email ?? "Jikiro User",
      interval,
      merchantRef,
      paymentMethod,
      planSlug,
      planSnapshot,
    });

    await updateBillingCheckout({
      amountReceivedIdr: checkout.data.amount_received ?? null,
      checkoutId: pendingCheckout.id,
      checkoutUrl: checkout.data.checkout_url ?? null,
      expiresAt:
        typeof checkout.data.expired_time === "number"
          ? new Date(checkout.data.expired_time * 1000)
          : null,
      feeCustomerIdr: checkout.data.fee_customer ?? null,
      feeMerchantIdr: checkout.data.fee_merchant ?? null,
      payCode:
        typeof checkout.data.pay_code === "undefined"
          ? undefined
          : String(checkout.data.pay_code),
      paymentMethod: checkout.data.payment_method ?? paymentMethod,
      paymentName: checkout.data.payment_name ?? null,
      payUrl: checkout.data.pay_url ?? null,
      rawResponse: checkout.raw,
      status: "pending",
      tripayReference: checkout.data.reference ?? null,
    });

    return {
      checkoutUrl: checkout.data.checkout_url ?? null,
      merchantRef,
      ok: true as const,
    };
  } catch (error) {
    await updateBillingCheckout({
      checkoutId: pendingCheckout.id,
      rawResponse: {
        error: error instanceof Error ? error.message : "Unknown Tripay error",
      },
      status: "failed",
    });

    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create Tripay checkout.",
      ok: false as const,
    };
  }
}
