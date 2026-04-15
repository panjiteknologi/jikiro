import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
  sql,
} from "drizzle-orm";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import type {
  AttachmentAssetStatus,
  SupportedAttachmentMimeType,
} from "@/lib/attachments";
import { assertAttachmentEmbeddingDimensions } from "@/lib/attachments";
import type { RetrievedDocumentChunk } from "@/lib/attachments/ingestion";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import { db } from "./client";
import {
  attachmentAsset,
  attachmentChunk,
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Project,
  project,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

const legacyUserSelection = {
  createdAt: user.createdAt,
  email: user.email,
  emailVerified: user.emailVerified,
  id: user.id,
  image: user.image,
  isAnonymous: user.isAnonymous,
  name: user.name,
  password: user.password,
  selectedModelIds: sql<string[] | null>`null`.as("selectedModelIds"),
  updatedAt: user.updatedAt,
};

function isMissingSelectedModelIdsColumn(error: unknown) {
  return (
    error instanceof Error &&
    /selectedModelIds|column .*selectedModelIds/i.test(error.message)
  );
}

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    if (isMissingSelectedModelIdsColumn(error)) {
      const rows = await db
        .select(legacyUserSelection)
        .from(user)
        .where(eq(user.email, email));

      return rows as User[];
    }

    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById({ userId }: { userId: string }) {
  try {
    const [row] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return row ?? null;
  } catch (error) {
    if (isMissingSelectedModelIdsColumn(error)) {
      const [row] = await db
        .select(legacyUserSelection)
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      return (row as User | undefined) ?? null;
    }

    throw new ChatbotError("bad_request:database", "Failed to get user by id");
  }
}

export async function updateUserSelectedModelIds({
  selectedModelIds,
  userId,
}: {
  selectedModelIds: string[] | null;
  userId: string;
}) {
  try {
    const [updated] = await db
      .update(user)
      .set({
        selectedModelIds,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        selectedModelIds: user.selectedModelIds,
      });

    return updated ?? null;
  } catch (error) {
    if (isMissingSelectedModelIdsColumn(error)) {
      throw new ChatbotError(
        "bad_request:billing",
        "Custom model settings need the latest database migration. Run pnpm db:migrate first."
      );
    }

    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user selected models"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createOAuthUser({
  email,
  name,
  image,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    const [createdUser] = await db
      .insert(user)
      .values({
        email,
        password: null,
        name: name ?? null,
        image: image ?? null,
        emailVerified: true,
        isAnonymous: false,
      })
      .returning({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      });

    return createdUser;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create OAuth user"
    );
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  projectId?: string | null;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      projectId: projectId ?? null,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function getChatIdsByUserId({ userId }: { userId: string }) {
  try {
    const rows = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    return rows.map((row) => row.id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chat ids by user id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  projectId,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  projectId?: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const baseCondition =
      projectId !== undefined
        ? and(
            eq(chat.userId, id),
            projectId === null
              ? sql`${chat.projectId} is null`
              : eq(chat.projectId, projectId)
          )
        : eq(chat.userId, id);

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(whereCondition ? and(whereCondition, baseCondition) : baseCondition)
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function createAttachmentAsset({
  chatId,
  contentType,
  filename,
  id,
  sizeBytes,
  status,
  storageKey,
  userId,
}: {
  chatId: string;
  contentType: SupportedAttachmentMimeType;
  filename: string;
  id?: string;
  sizeBytes: number;
  status: AttachmentAssetStatus;
  storageKey: string;
  userId: string;
}) {
  try {
    const [createdAttachment] = await db
      .insert(attachmentAsset)
      .values({
        ...(id ? { id } : {}),
        userId,
        chatId,
        storageKey,
        filename,
        contentType,
        sizeBytes,
        status,
        updatedAt: new Date(),
      })
      .returning();

    return createdAttachment;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create attachment asset"
    );
  }
}

export async function getAttachmentAssetByStorageKey({
  storageKey,
  userId,
}: {
  storageKey: string;
  userId: string;
}) {
  try {
    const [selectedAttachment] = await db
      .select()
      .from(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.storageKey, storageKey),
          eq(attachmentAsset.userId, userId)
        )
      )
      .limit(1);

    return selectedAttachment ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get attachment asset by storage key"
    );
  }
}

export async function getAttachmentAssetsByIds({
  ids,
  userId,
}: {
  ids: string[];
  userId: string;
}) {
  try {
    if (ids.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.userId, userId),
          inArray(attachmentAsset.id, ids)
        )
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get attachment assets by ids"
    );
  }
}

