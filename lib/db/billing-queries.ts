import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type {
  BillingInterval,
  CheckoutStatus,
  CreditLedgerEntryKind,
  PlanSnapshot,
  PlanSlug,
  SubscriptionStatus,
  UsageKind,
} from "@/lib/billing/types";
import { ChatbotError } from "@/lib/errors";
import { db } from "@/lib/db/client";
import {
  aiGenerationUsage,
  billingCheckout,
  billingEvent,
  creditLedger,
  subscription,
} from "@/lib/db/schema";

export async function getSubscriptionByUserId({ userId }: { userId: string }) {
  try {
    const [row] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get subscription by user id"
    );
  }
}

export async function saveSubscription({
  currentPeriodEnd,
  currentPeriodStart,
  lastCheckoutId,
  planSlug,
  planSnapshot,
  status,
  subscriptionId,
  userId,
  interval,
}: {
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  interval: BillingInterval;
  lastCheckoutId?: string | null;
  planSlug: PlanSlug;
  planSnapshot: PlanSnapshot;
  status: SubscriptionStatus;
  subscriptionId?: string;
  userId: string;
}) {
  try {
    const values = {
      currentPeriodEnd,
      currentPeriodStart,
      interval,
      lastCheckoutId: lastCheckoutId ?? null,
      planSlug,
      planSnapshot,
      status,
      updatedAt: new Date(),
      userId,
    };

    if (subscriptionId) {
      const [updated] = await db
        .update(subscription)
        .set(values)
        .where(eq(subscription.id, subscriptionId))
        .returning();

      return updated ?? null;
    }

    const [created] = await db
      .insert(subscription)
      .values({
        ...values,
        createdAt: new Date(),
      })
      .returning();

    return created ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save subscription"
    );
  }
}

export async function createBillingCheckout({
  amountIdr,
  callbackUrl,
  interval,
  merchantRef,
  planSlug,
  planSnapshot,
  rawRequest,
  returnUrl,
  userId,
}: {
  amountIdr: number;
  callbackUrl?: string | null;
  interval: BillingInterval;
  merchantRef: string;
  planSlug: PlanSlug;
  planSnapshot: PlanSnapshot;
  rawRequest?: unknown;
  returnUrl?: string | null;
  userId: string;
}) {
  try {
    const [created] = await db
      .insert(billingCheckout)
      .values({
        amountIdr,
        callbackUrl: callbackUrl ?? null,
        createdAt: new Date(),
        currency: "IDR",
        interval,
        merchantRef,
        planSlug,
        planSnapshot,
        rawRequest: rawRequest ?? null,
        returnUrl: returnUrl ?? null,
        status: "pending",
        updatedAt: new Date(),
        userId,
      })
      .returning();

    return created ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create billing checkout"
    );
  }
}

export async function updateBillingCheckout({
  amountReceivedIdr,
  checkoutId,
  checkoutUrl,
  expiresAt,
  feeCustomerIdr,
  feeMerchantIdr,
  paidAt,
  payCode,
  paymentMethod,
  paymentName,
  payUrl,
  rawResponse,
  status,
  tripayReference,
}: {
  amountReceivedIdr?: number | null;
  checkoutId: string;
  checkoutUrl?: string | null;
  expiresAt?: Date | null;
  feeCustomerIdr?: number | null;
  feeMerchantIdr?: number | null;
  paidAt?: Date | null;
  payCode?: string | null;
  paymentMethod?: string | null;
  paymentName?: string | null;
  payUrl?: string | null;
  rawResponse?: unknown;
  status?: CheckoutStatus;
  tripayReference?: string | null;
}) {
  try {
    const [updated] = await db
      .update(billingCheckout)
      .set({
        amountReceivedIdr:
          typeof amountReceivedIdr === "undefined" ? undefined : amountReceivedIdr,
        checkoutUrl:
          typeof checkoutUrl === "undefined" ? undefined : checkoutUrl,
        expiresAt: typeof expiresAt === "undefined" ? undefined : expiresAt,
        feeCustomerIdr:
          typeof feeCustomerIdr === "undefined" ? undefined : feeCustomerIdr,
        feeMerchantIdr:
          typeof feeMerchantIdr === "undefined" ? undefined : feeMerchantIdr,
        paidAt: typeof paidAt === "undefined" ? undefined : paidAt,
        payCode: typeof payCode === "undefined" ? undefined : payCode,
        paymentMethod:
          typeof paymentMethod === "undefined" ? undefined : paymentMethod,
        paymentName:
          typeof paymentName === "undefined" ? undefined : paymentName,
        payUrl: typeof payUrl === "undefined" ? undefined : payUrl,
        rawResponse: typeof rawResponse === "undefined" ? undefined : rawResponse,
        status: typeof status === "undefined" ? undefined : status,
        tripayReference:
          typeof tripayReference === "undefined" ? undefined : tripayReference,
        updatedAt: new Date(),
      })
      .where(eq(billingCheckout.id, checkoutId))
      .returning();

    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update billing checkout"
    );
  }
}

