import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getEmbeddingModel, getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import {
  DOCUMENT_RETRIEVAL_LIMIT,
  isReadableDocumentMimeType,
} from "@/lib/attachments";
import {
  buildRetrievedDocumentContext,
  getAttachmentRetrievalQuery,
} from "@/lib/attachments/ingestion";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteAttachmentAssetsByChatId,
  deleteChatById,
  getAttachmentAssetsByChatId,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  retrieveRelevantAttachmentChunks,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import {
  deleteFilesFromS3BestEffort,
  extractStorageKeyFromFileUrl,
  extractUniqueStorageKeysFromMessages,
  getChatUploadPrefix,
  getFileDataUrlFromS3,
  isImageAttachmentMimeType,
} from "@/lib/storage/s3";
import type { ChatMessage } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

function resolvePrivateFilePartsForModel({
  messages,
  userId,
}: {
  messages: ChatMessage[];
  userId: string;
}) {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: (
        await Promise.all(
          message.parts.map(async (part) => {
            if (part.type !== "file") {
              return part;
            }

            const storageKey = extractStorageKeyFromFileUrl(part.url);

            if (
              storageKey &&
              !storageKey.startsWith(getChatUploadPrefix(userId))
            ) {
              throw new ChatbotError("forbidden:chat");
            }

            if (!isImageAttachmentMimeType(part.mediaType)) {
              return null;
            }

            if (!storageKey) {
              return part;
            }

            const dataUrl = await getFileDataUrlFromS3(storageKey);

            return {
              ...part,
              url: dataUrl,
            };
          })
        )
      ).filter((part) => part !== null),
    }))
  );
}

async function injectRetrievedDocumentContext({
  chatId,
  messages,
  originalMessages,
  userId,
}: {
  chatId: string;
  messages: ChatMessage[];
  originalMessages: ChatMessage[];
  userId: string;
}) {
  const originalLastMessage = originalMessages.at(-1);
  const resolvedLastMessage = messages.at(-1);

  if (
    !originalLastMessage ||
    !resolvedLastMessage ||
    originalLastMessage.role !== "user"
  ) {
    return messages;
  }

  const currentReadableAttachmentIds = originalLastMessage.parts.flatMap(
    (part) =>
      part.type === "file" &&
      isReadableDocumentMimeType(part.mediaType) &&
      "attachmentId" in part &&
      typeof part.attachmentId === "string"
        ? [part.attachmentId]
        : []
  );

  const readyReadableAttachments = (
    await getAttachmentAssetsByChatId({
      chatId,
      userId,
    })
  ).filter(
    (attachment) =>
      attachment.status === "ready" &&
      isReadableDocumentMimeType(attachment.contentType)
  );

  const readyReadableAttachmentIds = new Set(
    readyReadableAttachments.map((attachment) => attachment.id)
  );
  const retrievalAttachmentIds =
    currentReadableAttachmentIds.length > 0
      ? currentReadableAttachmentIds.filter((id) =>
          readyReadableAttachmentIds.has(id)
        )
      : readyReadableAttachments.map((attachment) => attachment.id);

  const latestUserText = getTextFromMessage(originalLastMessage);
  const hasUserText = latestUserText.trim().length > 0;

  if (retrievalAttachmentIds.length === 0) {
    if (!hasUserText && currentReadableAttachmentIds.length > 0) {
      return messages.map((message, index) =>
        index === messages.length - 1
          ? {
              ...message,
              parts: [
                {
                  type: "text" as const,
                  text: "Summarize the attached document(s).",
                },
                ...message.parts,
              ],
            }
          : message
      );
    }

    return messages;
  }

  const retrievalQuery = getAttachmentRetrievalQuery(latestUserText);
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: retrievalQuery,
  });

  const retrievedChunks = await retrieveRelevantAttachmentChunks({
    attachmentIds: retrievalAttachmentIds,
    chatId,
    embedding,
    limit: DOCUMENT_RETRIEVAL_LIMIT,
    userId,
  });

  const documentContext = buildRetrievedDocumentContext(retrievedChunks);
  const injectedParts: Array<{ text: string; type: "text" }> = [];

  if (documentContext) {
    injectedParts.push({
      type: "text" as const,
      text: `Use the following extracted document context from this chat when answering. If the context is insufficient, say so.\n\n${documentContext}`,
    });
  }

  if (!hasUserText && currentReadableAttachmentIds.length > 0) {
    injectedParts.push({
      type: "text" as const,
      text: "Summarize the attached document(s).",
    });
  }

  if (injectedParts.length === 0) {
    return messages;
  }

  return messages.map((message, index) =>
    index === messages.length - 1
      ? {
          ...message,
          parts: [...injectedParts, ...message.parts],
        }
      : message
  );
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel } = requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: "private",
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const resolvedMessages = await resolvePrivateFilePartsForModel({
      messages: uiMessages,
      userId: session.user.id,
    });
    const modelReadyMessages = isToolApprovalFlow
      ? resolvedMessages
      : await injectRetrievedDocumentContext({
          chatId: id,
          messages: resolvedMessages,
          originalMessages: uiMessages,
          userId: session.user.id,
        });
    const modelMessages = await convertToModelMessages(modelReadyMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({ requestHints, supportsTools }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "editDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const [messages, attachmentAssets] = await Promise.all([
    getMessagesByChatId({ id }),
    getAttachmentAssetsByChatId({ chatId: id, userId: session.user.id }),
  ]);
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
      chatId: id,
      userId: session.user.id,
      operation: "delete-chat",
    },
  });
  await deleteAttachmentAssetsByChatId({ chatId: id, userId: session.user.id });

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
