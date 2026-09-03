import ms from "ms";
import { env } from "../config/env";
import { redisClient } from "./redis.service";

const KEY_PREFIX = "refresh_token:";

export async function storeRefreshToken(jti: string, userId: string): Promise<void> {
  const ttlSeconds = Math.floor(ms(env.JWT_REFRESH_TTL) / 1000);
  await redisClient.set(`${KEY_PREFIX}${jti}`, userId, "EX", ttlSeconds);
}

export async function getRefreshTokenUserId(jti: string): Promise<string | null> {
  return redisClient.get(`${KEY_PREFIX}${jti}`);
}

export async function revokeRefreshToken(jti: string): Promise<void> {
  await redisClient.del(`${KEY_PREFIX}${jti}`);
}