export async function getBillingCheckoutByMerchantRef({
  merchantRef,
}: {
  merchantRef: string;
}) {
  try {
    const [row] = await db
      .select()
      .from(billingCheckout)
      .where(eq(billingCheckout.merchantRef, merchantRef))
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get billing checkout by merchant ref"
    );
  }
}

export async function getRecentBillingCheckoutsByUserId({
  limit,
  userId,
}: {
  limit: number;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(billingCheckout)
      .where(eq(billingCheckout.userId, userId))
      .orderBy(desc(billingCheckout.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recent billing checkouts"
    );
  }
}

export async function createBillingEvent({
  checkoutId,
  eventKey,
  eventType,
  headers,
  payload,
  signature,
  userId,
}: {
  checkoutId?: string | null;
  eventKey: string;
  eventType: string;
  headers?: unknown;
  payload: unknown;
  signature?: string | null;
  userId?: string | null;
}) {
  try {
    const [created] = await db
      .insert(billingEvent)
      .values({
        checkoutId: checkoutId ?? null,
        eventKey,
        eventType,
        headers: headers ?? null,
        payload,
        signature: signature ?? null,
        userId: userId ?? null,
      })
      .onConflictDoNothing({
        target: billingEvent.eventKey,
      })
      .returning();

    if (created) {
      return { event: created, isDuplicate: false };
    }

    const [existing] = await db
      .select()
      .from(billingEvent)
      .where(eq(billingEvent.eventKey, eventKey))
      .limit(1);

    return { event: existing ?? null, isDuplicate: true };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create billing event"
    );
  }
}

export async function markBillingEventProcessed({
  billingEventId,
}: {
  billingEventId: string;
}) {
  try {
    const [updated] = await db
      .update(billingEvent)
      .set({ processedAt: new Date() })
      .where(eq(billingEvent.id, billingEventId))
      .returning();

    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to mark billing event processed"
    );
  }
}

export async function getUserCreditBalance({
  userId,
}: {
  userId: string;
}): Promise<number> {
  try {
    const [row] = await db
      .select({
        balance:
          sql<number>`coalesce(sum(${creditLedger.amount}), 0)`.mapWith(Number),
      })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId));

    return row?.balance ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user credit balance"
    );
  }
}

export async function createCreditLedgerEntry({
  amount,
  balanceNote,
  checkoutId,
  externalId,
  kind,
  metadata,
  subscriptionId,
  userId,
  aiUsageId,
}: {
  aiUsageId?: string | null;
  amount: number;
  balanceNote?: string | null;
  checkoutId?: string | null;
  externalId?: string | null;
  kind: CreditLedgerEntryKind;
  metadata?: unknown;
  subscriptionId?: string | null;
  userId: string;
}) {
  try {
    const [created] = await db
      .insert(creditLedger)
      .values({
        aiUsageId: aiUsageId ?? null,
        amount,
        balanceNote: balanceNote ?? null,
        checkoutId: checkoutId ?? null,
        externalId: externalId ?? null,
        kind,
        metadata: metadata ?? null,
        subscriptionId: subscriptionId ?? null,
        userId,
      })
      .onConflictDoNothing({
        target: creditLedger.externalId,
      })
      .returning();

    if (created) {
      return created;
    }

    if (!externalId) {
      return null;
    }

    const [existing] = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.externalId, externalId))
      .limit(1);

    return existing ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create credit ledger entry"
    );
  }
}

