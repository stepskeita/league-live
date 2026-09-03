import type { Request, Response } from "express";
import mongoose from "mongoose";
import { redisClient } from "../services/redis.service";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const mongoState = mongoose.connection.readyState === 1 ? "up" : "down";

  let redisState: "up" | "down" = "down";
  try {
    redisState = (await redisClient.ping()) === "PONG" ? "up" : "down";
  } catch {
    redisState = "down";
  }

  const allUp = mongoState === "up" && redisState === "up";

  res.status(allUp ? 200 : 503).json({
    status: allUp ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dependencies: {
      mongo: mongoState,
      redis: redisState,
    },
  });
}
