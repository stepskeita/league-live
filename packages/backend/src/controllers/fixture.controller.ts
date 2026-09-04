import { FIXTURE_STATUSES } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as fixtureService from "../services/fixture.service";
import { requireUser } from "../utils/require-user";

const fixtureParamsSchema = z.object({
  fixtureId: z.string().min(1),
});

const createFixtureSchema = z.object({
  competition_id: z.string().min(1),
  home_entry_id: z.string().min(1),
  away_entry_id: z.string().min(1),
  venue_id: z.string().min(1).nullable().optional(),
  datetime: z.coerce.date(),
  status: z.enum(FIXTURE_STATUSES).optional(),
});

export async function createFixture(req: Request, res: Response): Promise<void> {
  const input = createFixtureSchema.parse(req.body);
  const fixture = await fixtureService.createFixture(requireUser(req), input);
  res.status(201).json({ fixture: fixture.toJSON() });
}

const listFixturesQuerySchema = z.object({
  competition_id: z.string().min(1).optional(),
});

export async function listFixtures(req: Request, res: Response): Promise<void> {
  const query = listFixturesQuerySchema.parse(req.query);
  const fixtures = await fixtureService.listFixtures(requireUser(req), query);
  res.status(200).json({ fixtures: fixtures.map((fixture) => fixture.toJSON()) });
}

/** FR24: a Reporter's own assigned fixtures — no fixture.manage/reporter.assign required, just authentication. */
export async function myAssignedFixtures(req: Request, res: Response): Promise<void> {
  const fixtures = await fixtureService.listMyAssignedFixtures(requireUser(req));
  res.status(200).json({ fixtures: fixtures.map((fixture) => fixture.toJSON()) });
}

export async function getFixture(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const fixture = await fixtureService.getFixture(requireUser(req), fixtureId);
  res.status(200).json({ fixture: fixture.toJSON() });
}

const updateFixtureSchema = z.object({
  home_entry_id: z.string().min(1).optional(),
  away_entry_id: z.string().min(1).optional(),
  venue_id: z.string().min(1).nullable().optional(),
  datetime: z.coerce.date().optional(),
  status: z.enum(FIXTURE_STATUSES).optional(),
});

export async function updateFixture(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const input = updateFixtureSchema.parse(req.body);
  const fixture = await fixtureService.updateFixture(requireUser(req), fixtureId, input);
  res.status(200).json({ fixture: fixture.toJSON() });
}

export async function deleteFixture(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  await fixtureService.deleteFixture(requireUser(req), fixtureId);
  res.status(204).send();
}

// --- FR19: reporter assignment, gated separately behind reporter.assign ---

const assignReporterSchema = z.object({
  user_id: z.string().min(1),
});

export async function assignReporter(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const { user_id } = assignReporterSchema.parse(req.body);
  const fixture = await fixtureService.assignReporter(requireUser(req), fixtureId, user_id);
  res.status(200).json({ fixture: fixture.toJSON() });
}

export async function unassignReporter(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const fixture = await fixtureService.unassignReporter(requireUser(req), fixtureId);
  res.status(200).json({ fixture: fixture.toJSON() });
}

// --- FR25: match session start/end, restricted to the assigned reporter ---

export async function startMatchSession(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const fixture = await fixtureService.startMatchSession(requireUser(req), fixtureId);
  res.status(200).json({ fixture: fixture.toJSON() });
}

export async function endMatchSession(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const fixture = await fixtureService.endMatchSession(requireUser(req), fixtureId);
  res.status(200).json({ fixture: fixture.toJSON() });
}

// --- FR28: post match confirmation, gated behind results.verify ---

export async function confirmResult(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const fixture = await fixtureService.confirmResult(requireUser(req), fixtureId);
  res.status(200).json({ fixture: fixture.toJSON() });
}