export async function resetAndGrantCreditsForCycle({
  amount,
  checkoutId,
  grantExternalId,
  note,
  subscriptionId,
  userId,
}: {
  amount: number;
  checkoutId?: string | null;
  grantExternalId: string;
  note: string;
  subscriptionId: string;
  userId: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [existingGrant] = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.externalId, grantExternalId))
        .limit(1);

      if (existingGrant) {
        return { granted: false };
      }

      const [balanceRow] = await tx
        .select({
          balance:
            sql<number>`coalesce(sum(${creditLedger.amount}), 0)`.mapWith(Number),
        })
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId));

      const currentBalance = balanceRow?.balance ?? 0;

      if (currentBalance !== 0) {
        await tx.insert(creditLedger).values({
          amount: -currentBalance,
          balanceNote: "Reset credits for new billing cycle",
          checkoutId: checkoutId ?? null,
          externalId: `${grantExternalId}:reset`,
          kind: "reset",
          metadata: { previousBalance: currentBalance },
          subscriptionId,
          userId,
        });
      }

      await tx.insert(creditLedger).values({
        amount,
        balanceNote: note,
        checkoutId: checkoutId ?? null,
        externalId: grantExternalId,
        kind: "grant",
        metadata: { amount },
        subscriptionId,
        userId,
      });

      return { granted: true };
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to reset and grant credits for cycle"
    );
  }
}

export async function createAiGenerationUsage({
  cachedInputTokens,
  chatId,
  checkoutId,
  completionTokens,
  costMicrosUsd,
  creditCost,
  generationId,
  modelId,
  promptTokens,
  providerMetadata,
  providerName,
  reasoningTokens,
  responseBody,
  subscriptionId,
  totalTokens,
  usageKind,
  userId,
}: {
  cachedInputTokens?: number;
  chatId?: string | null;
  checkoutId?: string | null;
  completionTokens?: number;
  costMicrosUsd?: number | null;
  creditCost: number;
  generationId?: string | null;
  modelId: string;
  promptTokens?: number;
  providerMetadata?: unknown;
  providerName?: string | null;
  reasoningTokens?: number;
  responseBody?: unknown;
  subscriptionId?: string | null;
  totalTokens?: number;
  usageKind: UsageKind;
  userId: string;
}) {
  try {
    const [created] = await db
      .insert(aiGenerationUsage)
      .values({
        cachedInputTokens: cachedInputTokens ?? 0,
        chatId: chatId ?? null,
        checkoutId: checkoutId ?? null,
        completionTokens: completionTokens ?? 0,
        costMicrosUsd: costMicrosUsd ?? null,
        creditCost,
        generationId: generationId ?? null,
        modelId,
        promptTokens: promptTokens ?? 0,
        providerMetadata: providerMetadata ?? null,
        providerName: providerName ?? null,
        reasoningTokens: reasoningTokens ?? 0,
        responseBody: responseBody ?? null,
        subscriptionId: subscriptionId ?? null,
        totalTokens: totalTokens ?? 0,
        usageKind,
        userId,
      })
      .returning();

    return created ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create AI generation usage"
    );
  }
}

export async function getLatestSuccessfulCheckoutForUser({
  userId,
}: {
  userId: string;
}) {
  try {
    const [row] = await db
      .select()
      .from(billingCheckout)
      .where(
        and(
          eq(billingCheckout.userId, userId),
          eq(billingCheckout.status, "paid")
        )
      )
      .orderBy(desc(billingCheckout.paidAt), desc(billingCheckout.createdAt))
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get latest successful checkout"
    );
  }
}
