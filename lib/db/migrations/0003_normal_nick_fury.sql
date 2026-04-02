DO $$ BEGIN
 CREATE TYPE "public"."BillingInterval" AS ENUM('monthly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."CheckoutStatus" AS ENUM('pending', 'paid', 'failed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."CreditLedgerEntryKind" AS ENUM('grant', 'usage', 'reset', 'adjustment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."PlanSlug" AS ENUM('free', 'pro', 'max');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."SubscriptionStatus" AS ENUM('active', 'pending', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."AiUsageKind" AS ENUM('chat_generation', 'retrieval_embedding', 'attachment_embedding');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AiGenerationUsage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"subscriptionId" uuid,
	"checkoutId" uuid,
	"chatId" uuid,
	"usageKind" "AiUsageKind" NOT NULL,
	"modelId" text NOT NULL,
	"providerName" varchar(64),
	"generationId" varchar(191),
	"promptTokens" integer DEFAULT 0 NOT NULL,
	"completionTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL,
	"reasoningTokens" integer DEFAULT 0 NOT NULL,
	"cachedInputTokens" integer DEFAULT 0 NOT NULL,
	"costMicrosUsd" integer,
	"creditCost" integer DEFAULT 0 NOT NULL,
	"providerMetadata" json,
	"responseBody" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BillingCheckout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"planSlug" "PlanSlug" NOT NULL,
	"interval" "BillingInterval" NOT NULL,
	"status" "CheckoutStatus" DEFAULT 'pending' NOT NULL,
	"merchantRef" varchar(128) NOT NULL,
	"tripayReference" varchar(128),
	"paymentMethod" varchar(64),
	"paymentName" text,
	"checkoutUrl" text,
	"payCode" text,
	"payUrl" text,
	"callbackUrl" text,
	"returnUrl" text,
	"amountIdr" integer NOT NULL,
	"feeMerchantIdr" integer,
	"feeCustomerIdr" integer,
	"amountReceivedIdr" integer,
	"currency" varchar(8) DEFAULT 'IDR' NOT NULL,
	"expiresAt" timestamp,
	"paidAt" timestamp,
	"planSnapshot" json NOT NULL,
	"rawRequest" json,
	"rawResponse" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "BillingEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"checkoutId" uuid,
	"eventKey" varchar(191) NOT NULL,
	"eventType" varchar(64) NOT NULL,
	"signature" text,
	"headers" json,
	"payload" json NOT NULL,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CreditLedger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"subscriptionId" uuid,
	"checkoutId" uuid,
	"aiUsageId" uuid,
	"kind" "CreditLedgerEntryKind" NOT NULL,
	"amount" integer NOT NULL,
	"balanceNote" text,
	"externalId" varchar(191),
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"planSlug" "PlanSlug" NOT NULL,
	"interval" "BillingInterval" NOT NULL,
	"status" "SubscriptionStatus" DEFAULT 'active' NOT NULL,
	"currentPeriodStart" timestamp NOT NULL,
	"currentPeriodEnd" timestamp NOT NULL,
	"planSnapshot" json NOT NULL,
	"lastCheckoutId" uuid,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AiGenerationUsage" ADD CONSTRAINT "AiGenerationUsage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AiGenerationUsage" ADD CONSTRAINT "AiGenerationUsage_subscriptionId_Subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AiGenerationUsage" ADD CONSTRAINT "AiGenerationUsage_checkoutId_BillingCheckout_id_fk" FOREIGN KEY ("checkoutId") REFERENCES "public"."BillingCheckout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_checkoutId_BillingCheckout_id_fk" FOREIGN KEY ("checkoutId") REFERENCES "public"."BillingCheckout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_subscriptionId_Subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_checkoutId_BillingCheckout_id_fk" FOREIGN KEY ("checkoutId") REFERENCES "public"."BillingCheckout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_lastCheckoutId_BillingCheckout_id_fk" FOREIGN KEY ("lastCheckoutId") REFERENCES "public"."BillingCheckout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCheckout_merchantRef_idx" ON "BillingCheckout" USING btree ("merchantRef");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCheckout_tripayReference_idx" ON "BillingCheckout" USING btree ("tripayReference");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_eventKey_idx" ON "BillingEvent" USING btree ("eventKey");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_externalId_idx" ON "CreditLedger" USING btree ("externalId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription" USING btree ("userId");