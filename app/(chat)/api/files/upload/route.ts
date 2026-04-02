import { after, NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  isReadableDocumentMimeType,
  isSupportedAttachmentMimeType,
  SUPPORTED_ATTACHMENT_MIME_TYPES,
} from "@/lib/attachments";
import { resolveBillingState } from "@/lib/billing/service";
import {
  getAttachmentAssetCountByChatId,
  createAttachmentAsset,
  deleteAttachmentAssetById,
  getChatById,
} from "@/lib/db/queries";
import {
  buildChatUploadKey,
  deleteFileFromS3,
  getInternalFileUrl,
  uploadFileToS3,
} from "@/lib/storage/s3";
import { generateUUID } from "@/lib/utils";
import { ingestAttachmentAssetWorkflow } from "@/workflows/attachment-ingestion";
import { runAttachmentAssetIngestion } from "@/workflows/attachment-ingestion-steps";

const UploadRequestSchema = z.object({
  chatId: z.string().uuid(),
  file: z.instanceof(Blob),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const rawFile = formData.get("file");
    const rawChatId = formData.get("chatId");

    if (!rawFile || !(rawFile instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const parsedRequest = UploadRequestSchema.safeParse({
      chatId: rawChatId,
      file: rawFile,
    });

    if (!parsedRequest.success) {
      const errorMessage = parsedRequest.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { chatId, file } = parsedRequest.data;
    const chat = await getChatById({ id: chatId });
    const billingState = await resolveBillingState({
      userId: session.user.id,
      userType: session.user.type,
    });

    if (chat && chat.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isSupportedAttachmentMimeType(file.type)) {
      return NextResponse.json(
        {
          error: `File type should be one of: ${SUPPORTED_ATTACHMENT_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const currentAttachmentCount = await getAttachmentAssetCountByChatId({
      chatId,
      userId: session.user.id,
    });

    if (
      currentAttachmentCount >= billingState.entitlements.attachmentLimits.maxFilesPerChat
    ) {
      return NextResponse.json(
        {
          error: `Your current plan allows up to ${billingState.entitlements.attachmentLimits.maxFilesPerChat} files per chat.`,
        },
        { status: 403 }
      );
    }

    const maxSize = isReadableDocumentMimeType(file.type)
      ? billingState.entitlements.attachmentLimits.maxDocumentSizeBytes
      : billingState.entitlements.attachmentLimits.maxImageSizeBytes;

    if (file.size > maxSize) {
      const maxSizeInMb = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File size should be less than ${maxSizeInMb}MB` },
        { status: 400 }
      );
    }

    if (
      isReadableDocumentMimeType(file.type) &&
      billingState.remainingCredits !== null &&
      billingState.remainingCredits <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have enough AI credits to process another document. Upgrade or wait for your next cycle.",
        },
        { status: 403 }
      );
    }

    const filename = (rawFile as File).name;
    const { key, pathname } = buildChatUploadKey({
      userId: session.user.id,
      fileId: generateUUID(),
      filename,
    });
    const fileBuffer = await file.arrayBuffer();

    try {
      await uploadFileToS3({
        key,
        body: Buffer.from(fileBuffer),
        contentType: file.type,
        filename: pathname,
      });

      const createdAttachment = await createAttachmentAsset({
        id: generateUUID(),
        userId: session.user.id,
        chatId,
        storageKey: key,
        filename: pathname,
        contentType: file.type,
        sizeBytes: file.size,
        status: isReadableDocumentMimeType(file.type) ? "uploaded" : "ready",
      }).catch(async (error) => {
        await deleteFileFromS3(key).catch(() => undefined);
        throw error;
      });

      if (isReadableDocumentMimeType(file.type)) {
        const workflowInput = {
          attachmentId: createdAttachment.id,
          userId: session.user.id,
          userType: session.user.type,
        };

        if (shouldUseDirectIngestionFallback()) {
          after(async () => {
            try {
              await runAttachmentAssetIngestion(workflowInput);
            } catch (error) {
              console.error("Direct attachment ingestion failed", {
                attachmentId: createdAttachment.id,
                error,
              });
            }
          });
        } else {
          try {
            await start(ingestAttachmentAssetWorkflow, [workflowInput]);
          } catch (_error) {
            await Promise.allSettled([
              deleteFileFromS3(key),
              deleteAttachmentAssetById({
                id: createdAttachment.id,
                userId: session.user.id,
              }),
            ]);

            return NextResponse.json(
              { error: "Failed to start document processing" },
              { status: 500 }
            );
          }
        }
      }

      return NextResponse.json({
        id: createdAttachment.id,
        url: getInternalFileUrl(key),
        pathname,
        contentType: file.type,
        status: createdAttachment.status,
      });
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

function shouldUseDirectIngestionFallback() {
  return (process.env.WORKFLOW_TARGET_WORLD ?? "local") === "local";
}
