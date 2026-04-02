import type { EmbeddingModelUsage, LanguageModelUsage } from "ai";

export const AI_CREDITS_PER_USD = 1_000;
export const USD_MICROS_PER_USD = 1_000_000;

export function convertUsdToMicros(value: number) {
  return Math.max(0, Math.round(value * USD_MICROS_PER_USD));
}

export function convertMicrosToCredits(costMicrosUsd: number) {
  return Math.max(
    1,
    Math.ceil((costMicrosUsd / USD_MICROS_PER_USD) * AI_CREDITS_PER_USD)
  );
}

export function estimateCreditsFromLanguageUsage(
  usage: Pick<
    LanguageModelUsage,
    | "cachedInputTokens"
    | "inputTokens"
    | "outputTokens"
    | "reasoningTokens"
    | "totalTokens"
  >
) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const reasoningTokens = usage.reasoningTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;

  const weightedTokens =
    inputTokens +
    outputTokens * 2 +
    reasoningTokens * 3 +
    Math.ceil(cachedInputTokens / 4);

  return Math.max(1, Math.ceil(weightedTokens / 400));
}

export function estimateCreditsFromEmbeddingUsage(usage: EmbeddingModelUsage) {
  return Math.max(1, Math.ceil(usage.tokens / 1_000));
}
