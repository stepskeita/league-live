import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./services/db.service";
import { connectRedis, disconnectRedis } from "./services/redis.service";
import { initSocketServer } from "./services/socket.service";

async function bootstrap(): Promise<void> {
  await connectMongo();
  console.log("MongoDB connected");

  await connectRedis();

  const app = createApp();
  // Socket.io needs to attach to the underlying HTTP server directly, so
  // http and WebSocket traffic share the same port via an explicit
  // http.Server rather than the one app.listen() creates implicitly.
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  const server = httpServer.listen(env.PORT, () => {
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
