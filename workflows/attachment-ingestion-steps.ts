import { embedMany } from "ai";
import { FatalError } from "workflow";
import type { UserType } from "@/app/(auth)/auth";
import { getEmbeddingModel } from "@/lib/ai/providers";
import {
  ATTACHMENT_EMBEDDING_MODEL_ID,
  assertAttachmentEmbeddingsDimensions,
  isReadableDocumentMimeType,
} from "@/lib/attachments";
import { recordAiUsage } from "@/lib/billing/service";
import {
  chunkExtractedDocumentText,
  extractReadableDocumentText,
} from "@/lib/attachments/ingestion";
import {
  getAttachmentAssetsByIds,
  replaceAttachmentChunks,
  updateAttachmentAssetStatus,
} from "@/lib/db/queries";
import { getFileBufferFromS3 } from "@/lib/storage/s3";

export type AttachmentWorkflowInput = {
  attachmentId: string;
  userId: string;
  userType: UserType;
};

type ExtractedAttachmentResult =
  | {
      skipped: true;
    }
  | {
      chatId: string;
      skipped: false;
      text: string;
      truncated: boolean;
    };

export async function runAttachmentAssetIngestion({
  attachmentId,
  userId,
  userType,
}: AttachmentWorkflowInput) {
  try {
    const extracted = await extractAttachmentTextStep({
      attachmentId,
      userId,
      userType,
    });

    if (extracted.skipped) {
      return { attachmentId, status: "skipped" as const };
    }

    await indexAttachmentTextStep({
      attachmentId,
      chatId: extracted.chatId,
      text: extracted.text,
      truncated: extracted.truncated,
      userId,
      userType,
    });

    return { attachmentId, status: "ready" as const };
  } catch (error) {
    await failAttachmentIngestionStep({
      attachmentId,
      message:
        error instanceof Error ? error.message : "Attachment ingestion failed",
    });

    throw error;
  }
}

export async function extractAttachmentTextStep({
  attachmentId,
  userId,
  userType: _userType,
}: AttachmentWorkflowInput): Promise<ExtractedAttachmentResult> {
  "use step";

  await updateAttachmentAssetStatus({
    id: attachmentId,
    status: "extracting",
  });

  const [asset] = await getAttachmentAssetsByIds({
    ids: [attachmentId],
    userId,
  });

  if (!asset) {
    return { skipped: true };
  }

  if (!isReadableDocumentMimeType(asset.contentType)) {
    throw new FatalError(
      `Unsupported readable document type: ${asset.contentType}`
    );
  }

  try {
    const { buffer } = await getFileBufferFromS3(asset.storageKey);
    const extracted = await extractReadableDocumentText({
      buffer,
      contentType: asset.contentType,
    });

    return {
      chatId: asset.chatId,
      skipped: false,
      text: extracted.text,
      truncated: extracted.truncated,
    };
  } catch (error) {
    if (isS3NotFoundError(error)) {
      return { skipped: true };
    }

    if (error instanceof FatalError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new FatalError(error.message);
    }

    throw error;
  }
}

export async function indexAttachmentTextStep({
  attachmentId,
  chatId,
  text,
  truncated,
  userId,
  userType,
}: {
  attachmentId: string;
  chatId: string;
  text: string;
  truncated: boolean;
  userId: string;
  userType: UserType;
}) {
  "use step";

  const chunks = chunkExtractedDocumentText(text);

  if (chunks.length === 0) {
    throw new FatalError(
      "No readable text chunks could be created from this file"
    );
  }

  const embeddingModel = getEmbeddingModel();
  const { embeddings, providerMetadata, responses, usage } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

  assertAttachmentEmbeddingsDimensions(embeddings);

  await updateAttachmentAssetStatus({
    id: attachmentId,
    status: "indexing",
    extractedText: text,
    truncated,
  });

  await replaceAttachmentChunks({
    attachmentId,
    chatId,
    chunks: chunks.map((chunk, index) => ({
      embedding: embeddings[index],
      text: chunk,
    })),
    userId,
  });

  await updateAttachmentAssetStatus({
    id: attachmentId,
    status: "ready",
    extractedText: text,
    truncated,
  });

  await recordAiUsage({
    chatId,
    modelId: ATTACHMENT_EMBEDDING_MODEL_ID,
    promptTokens: usage.tokens,
    providerMetadata,
    providerName: ATTACHMENT_EMBEDDING_MODEL_ID.split("/")[0],
    responseBody: responses?.map((response) => response?.body ?? null) ?? null,
    totalTokens: usage.tokens,
    usageKind: "attachment_embedding",
    userId,
    userType,
  });
}

export async function failAttachmentIngestionStep({
  attachmentId,
  message,
}: {
  attachmentId: string;
  message: string;
}) {
  "use step";

  await updateAttachmentAssetStatus({
    id: attachmentId,
    status: "failed",
    error: message.slice(0, 500),
  });
}

function isS3NotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata &&
    error.$metadata.httpStatusCode === 404
  );
}
