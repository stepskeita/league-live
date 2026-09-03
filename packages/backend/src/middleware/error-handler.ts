import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Validation failed",
        issues: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { message: `Invalid value for ${err.path}` } });
    return;
  }

  if (isDuplicateKeyError(err)) {
    res.status(409).json({ error: { message: "A record with this value already exists" } });
    return;
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  if (!isAppError || !err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(env.NODE_ENV === "development" && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
}
