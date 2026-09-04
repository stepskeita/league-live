import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import authRouter from "./routes/auth";
import auditLogEntriesRouter from "./routes/audit-log-entries";
import clubsRouter from "./routes/clubs";
import competitionsRouter from "./routes/competitions";
import fixturesRouter from "./routes/fixtures";
import healthRouter from "./routes/health";
import leagueSystemsRouter from "./routes/league-systems";
import organizationsRouter from "./routes/organizations";
import playersRouter from "./routes/players";
import rolesRouter from "./routes/roles";
import teamsRouter from "./routes/teams";
import venuesRouter from "./routes/venues";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/organizations", organizationsRouter);
  app.use("/roles", rolesRouter);
  app.use("/clubs", clubsRouter);
  app.use("/venues", venuesRouter);
  app.use("/teams", teamsRouter);
  app.use("/players", playersRouter);
  app.use("/competitions", competitionsRouter);
  app.use("/fixtures", fixturesRouter);
  app.use("/league-systems", leagueSystemsRouter);
  app.use("/audit-log-entries", auditLogEntriesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
