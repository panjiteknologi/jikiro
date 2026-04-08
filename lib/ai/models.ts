export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v3.2";

export const FREE_MODEL_IDS = ["deepseek/deepseek-v3.2"] as const;

export const PAID_MODEL_IDS = [
  "openai/gpt-4o",
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.6",
] as const;

export const VISION_MODEL_BY_TIER = {
  pro: "google/gemini-2.5-flash",
  max: "google/gemini-2.5-pro",
} as const;

export const IMAGE_GEN_MODEL_BY_TIER = {
  pro: "google/gemini-2.5-flash-image",
  max: "google/gemini-3.1-flash-image-preview",
} as const;

export const titleModel = {
  id: "mistral/mistral-small",
  name: "Mistral Small",
  provider: "mistral",
  description: "Fast model for title generation",
  gatewayOrder: ["mistral"],
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: ReasoningEffort;
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

type GatewayModelResponse = {
  description?: string;
  id: string;
  name?: string;
  tags?: string[];
  type?: string;
};

type FallbackGatewayModel = {
  capabilities: ModelCapabilities;
} & ChatModel;

const curatedModelOverrides: ChatModel[] = [
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Fast and capable model with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Powerful multimodal model with vision and tool use",
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Compact GPT-5 tier for stronger everyday use",
    reasoningEffort: "low",
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description: "Flagship GPT-5 model for premium workloads",
    reasoningEffort: "medium",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast Anthropic model for responsive everyday chats",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Balanced Anthropic model for strong coding and reasoning",
  },
  {
    id: "google/gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    provider: "google",
    description: "Fast multimodal Gemini model with vision",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image Preview",
    provider: "google",
    description: "High-capability Gemini model for complex vision tasks",
  },
];

const imageGenModelIds = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
];

const fallbackGatewayModels: FallbackGatewayModel[] = curatedModelOverrides.map(
  (model) => ({
    ...model,
    capabilities: imageGenModelIds.includes(model.id)
      ? { tools: false, vision: false, reasoning: false }
      : {
          tools: true,
          vision: [
            "openai/gpt-4o",
            "anthropic/claude-haiku-4.5",
            "anthropic/claude-sonnet-4.6",
            "google/gemini-2.5-flash",
            "google/gemini-2.5-pro",
          ].includes(model.id),
          reasoning: [
            "openai/gpt-5-mini",
            "openai/gpt-5",
            "anthropic/claude-haiku-4.5",
            "anthropic/claude-sonnet-4.6",
          ].includes(model.id),
        },
  })
);

const curatedModelMap = new Map(
  curatedModelOverrides.map((model, index) => [
    model.id,
    { ...model, priority: index },
  ])
);

export const chatModels: ChatModel[] = curatedModelOverrides.filter(
  (model) => !isBlockedModelId(model.id)
);

