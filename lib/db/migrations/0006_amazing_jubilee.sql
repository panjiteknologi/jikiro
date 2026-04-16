ALTER TABLE "AttachmentAsset" ALTER COLUMN "chatId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "AttachmentChunk" ALTER COLUMN "chatId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "AttachmentAsset" ADD COLUMN "projectId" uuid;--> statement-breakpoint
ALTER TABLE "AttachmentChunk" ADD COLUMN "projectId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AttachmentAsset" ADD CONSTRAINT "AttachmentAsset_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AttachmentChunk" ADD CONSTRAINT "AttachmentChunk_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AttachmentAsset_projectId_idx" ON "AttachmentAsset" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AttachmentChunk_projectId_userId_idx" ON "AttachmentChunk" USING btree ("projectId","userId");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AttachmentAsset" ADD CONSTRAINT "AttachmentAsset_chat_or_project_chk" CHECK (("chatId" IS NOT NULL) <> ("projectId" IS NOT NULL));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AttachmentChunk" ADD CONSTRAINT "AttachmentChunk_chat_or_project_chk" CHECK (("chatId" IS NOT NULL) <> ("projectId" IS NOT NULL));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AttachmentAsset_projectText_unique_idx" ON "AttachmentAsset" ("projectId") WHERE "contentType" = 'text/plain' AND "projectId" IS NOT NULL;