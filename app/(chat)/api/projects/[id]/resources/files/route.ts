import { after, NextResponse } from "next/server";
import { start } from "workflow/api";

import { auth } from "@/app/(auth)/auth";
import {
  isReadableDocumentMimeType,
  MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES,
  SUPPORTED_READABLE_DOCUMENT_MIME_TYPES,
} from "@/lib/attachments";
import { resolveBillingState } from "@/lib/billing/service";
import {
  createAttachmentAsset,
  deleteAttachmentAssetById,
  getAttachmentAssetsByProjectId,
  getProjectById,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import {
  buildProjectUploadKey,
  deleteFileFromS3,
  uploadFileToS3,
} from "@/lib/storage/s3";
import { generateUUID } from "@/lib/utils";
import { ingestAttachmentAssetWorkflow } from "@/workflows/attachment-ingestion";
import { runAttachmentAssetIngestion } from "@/workflows/attachment-ingestion-steps";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id } = await params;
  const project = await getProjectById({ id, userId: session.user.id });

  if (!project) {
    return new ChatbotError("not_found:project").toResponse();
  }

  const assets = await getAttachmentAssetsByProjectId({
    projectId: id,
    userId: session.user.id,
  });

  return NextResponse.json(
    assets
      .filter((asset) => asset.contentType !== "text/plain")
      .map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        status: asset.status,
        error: asset.error,
        createdAt: asset.createdAt,
      }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatbotError("unauthorized:project").toResponse();
  }

  const { id: projectId } = await params;
  const project = await getProjectById({
    id: projectId,
    userId: session.user.id,
  });

  if (!project) {
    return new ChatbotError("not_found:project").toResponse();
  }

  if (request.body === null) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  const formData = await request.formData();
  const rawFile = formData.get("file");

  if (!(rawFile instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const file = rawFile as File;

  if (!isReadableDocumentMimeType(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Allowed: ${SUPPORTED_READABLE_DOCUMENT_MIME_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const billingState = await resolveBillingState({
    userId: session.user.id,
    userType: session.user.type,
  });

  const maxSize =
    billingState.entitlements.attachmentLimits.maxDocumentSizeBytes ??
    MAX_DOCUMENT_ATTACHMENT_SIZE_BYTES;

  if (file.size > maxSize) {
    const maxSizeInMb = Math.round(maxSize / (1024 * 1024));
    return NextResponse.json(
      { error: `File size must be less than ${maxSizeInMb}MB` },
      { status: 400 }
    );
  }

  if (
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

  const filename = file.name;
  const assetId = generateUUID();
  const { key, pathname } = buildProjectUploadKey({
    userId: session.user.id,
    projectId,
    fileId: assetId,
    filename,
  });
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadFileToS3({
      key,
      body: buffer,
      contentType: file.type,
      filename: pathname,
    });
  } catch (_error) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  let created: Awaited<ReturnType<typeof createAttachmentAsset>>;
  try {
    created = await createAttachmentAsset({
      id: assetId,
      userId: session.user.id,
      projectId,
      chatId: null,
      storageKey: key,
      filename: pathname,
      contentType: file.type,
      sizeBytes: file.size,
      status: "uploaded",
    });
  } catch (error) {
    await deleteFileFromS3(key).catch(() => undefined);
    throw error;
  }

  const workflowInput = {
    attachmentId: created.id,
    userId: session.user.id,
    userType: session.user.type,
  };

  if (shouldUseDirectIngestionFallback()) {
    after(async () => {
      try {
        await runAttachmentAssetIngestion(workflowInput);
      } catch (error) {
        console.error("Direct project attachment ingestion failed", {
          attachmentId: created.id,
          projectId,
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
          id: created.id,
          userId: session.user.id,
        }),
      ]);
      return NextResponse.json(
        { error: "Failed to start document processing" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    id: created.id,
    filename: created.filename,
    contentType: created.contentType,
    sizeBytes: created.sizeBytes,
    status: created.status,
    createdAt: created.createdAt,
  });
}

function shouldUseDirectIngestionFallback() {
  return (process.env.WORKFLOW_TARGET_WORLD ?? "local") === "local";
}
