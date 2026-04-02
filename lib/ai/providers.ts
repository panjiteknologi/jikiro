import { customProvider, gateway } from "ai";
import { ATTACHMENT_EMBEDDING_MODEL_ID } from "@/lib/attachments";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

const testModels = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return { chatModel, titleModel };
    })()
  : null;

export const myProvider =
  isTestEnvironment && testModels
    ? customProvider({
        languageModels: {
          "chat-model": testModels.chatModel,
          "title-model": testModels.titleModel,
        },
      })
    : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && testModels) {
    return testModels.chatModel;
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && testModels) {
    return testModels.titleModel;
  }
  return gateway.languageModel(titleModel.id);
}

export function getEmbeddingModel() {
  const modelId = process.env.AI_EMBEDDING_MODEL;

  if (!modelId) {
    throw new Error("AI_EMBEDDING_MODEL is not configured");
  }

  if (modelId !== ATTACHMENT_EMBEDDING_MODEL_ID) {
    throw new Error(
      `AI_EMBEDDING_MODEL must be set to ${ATTACHMENT_EMBEDDING_MODEL_ID}`
    );
  }

  return gateway.embeddingModel(modelId);
}
