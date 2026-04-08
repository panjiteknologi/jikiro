import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";
import type { MessageWindowCounts } from "@/lib/db/queries";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > MAX_MESSAGES) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
  }
}

const USAGE_COUNTS_TTL = 60;

function usageCountsKey(userId: string) {
  return `usage-counts:${userId}`;
}

export async function getCachedUsageCounts(
  userId: string
): Promise<MessageWindowCounts | null> {
  const redis = getClient();
  if (!redis?.isReady) {
    return null;
  }

  try {
    const raw = await redis.get(usageCountsKey(userId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as MessageWindowCounts;
  } catch {
    return null;
  }
}

export async function setCachedUsageCounts(
  userId: string,
  counts: MessageWindowCounts
): Promise<void> {
  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    await redis.set(usageCountsKey(userId), JSON.stringify(counts), {
      EX: USAGE_COUNTS_TTL,
    });
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function invalidateUsageCountsCache(
  userId: string
): Promise<void> {
  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    await redis.del(usageCountsKey(userId));
  } catch {
    // Silently fail
  }
}
