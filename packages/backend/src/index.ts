import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./services/db.service";
import { connectRedis, disconnectRedis } from "./services/redis.service";

async function bootstrap(): Promise<void> {
  await connectMongo();
  console.log("MongoDB connected");

  await connectRedis();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`LeagueLive backend listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    await disconnectMongo();
    disconnectRedis();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
