import { createHmac, randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { getPlanSnapshot } from "../../lib/billing/plans";
import { db } from "../../lib/db/client";
import type { BillingCheckout } from "../../lib/db/schema";
import {
  billingCheckout,
  billingEvent,
  creditLedger,
  subscription,
  user,
} from "../../lib/db/schema";
import { generateRandomTestUser } from "../helpers";

const hasTripayCredentials = Boolean(
  process.env.TRIPAY_API_KEY &&
    process.env.TRIPAY_MERCHANT_CODE &&
    process.env.TRIPAY_PRIVATE_KEY
);

async function registerRegularUser(page: Page) {
  const credentials = generateRandomTestUser();

  await page.goto("/register");
  await page.getByPlaceholder("user@acme.com").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");

  return credentials;
}

async function createCheckoutFixture(interval: "monthly" | "yearly") {
  const token = randomUUID().split("-")[0];
  const email = `tripay-${Date.now()}-${token}@e2e.test`;
  const merchantRef = `E2E-${Date.now()}-${token.toUpperCase()}`;
  const planSnapshot = getPlanSnapshot("pro", interval);
  const [createdUser] = await db
    .insert(user)
    .values({
      email,
      name: "Tripay E2E",
    })
    .returning();

  const [checkout] = await db
    .insert(billingCheckout)
    .values({
      amountIdr: planSnapshot.priceIdr,
      interval,
      merchantRef,
      planSlug: "pro",
      planSnapshot,
      rawRequest: {
        interval,
        paymentMethod: "BRIVA",
        planSlug: "pro",
        source: "playwright",
      },
      userId: createdUser.id,
    })
    .returning();

  return {
    checkout,
    createdUser,
  };
}

function createSignedCallbackRequest(checkout: BillingCheckout) {
  const payload = {
    amount_received: checkout.amountIdr,
    merchant_ref: checkout.merchantRef,
    paid_at: Math.floor(Date.now() / 1000),
    payment_method: "BRIVA",
    payment_name: "BRI Virtual Account",
    reference: `TRX-${checkout.merchantRef}`,
    status: "PAID",
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.TRIPAY_PRIVATE_KEY ?? "")
    .update(rawBody)
    .digest("hex");

  return {
    payload,
    rawBody,
    signature,
  };
}

test.describe("Billing Page", () => {
  test("redirects unauthenticated visitors to login when opening billing", async ({
    page,
  }) => {
    await page.goto("/billing");

    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
  });

  test("supports monthly and yearly billing deep-links after sign-up", async ({
    page,
  }) => {
    await registerRegularUser(page);

    await page.goto("/billing?interval=monthly");
    await expect(page.getByRole("tab", { name: "Monthly" })).toHaveAttribute(
      "data-state",
      "active"
    );
    await expect(page.getByText("149,000").first()).toBeVisible();

    await page.goto("/billing?interval=yearly");
    await expect(page.getByRole("tab", { name: "Yearly" })).toHaveAttribute(
      "data-state",
      "active"
    );
    await expect(page.getByText("1,490,000").first()).toBeVisible();
  });

  test("redirects guests away from model settings", async ({ page }) => {
    await page.goto("/settings/models");

    await expect(page).toHaveURL("/login");
  });
});

test.describe("Tier model gating", () => {
  test("guest/free session receives only guest-safe models", async ({
    page,
  }) => {
    await page.goto("/");

    const modelPayload = await page.evaluate(async () => {
      const response = await fetch("/api/models");
      return response.json();
    });

    expect(modelPayload.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "deepseek/deepseek-v3.2" }),
        expect.objectContaining({ id: "mistral/mistral-small" }),
        expect.objectContaining({ id: "openai/gpt-5-nano" }),
      ])
    );
    expect(modelPayload.models).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "moonshotai/kimi-k2-0905" }),
        expect.objectContaining({ id: "xai/grok-4.1-fast-non-reasoning" }),
      ])
    );
  });
});

test.describe("Tripay webhook", () => {
  test.skip(!hasTripayCredentials, "Tripay credentials are not configured.");

  test("rejects invalid callback signatures", async ({ request }) => {
    const response = await request.post("/api/billing/tripay/callback", {
      data: JSON.stringify({
        merchant_ref: `INVALID-${Date.now()}`,
        status: "PAID",
      }),
      headers: {
        "content-type": "application/json",
        "x-callback-event": "payment_status",
        "x-callback-signature": "invalid-signature",
      },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      message: "Invalid callback signature",
      success: false,
    });
  });

  test("activates a subscription from a paid callback", async ({ request }) => {
    const { checkout, createdUser } = await createCheckoutFixture("yearly");
    const { rawBody, signature } = createSignedCallbackRequest(checkout);

    const response = await request.post("/api/billing/tripay/callback", {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "x-callback-event": "payment_status",
        "x-callback-signature": signature,
      },
    });

    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ success: true });

    const [savedSubscription] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, createdUser.id))
      .limit(1);
    const savedEvents = await db
      .select()
      .from(billingEvent)
      .where(eq(billingEvent.checkoutId, checkout.id));
    const savedCredits = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, createdUser.id));

    expect(savedSubscription?.interval).toBe("yearly");
    expect(savedSubscription?.planSlug).toBe("pro");
    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0]?.processedAt).not.toBeNull();
    expect(savedCredits).toHaveLength(1);
    expect(savedCredits[0]?.amount).toBe(checkout.planSnapshot.includedCredits);
  });

  test("ignores duplicate paid callbacks", async ({ request }) => {
    const { checkout, createdUser } = await createCheckoutFixture("monthly");
    const { rawBody, signature } = createSignedCallbackRequest(checkout);

    const firstResponse = await request.post("/api/billing/tripay/callback", {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "x-callback-event": "payment_status",
        "x-callback-signature": signature,
      },
    });
    const secondResponse = await request.post("/api/billing/tripay/callback", {
      data: rawBody,
      headers: {
        "content-type": "application/json",
        "x-callback-event": "payment_status",
        "x-callback-signature": signature,
      },
    });

    expect(firstResponse.ok()).toBeTruthy();
    expect(await secondResponse.json()).toEqual({
      duplicate: true,
      success: true,
    });

    const savedEvents = await db
      .select()
      .from(billingEvent)
      .where(eq(billingEvent.checkoutId, checkout.id));
    const savedCredits = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, createdUser.id));
    const savedSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, createdUser.id));

    expect(savedEvents).toHaveLength(1);
    expect(savedCredits).toHaveLength(1);
    expect(savedSubscriptions).toHaveLength(1);
    expect(savedSubscriptions[0]?.interval).toBe("monthly");
  });
});
