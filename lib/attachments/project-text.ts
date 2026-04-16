import "server-only";

import { embedMany } from "ai";
import type { UserType } from "@/app/(auth)/auth";
import { getEmbeddingModel } from "@/lib/ai/providers";
import {
  ATTACHMENT_EMBEDDING_MODEL_ID,
  assertAttachmentEmbeddingsDimensions,
} from "@/lib/attachments";
import { chunkExtractedDocumentText } from "@/lib/attachments/ingestion";
import { recordAiUsage } from "@/lib/billing/service";
import {
  replaceAttachmentChunks,
  updateAttachmentAssetStatus,
} from "@/lib/db/queries";

export async function indexProjectTextAsset({
  assetId,
  projectId,
  text,
  userId,
  userType,
}: {
  assetId: string;
  projectId: string;
  text: string;
  userId: string;
  userType: UserType;
}) {
  try {
    const chunks = chunkExtractedDocumentText(text);

    if (chunks.length === 0) {
      await updateAttachmentAssetStatus({
        id: assetId,
        status: "failed",
        error: "No readable text could be indexed from the provided content.",
      });
      return;
    }

    const embeddingModel = getEmbeddingModel();
    const { embeddings, providerMetadata, responses, usage } = await embedMany({
      model: embeddingModel,
      values: chunks,
    });

    assertAttachmentEmbeddingsDimensions(embeddings);

    await replaceAttachmentChunks({
      attachmentId: assetId,
      projectId,
      chunks: chunks.map((chunk, index) => ({
        embedding: embeddings[index],
        text: chunk,
      })),
      userId,
    });

    await updateAttachmentAssetStatus({
      id: assetId,
      status: "ready",
      extractedText: text,
      truncated: false,
    });

    await recordAiUsage({
      chatId: null,
      modelId: ATTACHMENT_EMBEDDING_MODEL_ID,
      promptTokens: usage.tokens,
      providerMetadata,
      providerName: ATTACHMENT_EMBEDDING_MODEL_ID.split("/")[0],
      responseBody:
        responses?.map((response) => response?.body ?? null) ?? null,
      totalTokens: usage.tokens,
      usageKind: "attachment_embedding",
      userId,
      userType,
    });
  } catch (error) {
    await updateAttachmentAssetStatus({
      id: assetId,
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Failed to index project text resource.",
    });
    throw error;
  }
}
