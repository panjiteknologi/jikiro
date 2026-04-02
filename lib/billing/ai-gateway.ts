import "server-only";

type AiGatewayGenerationLookup = {
  createdAt: string;
  generationId: string;
  model: string;
  providerName: string | null;
  totalCostUsd: number | null;
  totalTokens: number;
  completionTokens: number;
  promptTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  raw: unknown;
};

function getGatewayAuthToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
}

export function extractGenerationId(
  responseId?: string | null,
  providerMetadata?: unknown
) {
  if (responseId?.startsWith("gen_")) {
    return responseId;
  }

  return findGenerationId(providerMetadata);
}

function findGenerationId(value: unknown): string | null {
  if (typeof value === "string") {
    return value.startsWith("gen_") ? value : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findGenerationId(entry);
      if (found) {
        return found;
      }
    }

    return null;
  }

  if (typeof value === "object" && value !== null) {
    for (const entry of Object.values(value)) {
      const found = findGenerationId(entry);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export async function lookupAiGatewayGeneration(generationId: string) {
  const authToken = getGatewayAuthToken();

  if (!authToken) {
    return null;
  }

  const response = await fetch(
    `https://ai-gateway.vercel.sh/v1/generation?id=${encodeURIComponent(generationId)}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      method: "GET",
    }
  ).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const json = await response.json().catch(() => null);
  const data = json?.data;

  if (!data) {
    return null;
  }

  const parsedCost =
    typeof data.total_cost === "number" ? data.total_cost : Number(data.total_cost);
  const totalCostUsd = Number.isFinite(parsedCost) ? parsedCost : null;

  return {
    cachedInputTokens: Number(data.native_tokens_cached ?? 0),
    completionTokens: Number(data.tokens_completion ?? 0),
    createdAt: String(data.created_at ?? ""),
    generationId: String(data.id ?? generationId),
    model: String(data.model ?? ""),
    promptTokens: Number(data.tokens_prompt ?? 0),
    providerName:
      typeof data.provider_name === "string" ? data.provider_name : null,
    raw: json,
    reasoningTokens: Number(data.native_tokens_reasoning ?? 0),
    totalCostUsd,
    totalTokens:
      Number(data.tokens_prompt ?? 0) + Number(data.tokens_completion ?? 0),
  } satisfies AiGatewayGenerationLookup;
}

export type { AiGatewayGenerationLookup };
