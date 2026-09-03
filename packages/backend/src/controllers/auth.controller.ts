import type { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/user.model";
import * as authService from "../services/auth.service";
import { getEffectivePermissions } from "../services/permission.service";
import { AppError } from "../utils/app-error";
import { requireUser } from "../utils/require-user";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  password: z.string().min(8).max(128),
  organization_id: z.string().optional(),
});

export async function signup(req: Request, res: Response): Promise<void> {
  const input = signupSchema.parse(req.body);
  const { user, tokens } = await authService.signup(input);
  res.status(201).json({ user: user.toJSON(), ...tokens });
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const { user, tokens } = await authService.login(email, password);
  res.status(200).json({ user: user.toJSON(), ...tokens });
}

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  // authenticate() ran first and guarantees req.user is set.
  const user = await User.findById(req.user?.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  res.status(200).json({ user: user.toJSON() });
}

/**
 * FR8: a user can fetch their own effective permission set — the union of
 * every role assigned to them (FR7) — for client applications (the admin
 * panel's sidebar and page guards, per FR9/NFR10) to drive their own UI with.
 */
export async function myPermissions(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const permissions = await getEffectivePermissions(user.id);
  res.status(200).json({ permissions });
}
