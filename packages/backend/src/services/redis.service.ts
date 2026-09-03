import Redis from "ioredis";
import { env } from "../config/env";

export const redisClient = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
}

export function disconnectRedis(): void {
  redisClient.disconnect();
}
