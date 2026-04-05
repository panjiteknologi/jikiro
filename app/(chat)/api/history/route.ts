import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteAllChatsByUserId,
  deleteAttachmentAssetsByUserId,
  getAttachmentAssetsByUserId,
  getChatIdsByUserId,
  getChatsByUserId,
  getMessagesByChatIds,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import {
  deleteFilesFromS3BestEffort,
  extractUniqueStorageKeysFromMessages,
} from "@/lib/storage/s3";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1),
    50
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const projectIdParam = searchParams.get("project_id");
  const projectId =
    projectIdParam === null ? undefined : projectIdParam || undefined;

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter,
    endingBefore,
    projectId,
  });

  return Response.json(chats);
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const [chatIds, attachmentAssets] = await Promise.all([
    getChatIdsByUserId({ userId: session.user.id }),
    getAttachmentAssetsByUserId({ userId: session.user.id }),
  ]);

  if (chatIds.length > 0 || attachmentAssets.length > 0) {
    const messages =
      chatIds.length > 0 ? await getMessagesByChatIds({ ids: chatIds }) : [];
    const storageKeys = [
      ...new Set([
        ...extractUniqueStorageKeysFromMessages({
          messages,
          userId: session.user.id,
        }),
        ...attachmentAssets.map((attachment) => attachment.storageKey),
      ]),
    ];

    await deleteFilesFromS3BestEffort({
      keys: storageKeys,
      context: {
        userId: session.user.id,
        operation: "delete-all-chats",
        chatCount: chatIds.length,
      },
    });
  }

  await deleteAttachmentAssetsByUserId({ userId: session.user.id });
  const result = await deleteAllChatsByUserId({ userId: session.user.id });

  return Response.json(result, { status: 200 });
}
