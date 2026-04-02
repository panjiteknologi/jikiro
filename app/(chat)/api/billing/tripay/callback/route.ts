import { z } from "zod";
import { activateSubscriptionFromCheckout } from "@/lib/billing/service";
import {
  getTripayConfig,
  verifyTripayCallbackSignature,
} from "@/lib/billing/tripay";
import {
  createBillingEvent,
  getBillingCheckoutByMerchantRef,
  markBillingEventProcessed,
  updateBillingCheckout,
} from "@/lib/db/billing-queries";

const callbackSchema = z
  .object({
    amount_received: z.number().optional(),
    expired_time: z.union([z.number(), z.string()]).optional(),
    fee_customer: z.number().optional(),
    fee_merchant: z.number().optional(),
    merchant_ref: z.string(),
    paid_at: z.union([z.number(), z.string()]).optional(),
    pay_code: z.union([z.string(), z.number()]).optional(),
    pay_url: z.string().nullable().optional(),
    payment_method: z.string().optional(),
    payment_name: z.string().optional(),
    reference: z.string().optional(),
    status: z.string(),
  })
  .passthrough();

function parseTripayTimestamp(value?: number | string) {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return new Date(numeric * 1000);
    }
  }

  return null;
}

export async function POST(request: Request) {
  const config = getTripayConfig();

  if (!config) {
    return Response.json(
      { success: false, message: "Tripay is not configured" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-callback-signature");
  const eventType = request.headers.get("x-callback-event") ?? "payment_status";

  if (
    !verifyTripayCallbackSignature({
      privateKey: config.privateKey,
      rawBody,
      signature,
    })
  ) {
    return Response.json(
      { success: false, message: "Invalid callback signature" },
      { status: 403 }
    );
  }

  if (eventType !== "payment_status") {
    return Response.json(
      { success: false, message: "Unsupported callback event" },
      { status: 400 }
    );
  }

  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { success: false, message: "Invalid callback payload" },
      { status: 400 }
    );
  }

  const parsedJson = callbackSchema.safeParse(rawPayload);

  if (!parsedJson.success) {
    return Response.json(
      { success: false, message: "Invalid callback payload" },
      { status: 400 }
    );
  }

  const payload = parsedJson.data;
  const checkout = await getBillingCheckoutByMerchantRef({
    merchantRef: payload.merchant_ref,
  });

  const eventKey = [
    eventType,
    payload.merchant_ref,
    payload.reference ?? "unknown",
    payload.status,
    payload.paid_at ?? "na",
  ].join(":");

  const billingEventResult = await createBillingEvent({
    checkoutId: checkout?.id ?? null,
    eventKey,
    eventType,
    headers: Object.fromEntries(request.headers.entries()),
    payload,
    signature,
    userId: checkout?.userId ?? null,
  });

  if (billingEventResult.isDuplicate) {
    return Response.json({ success: true, duplicate: true });
  }

  if (!checkout) {
    if (billingEventResult.event) {
      await markBillingEventProcessed({ billingEventId: billingEventResult.event.id });
    }

    return Response.json({ success: false, message: "Checkout not found" });
  }

  const status = payload.status.toUpperCase();
  const mappedStatus =
    status === "PAID"
      ? "paid"
      : status === "EXPIRED"
        ? "expired"
        : status === "FAILED"
          ? "failed"
          : "pending";

  await updateBillingCheckout({
    amountReceivedIdr: payload.amount_received ?? null,
    checkoutId: checkout.id,
    expiresAt: parseTripayTimestamp(payload.expired_time),
    feeCustomerIdr: payload.fee_customer ?? null,
    feeMerchantIdr: payload.fee_merchant ?? null,
    paidAt: parseTripayTimestamp(payload.paid_at),
    payCode:
      typeof payload.pay_code === "undefined"
        ? undefined
        : String(payload.pay_code),
    paymentMethod: payload.payment_method ?? null,
    paymentName: payload.payment_name ?? null,
    payUrl: payload.pay_url ?? null,
    rawResponse: payload,
    status: mappedStatus,
    tripayReference: payload.reference ?? null,
  });

  if (mappedStatus === "paid") {
    await activateSubscriptionFromCheckout({
      checkoutId: checkout.id,
      interval: checkout.interval,
      planSlug: checkout.planSlug,
      userId: checkout.userId,
    });
  }

  if (billingEventResult.event) {
    await markBillingEventProcessed({ billingEventId: billingEventResult.event.id });
  }

  return Response.json({ success: true });
}