function humanizeSegment(segment: string) {
  return segment
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => {
      if (part.toUpperCase() === part) {
        return part;
      }

      if (/^\d+(\.\d+)?$/.test(part)) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function deriveModelName(model: GatewayModelResponse) {
  const override = curatedModelMap.get(model.id);

  if (override?.name) {
    return override.name;
  }

  if (model.name?.trim()) {
    return model.name.trim();
  }

  const [, rawName = model.id] = model.id.split("/");
  return humanizeSegment(rawName);
}

function deriveProvider(model: GatewayModelResponse) {
  const override = curatedModelMap.get(model.id);
  return override?.provider ?? model.id.split("/")[0] ?? "unknown";
}

function deriveDescription(model: GatewayModelResponse) {
  const override = curatedModelMap.get(model.id);

  if (override?.description) {
    return override.description;
  }

  if (model.description?.trim()) {
    return model.description.trim();
  }

  return "Available through Vercel AI Gateway";
}

function deriveCapabilities(tags?: string[]): ModelCapabilities {
  const tagSet = new Set(tags ?? []);

  return {
    reasoning: tagSet.has("reasoning"),
    tools: tagSet.has("tool-use"),
    vision: tagSet.has("vision"),
  };
}

function compareModels(
  left: GatewayModelWithCapabilities,
  right: GatewayModelWithCapabilities
) {
  const freeLeftIndex = FREE_MODEL_IDS.indexOf(
    left.id as (typeof FREE_MODEL_IDS)[number]
  );
  const freeRightIndex = FREE_MODEL_IDS.indexOf(
    right.id as (typeof FREE_MODEL_IDS)[number]
  );

  if (freeLeftIndex !== -1 || freeRightIndex !== -1) {
    if (freeLeftIndex === -1) {
      return 1;
    }

    if (freeRightIndex === -1) {
      return -1;
    }

    return freeLeftIndex - freeRightIndex;
  }

  const leftOverride = curatedModelMap.get(left.id);
  const rightOverride = curatedModelMap.get(right.id);

  if (leftOverride || rightOverride) {
    if (!leftOverride) {
      return 1;
    }

    if (!rightOverride) {
      return -1;
    }

    return leftOverride.priority - rightOverride.priority;
  }

  return (
    left.provider.localeCompare(right.provider) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeGatewayModels(models: GatewayModelResponse[]) {
  return models
    .filter((model) => model.type === "language" && !isBlockedModelId(model.id))
    .map<GatewayModelWithCapabilities>((model) => {
      const override = curatedModelMap.get(model.id);

      return {
        description: deriveDescription(model),
        id: model.id,
        name: deriveModelName(model),
        provider: deriveProvider(model),
        capabilities: deriveCapabilities(model.tags),
        gatewayOrder: override?.gatewayOrder,
        reasoningEffort: override?.reasoningEffort,
      };
    })
    .sort(compareModels);
}

function getFallbackCatalog() {
  return [...fallbackGatewayModels]
    .filter((model) => !isBlockedModelId(model.id))
    .sort(compareModels);
}

function getGatewayHeaders() {
  const token =
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;

  if (!token) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export function isBlockedModelId(modelId: string) {
  return /kimi/i.test(modelId);
}

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const models = await getAllGatewayModels();

  return Object.fromEntries(
    models.map((model) => [model.id, model.capabilities] as const)
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: getGatewayHeaders(),
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return getFallbackCatalog();
    }

    const json = await response.json();
    const normalized = normalizeGatewayModels(json.data ?? []);

    return normalized.length > 0 ? normalized : getFallbackCatalog();
  } catch {
    return getFallbackCatalog();
  }
}

export async function getGatewayModelById(modelId: string) {
  const models = await getAllGatewayModels();
  return models.find((model) => model.id === modelId) ?? null;
}

function getSupportedOpenAIReasoningEfforts(
  modelId: string
): readonly ReasoningEffort[] {
  if (modelId.startsWith("openai/gpt-5.1")) {
    return ["none", "low", "medium", "high"];
  }

  if (modelId.startsWith("openai/gpt-5")) {
    return ["minimal", "low", "medium", "high"];
  }

  return ["low", "medium", "high"];
}

export function resolveOpenAIReasoningEffort({
  defaultEffort,
  modelId,
  reasoningEnabled,
}: {
  defaultEffort?: ReasoningEffort;
  modelId: string;
  reasoningEnabled?: boolean;
}): ReasoningEffort | undefined {
  if (!modelId.startsWith("openai/")) {
    return undefined;
  }

  const supportedEfforts = getSupportedOpenAIReasoningEfforts(modelId);
  const desiredEffort =
    reasoningEnabled === false ? "none" : (defaultEffort ?? "medium");

  if (supportedEfforts.includes(desiredEffort)) {
    return desiredEffort;
  }

  if (desiredEffort === "none" && supportedEfforts.includes("minimal")) {
    return "minimal";
  }

  if (desiredEffort === "minimal" && supportedEfforts.includes("none")) {
    return "none";
  }

  return supportedEfforts.includes("medium") ? "medium" : supportedEfforts[0];
}

export async function getFreeModels(): Promise<GatewayModelWithCapabilities[]> {
  const allModels = await getAllGatewayModels();
  const freeIdSet = new Set(FREE_MODEL_IDS as readonly string[]);
  const available = allModels.filter((m) => freeIdSet.has(m.id));

  return (FREE_MODEL_IDS as readonly string[])
    .map((id) => available.find((m) => m.id === id))
    .filter((m): m is GatewayModelWithCapabilities => m !== undefined);
}

export function getActiveModels(): ChatModel[] {
  return getFallbackCatalog();
}
