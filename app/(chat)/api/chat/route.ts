import { geolocation, ipAddress } from "@vercel/functions";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  generateId,
  generateImage,
  pruneMessages,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import {
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  getGatewayModelById,
  IMAGE_GEN_MODEL_BY_TIER,
  resolveOpenAIReasoningEffort,
  VISION_MODEL_BY_TIER,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  getEmbeddingModel,
  getImageModel,
  getLanguageModel,
} from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import {
  ATTACHMENT_EMBEDDING_MODEL_ID,
  assertAttachmentEmbeddingDimensions,
  DOCUMENT_RETRIEVAL_LIMIT,
  isReadableDocumentMimeType,
} from "@/lib/attachments";
import {
  buildRetrievedDocumentContext,
  getAttachmentRetrievalQuery,
} from "@/lib/attachments/ingestion";
import {
  extractGenerationId,
  lookupAiGatewayGeneration,
} from "@/lib/billing/ai-gateway";
import { convertUsdToMicros } from "@/lib/billing/credits";
import { getFallbackModelId } from "@/lib/billing/plans";
import {
  type ResolvedBillingState,
  recordAiUsage,
  resolveBillingState,
} from "@/lib/billing/service";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteAttachmentAssetsByChatId,
  deleteChatById,
  getAttachmentAssetsByChatId,
  getChatById,
  getMessageCountsByUserId,
  getMessagesByChatId,
  getProjectById,
  retrieveRelevantAttachmentChunks,
  saveChat,
  saveDocument,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import {
  checkIpRateLimit,
  invalidateUsageCountsCache,
} from "@/lib/ratelimit";
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

function hasNonEmptyTextContent(text: string) {
  return text.trim().length > 0;
}

function sanitizeMessageParts(parts: ChatMessage["parts"]) {
  return parts.filter((part) => {
    if (part.type === "text" || part.type === "reasoning") {
      return hasNonEmptyTextContent(part.text);
    }

    return true;
  });
}

function sanitizeUIMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    ...message,
    parts: sanitizeMessageParts(message.parts),
  }));
}

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
  billingState,
  chatId,
  messages,
  originalMessages,
  userId,
  userType,
}: {
  billingState: ResolvedBillingState;
  chatId: string;
  messages: ChatMessage[];
  originalMessages: ChatMessage[];
  userId: string;
  userType: UserType;
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
  const { embedding, providerMetadata, response, usage } = await embed({
    model: getEmbeddingModel(),
    providerOptions: {
      gateway: {
        metadata: {
          chatId,
          tier: billingState.entitlements.tier,
          usageKind: "retrieval_embedding",
        },
        user: userId,
      },
    },
    value: retrievalQuery,
  });

  assertAttachmentEmbeddingDimensions(embedding);

  await recordAiUsage({
    billingState,
    chatId,
    modelId: ATTACHMENT_EMBEDDING_MODEL_ID,
    promptTokens: usage.tokens,
    providerMetadata,
    providerName: ATTACHMENT_EMBEDDING_MODEL_ID.split("/")[0],
    responseBody: response?.body ?? null,
    totalTokens: usage.tokens,
    usageKind: "retrieval_embedding",
    userId,
    userType,
  }).catch((error) => {
    console.error("Failed to record retrieval embedding usage", {
      chatId,
      error,
      userId,
    });
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
    const {
      id,
      message,
      messages,
      selectedChatModel,
      reasoningEnabled,
      imageMode,
      projectId,
    } = requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;
    const billingState = await resolveBillingState({
      userId: session.user.id,
      userType,
    });
    const allowedModelIds = new Set(billingState.entitlements.allowedModelIds);
    let chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : (getFallbackModelId(billingState.entitlements.allowedModelIds) ??
        DEFAULT_CHAT_MODEL);

    // Auto-route to vision model if message contains image attachments
    const hasImageAttachments =
      message?.parts.some(
        (part) =>
          part.type === "file" && isImageAttachmentMimeType(part.mediaType)
      ) ?? false;

    if (hasImageAttachments) {
      const allCapabilities = await getCapabilities();
      if (!allCapabilities[chatModel]?.vision) {
        const tier = billingState.entitlements.tier;
        if (tier === "max") {
          chatModel = VISION_MODEL_BY_TIER.max;
        } else if (tier === "pro") {
          chatModel = VISION_MODEL_BY_TIER.pro;
        }
      }
    }

    if (
      billingState.remainingCredits !== null &&
      billingState.remainingCredits <= 0
    ) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const messageCounts = await getMessageCountsByUserId({
      id: session.user.id,
    });

    if (
      messageCounts.hour > billingState.entitlements.maxMessagesPerHour ||
      messageCounts.fiveHours >
        billingState.entitlements.maxMessagesPer5Hours ||
      messageCounts.week > billingState.entitlements.maxMessagesPerWeek
    ) {
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
      if (projectId) {
        const project = await getProjectById({
          id: projectId,
          userId: session.user.id,
        });
        if (!project) {
          return new ChatbotError("not_found:project").toResponse();
        }
      }
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: "private",
        projectId: projectId ?? null,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    // Image generation mode (Pro/Max only)
    if (imageMode) {
      const tier = billingState.entitlements.tier;
      if (tier === "free") {
        return new ChatbotError("forbidden:billing").toResponse();
      }

      const textPrompt = message?.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();

      if (!textPrompt) {
        return new ChatbotError("bad_request:api").toResponse();
      }

      if (message?.role === "user") {
        await saveMessages({
          messages: [
            {
              chatId: id,
              id: message.id,
              role: "user",
              parts: sanitizeMessageParts(message.parts),
              attachments: [],
              createdAt: new Date(),
            },
          ],
        });
      }

      const imageModelId =
        tier === "max"
          ? IMAGE_GEN_MODEL_BY_TIER.max
          : IMAGE_GEN_MODEL_BY_TIER.pro;
      const documentId = generateId();

      const imageStream = createUIMessageStream({
        execute: async ({ writer: dataStream }) => {
          dataStream.write({
            type: "data-kind",
            data: "image",
            transient: true,
          });
          dataStream.write({
            type: "data-id",
            data: documentId,
            transient: true,
          });
          dataStream.write({
            type: "data-title",
            data: "Generated Image",
            transient: true,
          });
          dataStream.write({ type: "data-clear", data: null, transient: true });

          const { image } = await generateImage({
            model: getImageModel(imageModelId),
            prompt: textPrompt,
          });

          dataStream.write({
            type: "data-imageDelta",
            data: image.base64,
            transient: true,
          });
          dataStream.write({
            type: "data-finish",
            data: null,
            transient: true,
          });

          await saveDocument({
            id: documentId,
            title: "Generated Image",
            content: image.base64,
            kind: "image",
            userId: session.user.id,
          });

          const assistantMsgId = generateId();
          await saveMessages({
            messages: [
              {
                chatId: id,
                id: assistantMsgId,
                role: "assistant",
                parts: [{ type: "text", text: "Here's your generated image." }],
                attachments: [],
                createdAt: new Date(),
              },
            ],
          });

          if (titlePromise) {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          }

          after(async () => {
            await recordAiUsage({
              billingState,
              chatId: id,
              modelId: imageModelId,
              providerName: imageModelId.split("/")[0],
              usageKind: "chat_generation",
              userId: session.user.id,
              userType,
            });
            invalidateUsageCountsCache(session.user.id).catch(() => {});
          });
        },
        generateId: generateUUID,
      });

      return createUIMessageStreamResponse({ stream: imageStream });
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

    uiMessages = sanitizeUIMessages(uiMessages);

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
            parts: sanitizeMessageParts(message.parts),
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const [modelConfig, modelCapabilities] = await Promise.all([
      getGatewayModelById(chatModel),
      getCapabilities(),
    ]);
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;
    const openaiReasoningEffort = resolveOpenAIReasoningEffort({
      defaultEffort: modelConfig?.reasoningEffort,
      modelId: chatModel,
      reasoningEnabled,
    });
    const requiresStrictStringMessageContent =
      chatModel.startsWith("moonshotai/");

    const resolvedMessages = await resolvePrivateFilePartsForModel({
      messages: uiMessages,
      userId: session.user.id,
    });
    const modelReadyMessages = isToolApprovalFlow
      ? resolvedMessages
      : await injectRetrievedDocumentContext({
          billingState,
          chatId: id,
          messages: resolvedMessages,
          originalMessages: uiMessages,
          userId: session.user.id,
          userType,
        });
    const modelMessages = await convertToModelMessages(modelReadyMessages);
    const prunedModelMessages = requiresStrictStringMessageContent
      ? pruneMessages({
          messages: modelMessages,
          reasoning: "all",
          toolCalls: "all",
        })
      : modelMessages;

    const sanitizedModelMessages = prunedModelMessages
      .map((modelMessage) => {
        if (typeof modelMessage.content === "string") {
          if (modelMessage.role === "tool") {
            return null;
          }

          return hasNonEmptyTextContent(modelMessage.content)
            ? {
                ...modelMessage,
                content: modelMessage.content.trim(),
              }
            : null;
        }

        if (!Array.isArray(modelMessage.content)) {
          return modelMessage;
        }

        if (modelMessage.role === "assistant") {
          const assistantContent = modelMessage.content
            .filter((part) => {
              if (part.type === "text" || part.type === "reasoning") {
                return hasNonEmptyTextContent(part.text);
              }

              return true;
            })
            .filter((part) =>
              isReasoningModel ? true : part.type !== "reasoning"
            );

          if (assistantContent.every((part) => part.type === "text")) {
            const textContent = assistantContent
              .map((part) => part.text)
              .join("")
              .trim();

            return hasNonEmptyTextContent(textContent)
              ? {
                  ...modelMessage,
                  content: textContent,
                }
              : null;
          }

          if (assistantContent.length === 0) {
            return null;
          }

          return {
            ...modelMessage,
            content: assistantContent,
          };
        }

        if (modelMessage.role === "user") {
          const userContent = modelMessage.content.filter((part) => {
            if (part.type === "text") {
              return hasNonEmptyTextContent(part.text);
            }

            return true;
          });

          if (userContent.every((part) => part.type === "text")) {
            const textContent = userContent
              .map((part) => part.text)
              .join("")
              .trim();

            return hasNonEmptyTextContent(textContent)
              ? {
                  ...modelMessage,
                  content: textContent,
                }
              : null;
          }

          if (userContent.length === 0) {
            return null;
          }

          return {
            ...modelMessage,
            content: userContent,
          };
        }

        if (modelMessage.content.length === 0) {
          return null;
        }

        return modelMessage;
      })
      .filter((message) => message !== null);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          abortSignal: request.signal,
          model: getLanguageModel(chatModel),
          system: systemPrompt({ requestHints, supportsTools }),
          messages: sanitizedModelMessages,
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
            gateway: {
              ...(modelConfig?.gatewayOrder && {
                order: modelConfig.gatewayOrder,
              }),
              metadata: {
                chatId: id,
                tier: billingState.entitlements.tier,
                usageKind: "chat_generation",
              },
              user: session.user.id,
            },
            ...(isReasoningModel &&
              openaiReasoningEffort && {
                openai: {
                  reasoningEffort: openaiReasoningEffort,
                },
              }),
          },
          onFinish: async (event) => {
            try {
              const generationId = extractGenerationId(
                event.response.id,
                event.providerMetadata
              );
              const generationLookup = generationId
                ? await lookupAiGatewayGeneration(generationId)
                : null;
              const costMicrosUsd =
                generationLookup?.totalCostUsd != null &&
                Number.isFinite(generationLookup.totalCostUsd)
                  ? convertUsdToMicros(generationLookup.totalCostUsd)
                  : null;

              await recordAiUsage({
                billingState,
                cachedInputTokens:
                  generationLookup?.cachedInputTokens ??
                  event.totalUsage.cachedInputTokens,
                chatId: id,
                completionTokens:
                  generationLookup?.completionTokens ??
                  event.totalUsage.outputTokens,
                costMicrosUsd,
                generationId,
                modelId: chatModel,
                promptTokens:
                  generationLookup?.promptTokens ??
                  event.totalUsage.inputTokens,
                providerMetadata: event.providerMetadata,
                providerName:
                  generationLookup?.providerName ?? chatModel.split("/")[0],
                reasoningTokens:
                  generationLookup?.reasoningTokens ??
                  event.totalUsage.reasoningTokens,
                responseBody:
                  generationLookup?.raw ?? event.response.body ?? null,
                totalTokens:
                  generationLookup?.totalTokens ?? event.totalUsage.totalTokens,
                usageKind: "chat_generation",
                userId: session.user.id,
                userType,
              });
              invalidateUsageCountsCache(session.user.id).catch(
                () => {}
              );
            } catch (error) {
              console.error("Failed to record chat generation usage", {
                chatId: id,
                error,
                userId: session.user.id,
              });
            }
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
            const sanitizedParts = sanitizeMessageParts(finishedMsg.parts);

            if (sanitizedParts.length === 0) {
              continue;
            }

            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: sanitizedParts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: sanitizedParts,
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
            messages: finishedMessages
              .map((currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: sanitizeMessageParts(currentMessage.parts),
                createdAt: new Date(),
                attachments: [],
                chatId: id,
              }))
              .filter((currentMessage) => currentMessage.parts.length > 0),
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
        try {
          const [abortAwareStream, resumableStream] = sseStream.tee();

          await Promise.allSettled([
            consumeStream({
              stream: abortAwareStream,
            }),
            (async () => {
              if (!process.env.REDIS_URL) {
                return;
              }

              const streamContext = getStreamContext();
              if (streamContext) {
                const streamId = generateId();
                await createStreamId({ streamId, chatId: id });
                await streamContext.createNewResumableStream(
                  streamId,
                  () => resumableStream
                );
              }
            })(),
          ]);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Socket closed unexpectedly")
          ) {
            return;
          }
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
