import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import authRouter from "./routes/auth";
import auditLogEntriesRouter from "./routes/audit-log-entries";
import healthRouter from "./routes/health";
import rolesRouter from "./routes/roles";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/roles", rolesRouter);
  app.use("/audit-log-entries", auditLogEntriesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
