import { embedMany } from "ai";
import { FatalError } from "workflow";
import { getEmbeddingModel } from "@/lib/ai/providers";
import { isReadableDocumentMimeType } from "@/lib/attachments";
import {
  chunkExtractedDocumentText,
  extractReadableDocumentText,
} from "@/lib/attachments/ingestion";
import {
  getAttachmentAssetsByIds,
  replaceAttachmentChunks,
  updateAttachmentAssetStatus,
} from "@/lib/db/queries";
import { getFileFromS3 } from "@/lib/storage/s3";

type AttachmentWorkflowInput = {
  attachmentId: string;
  userId: string;
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

export async function ingestAttachmentAssetWorkflow({
  attachmentId,
  userId,
}: AttachmentWorkflowInput) {
  "use workflow";

  try {
    const extracted = await extractAttachmentTextStep({
      attachmentId,
      userId,
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

async function extractAttachmentTextStep({
  attachmentId,
  userId,
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
    const object = await getFileFromS3(asset.storageKey);

    if (!object.Body) {
      return { skipped: true };
    }

    const body = await object.Body.transformToByteArray();
    const extracted = await extractReadableDocumentText({
      buffer: Buffer.from(body),
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

async function indexAttachmentTextStep({
  attachmentId,
  chatId,
  text,
  truncated,
  userId,
}: {
  attachmentId: string;
  chatId: string;
  text: string;
  truncated: boolean;
  userId: string;
}) {
  "use step";

  const chunks = chunkExtractedDocumentText(text);

  if (chunks.length === 0) {
    throw new FatalError(
      "No readable text chunks could be created from this file"
    );
  }

  const embeddingModel = getEmbeddingModel();
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });

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
}

async function failAttachmentIngestionStep({
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
