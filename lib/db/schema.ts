import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  customType,
  foreignKey,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  ATTACHMENT_ASSET_STATUSES,
  ATTACHMENT_EMBEDDING_DIMENSIONS,
  SUPPORTED_ATTACHMENT_MIME_TYPES,
} from "@/lib/attachments";
import type { PlanSnapshot } from "@/lib/billing/types";
import {
  billingIntervals,
  checkoutStatuses,
  creditLedgerEntryKinds,
  planSlugs,
  subscriptionStatuses,
  usageKinds,
} from "@/lib/billing/types";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  selectedModelIds: json("selectedModelIds").$type<string[]>(),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const planSlugEnum = pgEnum("PlanSlug", planSlugs);
export const billingIntervalEnum = pgEnum("BillingInterval", billingIntervals);
export const subscriptionStatusEnum = pgEnum(
  "SubscriptionStatus",
  subscriptionStatuses
);
export const checkoutStatusEnum = pgEnum("CheckoutStatus", checkoutStatuses);
export const creditLedgerEntryKindEnum = pgEnum(
  "CreditLedgerEntryKind",
  creditLedgerEntryKinds
);
export const usageKindEnum = pgEnum("AiUsageKind", usageKinds);

export const billingCheckout = pgTable(
  "BillingCheckout",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    planSlug: planSlugEnum("planSlug").notNull(),
    interval: billingIntervalEnum("interval").notNull(),
    status: checkoutStatusEnum("status").notNull().default("pending"),
    merchantRef: varchar("merchantRef", { length: 128 }).notNull(),
    tripayReference: varchar("tripayReference", { length: 128 }),
    paymentMethod: varchar("paymentMethod", { length: 64 }),
    paymentName: text("paymentName"),
    checkoutUrl: text("checkoutUrl"),
    payCode: text("payCode"),
    payUrl: text("payUrl"),
    callbackUrl: text("callbackUrl"),
    returnUrl: text("returnUrl"),
    amountIdr: integer("amountIdr").notNull(),
    feeMerchantIdr: integer("feeMerchantIdr"),
    feeCustomerIdr: integer("feeCustomerIdr"),
    amountReceivedIdr: integer("amountReceivedIdr"),
    currency: varchar("currency", { length: 8 }).notNull().default("IDR"),
    expiresAt: timestamp("expiresAt"),
    paidAt: timestamp("paidAt"),
    planSnapshot: json("planSnapshot").$type<PlanSnapshot>().notNull(),
    rawRequest: json("rawRequest"),
    rawResponse: json("rawResponse"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    merchantRefIdx: uniqueIndex("BillingCheckout_merchantRef_idx").on(
      table.merchantRef
    ),
    tripayReferenceIdx: uniqueIndex("BillingCheckout_tripayReference_idx").on(
      table.tripayReference
    ),
  })
);

export type BillingCheckout = InferSelectModel<typeof billingCheckout>;

export const subscription = pgTable(
  "Subscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    planSlug: planSlugEnum("planSlug").notNull(),
    interval: billingIntervalEnum("interval").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodStart: timestamp("currentPeriodStart").notNull(),
    currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
    planSnapshot: json("planSnapshot").$type<PlanSnapshot>().notNull(),
    lastCheckoutId: uuid("lastCheckoutId").references(() => billingCheckout.id),
    cancelledAt: timestamp("cancelledAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("Subscription_userId_idx").on(table.userId),
  })
);

export type Subscription = InferSelectModel<typeof subscription>;

export const billingEvent = pgTable(
  "BillingEvent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId").references(() => user.id),
    checkoutId: uuid("checkoutId").references(() => billingCheckout.id),
    eventKey: varchar("eventKey", { length: 191 }).notNull(),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    signature: text("signature"),
    headers: json("headers"),
    payload: json("payload").notNull(),
    processedAt: timestamp("processedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    eventKeyIdx: uniqueIndex("BillingEvent_eventKey_idx").on(table.eventKey),
  })
);

export type BillingEvent = InferSelectModel<typeof billingEvent>;

export const creditLedger = pgTable(
  "CreditLedger",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    subscriptionId: uuid("subscriptionId").references(() => subscription.id),
    checkoutId: uuid("checkoutId").references(() => billingCheckout.id),
    aiUsageId: uuid("aiUsageId"),
    kind: creditLedgerEntryKindEnum("kind").notNull(),
    amount: integer("amount").notNull(),
    balanceNote: text("balanceNote"),
    externalId: varchar("externalId", { length: 191 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("CreditLedger_externalId_idx").on(
      table.externalId
    ),
  })
);

export type CreditLedger = InferSelectModel<typeof creditLedger>;

export const aiGenerationUsage = pgTable("AiGenerationUsage", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  subscriptionId: uuid("subscriptionId").references(() => subscription.id),
  checkoutId: uuid("checkoutId").references(() => billingCheckout.id),
  chatId: uuid("chatId"),
  usageKind: usageKindEnum("usageKind").notNull(),
  modelId: text("modelId").notNull(),
  providerName: varchar("providerName", { length: 64 }),
  generationId: varchar("generationId", { length: 191 }),
  promptTokens: integer("promptTokens").notNull().default(0),
  completionTokens: integer("completionTokens").notNull().default(0),
  totalTokens: integer("totalTokens").notNull().default(0),
  reasoningTokens: integer("reasoningTokens").notNull().default(0),
  cachedInputTokens: integer("cachedInputTokens").notNull().default(0),
  costMicrosUsd: integer("costMicrosUsd"),
  creditCost: integer("creditCost").notNull().default(0),
  providerMetadata: json("providerMetadata"),
  responseBody: json("responseBody"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type AiGenerationUsage = InferSelectModel<typeof aiGenerationUsage>;

export const project = pgTable("Project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  systemPrompt: text("systemPrompt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Project = InferSelectModel<typeof project>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  projectId: uuid("projectId").references(() => project.id, {
    onDelete: "set null",
  }),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const attachmentAssetStatusEnum = pgEnum(
  "AttachmentAssetStatus",
  ATTACHMENT_ASSET_STATUSES
);

const pgVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${ATTACHMENT_EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map((entry) => Number.parseFloat(entry));
  },
});

export const attachmentAsset = pgTable(
  "AttachmentAsset",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId").notNull(),
    storageKey: text("storageKey").notNull(),
    filename: text("filename").notNull(),
    contentType: varchar("contentType", {
      enum: SUPPORTED_ATTACHMENT_MIME_TYPES,
    }).notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    status: attachmentAssetStatusEnum("status").notNull().default("uploaded"),
    extractedText: text("extractedText"),
    error: text("error"),
    truncated: boolean("truncated").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    storageKeyIdx: uniqueIndex("AttachmentAsset_storageKey_idx").on(
      table.storageKey
    ),
  })
);

export type AttachmentAsset = InferSelectModel<typeof attachmentAsset>;

export const attachmentChunk = pgTable(
  "AttachmentChunk",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    attachmentId: uuid("attachmentId")
      .notNull()
      .references(() => attachmentAsset.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId").notNull(),
    chunkIndex: integer("chunkIndex").notNull(),
    text: text("text").notNull(),
    embedding: pgVector("embedding").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    attachmentChunkIdx: uniqueIndex("AttachmentChunk_attachment_chunk_idx").on(
      table.attachmentId,
      table.chunkIndex
    ),
  })
);

export type AttachmentChunk = InferSelectModel<typeof attachmentChunk>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;