export async function updateAttachmentAssetStatus({
  error,
  extractedText,
  id,
  status,
  truncated,
}: {
  error?: string | null;
  extractedText?: string | null;
  id: string;
  status: AttachmentAssetStatus;
  truncated?: boolean;
}) {
  try {
    const [updatedAttachment] = await db
      .update(attachmentAsset)
      .set({
        status,
        error: error ?? null,
        extractedText:
          typeof extractedText === "undefined"
            ? sql`${attachmentAsset.extractedText}`
            : extractedText,
        truncated:
          typeof truncated === "undefined"
            ? sql`${attachmentAsset.truncated}`
            : truncated,
        updatedAt: new Date(),
      })
      .where(eq(attachmentAsset.id, id))
      .returning();

    return updatedAttachment ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update attachment asset status"
    );
  }
}

export async function replaceAttachmentChunks({
  attachmentId,
  chatId,
  chunks,
  userId,
}: {
  attachmentId: string;
  chatId: string;
  chunks: { embedding: number[]; text: string }[];
  userId: string;
}) {
  try {
    for (const chunk of chunks) {
      assertAttachmentEmbeddingDimensions(chunk.embedding);
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(attachmentChunk)
        .where(eq(attachmentChunk.attachmentId, attachmentId));

      if (chunks.length === 0) {
        return;
      }

      await tx.insert(attachmentChunk).values(
        chunks.map((chunk, index) => ({
          attachmentId,
          userId,
          chatId,
          chunkIndex: index,
          text: chunk.text,
          embedding: chunk.embedding,
        }))
      );
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to replace attachment chunks"
    );
  }
}

export async function deleteAttachmentAssetById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [deletedAttachment] = await db
      .delete(attachmentAsset)
      .where(
        and(eq(attachmentAsset.id, id), eq(attachmentAsset.userId, userId))
      )
      .returning();

    return deletedAttachment ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete attachment asset by id"
    );
  }
}

export async function deleteAttachmentAssetByStorageKey({
  storageKey,
  userId,
}: {
  storageKey: string;
  userId: string;
}) {
  try {
    const [deletedAttachment] = await db
      .delete(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.storageKey, storageKey),
          eq(attachmentAsset.userId, userId)
        )
      )
      .returning();

    return deletedAttachment ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete attachment asset by storage key"
    );
  }
}

export async function deleteAttachmentAssetsByChatId({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    return await db
      .delete(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.chatId, chatId),
          eq(attachmentAsset.userId, userId)
        )
      )
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete attachment assets by chat id"
    );
  }
}

export async function deleteAttachmentAssetsByUserId({
  userId,
}: {
  userId: string;
}) {
  try {
    return await db
      .delete(attachmentAsset)
      .where(eq(attachmentAsset.userId, userId))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete attachment assets by user id"
    );
  }
}

export async function getAttachmentAssetsByChatId({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.chatId, chatId),
          eq(attachmentAsset.userId, userId)
        )
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get attachment assets by chat id"
    );
  }
}

export async function getAttachmentAssetCountByChatId({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  try {
    const [row] = await db
      .select({
        count: count(attachmentAsset.id),
      })
      .from(attachmentAsset)
      .where(
        and(
          eq(attachmentAsset.chatId, chatId),
          eq(attachmentAsset.userId, userId)
        )
      );

    return row?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get attachment asset count by chat id"
    );
  }
}

