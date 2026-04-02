import "server-only";

import { createHmac } from "node:crypto";
import type { BillingInterval, PlanSnapshot, PlanSlug } from "@/lib/billing/types";

export type TripayEnvironment = "sandbox" | "production";

export type TripayChannel = {
  code: string;
  feeCustomer: number | null;
  feeMerchant: number | null;
  group: string | null;
  name: string;
  type: string | null;
};

type TripayConfig = {
  apiKey: string;
  appBaseUrl: string | null;
  callbackUrl: string | null;
  environment: TripayEnvironment;
  merchantCode: string;
  privateKey: string;
  returnUrl: string | null;
};

type CreateTripayCheckoutInput = {
  amountIdr: number;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  interval: BillingInterval;
  merchantRef: string;
  paymentMethod: string;
  planSlug: PlanSlug;
  planSnapshot: PlanSnapshot;
};

function getTripayEnvironment(): TripayEnvironment {
  return process.env.TRIPAY_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

function getTripayBaseUrl(environment: TripayEnvironment) {
  return environment === "production"
    ? "https://tripay.co.id/api"
    : "https://tripay.co.id/api-sandbox";
}

export function getTripayConfig(): TripayConfig | null {
  const apiKey = process.env.TRIPAY_API_KEY?.trim();
  const privateKey = process.env.TRIPAY_PRIVATE_KEY?.trim();
  const merchantCode = process.env.TRIPAY_MERCHANT_CODE?.trim();

  if (!apiKey || !privateKey || !merchantCode) {
    return null;
  }

  return {
    apiKey,
    appBaseUrl: process.env.APP_BASE_URL?.trim() || null,
    callbackUrl: process.env.TRIPAY_CALLBACK_URL?.trim() || null,
    environment: getTripayEnvironment(),
    merchantCode,
    privateKey,
    returnUrl: process.env.TRIPAY_RETURN_URL?.trim() || null,
  };
}

export function createTripaySignature({
  amountIdr,
  merchantCode,
  merchantRef,
  privateKey,
}: {
  amountIdr: number;
  merchantCode: string;
  merchantRef: string;
  privateKey: string;
}) {
  return createHmac("sha256", privateKey)
    .update(`${merchantCode}${merchantRef}${amountIdr}`)
    .digest("hex");
}

export function verifyTripayCallbackSignature({
  privateKey,
  rawBody,
  signature,
}: {
  privateKey: string;
  rawBody: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", privateKey)
    .update(rawBody)
    .digest("hex");

  return expected === signature;
}

export async function listTripayChannels() {
  const config = getTripayConfig();

  if (!config) {
    return [];
  }

  const response = await fetch(
    `${getTripayBaseUrl(config.environment)}/merchant/payment-channel`,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "GET",
    }
  ).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  const json = await response.json().catch(() => null);
  const channels = Array.isArray(json?.data) ? json.data : [];

  return channels
    .map((channel: Record<string, unknown>) => ({
      code:
        typeof channel.code === "string"
          ? channel.code
          : typeof channel.payment_method === "string"
            ? channel.payment_method
            : null,
      feeCustomer:
        typeof channel.fee_customer === "number" ? channel.fee_customer : null,
      feeMerchant:
        typeof channel.fee_merchant === "number" ? channel.fee_merchant : null,
      group: typeof channel.group === "string" ? channel.group : null,
      name:
        typeof channel.name === "string"
          ? channel.name
          : typeof channel.payment_name === "string"
            ? channel.payment_name
            : null,
      type: typeof channel.type === "string" ? channel.type : null,
    }))
    .filter(
      (channel: {
        code: string | null;
        feeCustomer: number | null;
        feeMerchant: number | null;
        group: string | null;
        name: string | null;
        type: string | null;
      }): channel is TripayChannel =>
        typeof channel.code === "string" && typeof channel.name === "string"
    );
}

export async function createTripayCheckout(
  input: CreateTripayCheckoutInput
) {
  const config = getTripayConfig();

  if (!config) {
    throw new Error("Tripay is not configured");
  }

  const signature = createTripaySignature({
    amountIdr: input.amountIdr,
    merchantCode: config.merchantCode,
    merchantRef: input.merchantRef,
    privateKey: config.privateKey,
  });
  const callbackUrl =
    config.callbackUrl ||
    (config.appBaseUrl
      ? `${config.appBaseUrl.replace(/\/$/, "")}/api/billing/tripay/callback`
      : null);
  const returnUrl =
    config.returnUrl ||
    (config.appBaseUrl
      ? `${config.appBaseUrl.replace(/\/$/, "")}/billing?checkout=${encodeURIComponent(input.merchantRef)}`
      : null);

  const payload = {
    amount: input.amountIdr,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    ...(input.customerPhone ? { customer_phone: input.customerPhone } : {}),
    ...(returnUrl ? { return_url: returnUrl } : {}),
    merchant_ref: input.merchantRef,
    method: input.paymentMethod,
    order_items: [
      {
        name: `${input.planSnapshot.name} ${input.interval}`,
        price: input.amountIdr,
        quantity: 1,
        sku: `${input.planSlug}-${input.interval}`,
      },
    ],
    signature,
  };

  const response = await fetch(
    `${getTripayBaseUrl(config.environment)}/transaction/create`,
    {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success || !json?.data) {
    throw new Error(
      typeof json?.message === "string"
        ? json.message
        : "Failed to create Tripay checkout"
    );
  }

  return {
    callbackUrl,
    payload,
    raw: json,
    returnUrl,
    data: json.data as {
      amount_received?: number;
      callback_url?: string | null;
      checkout_url?: string | null;
      expired_time?: number | null;
      fee_customer?: number | null;
      fee_merchant?: number | null;
      pay_code?: string | number | null;
      pay_url?: string | null;
      payment_method?: string | null;
      payment_name?: string | null;
      reference?: string | null;
      return_url?: string | null;
    },
  };
}
