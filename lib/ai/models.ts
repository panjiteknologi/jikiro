export const DEFAULT_CHAT_MODEL = "deepseek/deepseek-v3.2";

export const FREE_MODEL_IDS = [
  "deepseek/deepseek-v3.2",
  "google/gemini-2.0-flash-lite",
  "minimax/minimax-m2.5",
  "openai/gpt-5-nano",
  "anthropic/claude-3.5-haiku",
] as const;

export const GUEST_MODEL_IDS = [
  DEFAULT_CHAT_MODEL,
  "mistral/mistral-small",
  "openai/gpt-5-nano",
] as const;

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

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
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
    id: "google/gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    provider: "google",
    description: "Low-cost Gemini model for lightweight chats",
  },
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "minimax",
    description: "Balanced general-purpose model for fast responses",
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Fastest GPT-5 tier for lightweight generation",
    reasoningEffort: "minimal",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description: "Fast Anthropic model for concise everyday tasks",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Balanced Anthropic model for stronger reasoning",
  },
  {
    id: "anthropic/claude-opus-4.1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    description: "Flagship Anthropic model for advanced reasoning",
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast multimodal Gemini model with tool use",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "High-capability Gemini model for complex tasks",
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
    id: "mistral/codestral",
    name: "Codestral",
    provider: "mistral",
    description: "Code-focused model with tool use",
    gatewayOrder: ["mistral"],
  },
  {
    id: "mistral/mistral-small",
    name: "Mistral Small",
    provider: "mistral",
    description: "Fast vision model with tool use",
    gatewayOrder: ["mistral"],
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    description: "Compact reasoning model",
    gatewayOrder: ["groq", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open-source 120B parameter model",
    gatewayOrder: ["fireworks", "bedrock"],
    reasoningEffort: "low",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
  },
];

const fallbackGatewayModels: FallbackGatewayModel[] = curatedModelOverrides.map(
  (model) => ({
    ...model,
    capabilities: {
      tools: ![
        "google/gemini-2.0-flash-lite",
        "openai/gpt-5-nano",
        "anthropic/claude-3.5-haiku",
      ].includes(model.id),
      vision: [
        "google/gemini-2.0-flash-lite",
        "google/gemini-2.5-flash",
        "google/gemini-2.5-pro",
        "mistral/mistral-small",
        "xai/grok-4.1-fast-non-reasoning",
      ].includes(model.id),
      reasoning: [
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-opus-4.1",
        "google/gemini-2.5-pro",
        "openai/gpt-5-mini",
        "openai/gpt-5",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
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