export async function getAttachmentAssetsByUserId({
  userId,
}: {
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(attachmentAsset)
      .where(eq(attachmentAsset.userId, userId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get attachment assets by user id"
    );
  }
}

export async function retrieveRelevantAttachmentChunks({
  attachmentIds,
  chatId,
  embedding,
  limit,
  userId,
}: {
  attachmentIds?: string[];
  chatId: string;
  embedding: number[];
  limit: number;
  userId: string;
}): Promise<RetrievedDocumentChunk[]> {
  try {
    assertAttachmentEmbeddingDimensions(embedding);

    const embeddingVector = JSON.stringify(embedding);
    const distance =
      sql<number>`${attachmentChunk.embedding} <=> ${sql`${embeddingVector}::vector`}`.as(
        "distance"
      );

    const rows: Array<RetrievedDocumentChunk & { distance: number }> = await db
      .select({
        attachmentId: attachmentChunk.attachmentId,
        filename: attachmentAsset.filename,
        text: attachmentChunk.text,
        distance,
      })
      .from(attachmentChunk)
      .innerJoin(
        attachmentAsset,
        eq(attachmentChunk.attachmentId, attachmentAsset.id)
      )
      .where(
        and(
          eq(attachmentChunk.userId, userId),
          eq(attachmentChunk.chatId, chatId),
          eq(attachmentAsset.status, "ready"),
          attachmentIds && attachmentIds.length > 0
            ? inArray(attachmentChunk.attachmentId, attachmentIds)
            : undefined
        )
      )
      .orderBy(distance)
      .limit(limit);

    return rows.map(({ attachmentId, filename, text }) => ({
      attachmentId,
      filename,
      text,
    }));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to retrieve relevant attachment chunks"
    );
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getMessagesByChatIds({ ids }: { ids: string[] }) {
  try {
    if (ids.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(message)
      .where(inArray(message.chatId, ids))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat ids"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export type MessageWindowCounts = {
  hour: number;
  fiveHours: number;
  week: number;
};

export async function getMessageCountsByUserId({
  id,
}: {
  id: string;
}): Promise<MessageWindowCounts> {
  try {
    const now = Date.now();
    const cutoff1h = new Date(now - 3_600_000);
    const cutoff5h = new Date(now - 18_000_000);
    const cutoff168h = new Date(now - 604_800_000);

    const [stats] = await db
      .select({
        hour: sql<number>`count(*) filter (where ${message.createdAt} >= ${cutoff1h.toISOString()})`.mapWith(
          Number
        ),
        fiveHours: sql<number>`count(*) filter (where ${message.createdAt} >= ${cutoff5h.toISOString()})`.mapWith(
          Number
        ),
        week: sql<number>`count(*)`.mapWith(Number),
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          eq(message.role, "user"),
          gte(message.createdAt, cutoff168h)
        )
      )
      .execute();

    return {
      hour: stats?.hour ?? 0,
      fiveHours: stats?.fiveHours ?? 0,
      week: stats?.week ?? 0,
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? `Failed to get message window counts by user id: ${error.message}`
        : "Failed to get message window counts by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ---------------------------------------------------------------------------
// Project queries
// ---------------------------------------------------------------------------

export async function createProject({
  userId,
  name,
  systemPrompt,
}: {
  userId: string;
  name: string;
  systemPrompt?: string | null;
}): Promise<Project> {
  try {
    const [created] = await db
      .insert(project)
      .values({
        userId,
        name,
        systemPrompt: systemPrompt ?? null,
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create project");
  }
}

export async function getProjectsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get projects by user id"
    );
  }
}

export async function getProjectById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Project | null> {
  try {
    const [row] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .limit(1);

    return row ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get project by id"
    );
  }
}

export async function updateProject({
  id,
  userId,
  name,
  systemPrompt,
}: {
  id: string;
  userId: string;
  name?: string;
  systemPrompt?: string | null;
}): Promise<Project | null> {
  try {
    const updates: Partial<typeof project.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updates.name = name;
    }

    if (systemPrompt !== undefined) {
      updates.systemPrompt = systemPrompt;
    }

    const [updated] = await db
      .update(project)
      .set(updates)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .returning();

    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update project"
    );
  }
}

export async function deleteProject({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Project | null> {
  try {
    const [deleted] = await db
      .delete(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .returning();

    return deleted ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete project"
    );
  }
}
