import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export interface AccessTokenPayload {
  sub: string;
  organization_id: string | null;
  typ: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: "refresh";
}

export function signAccessToken(userId: string, organizationId: string | null): string {
  const payload: AccessTokenPayload = { sub: userId, organization_id: organizationId, typ: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const payload: Omit<RefreshTokenPayload, "jti"> = { sub: userId, typ: "refresh" };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
    jwtid: jti,
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = safeVerify(token, env.JWT_ACCESS_SECRET);
  if (decoded.typ !== "access" || typeof decoded.sub !== "string") {
    throw new AppError("Invalid or expired access token", 401);
  }
  return { sub: decoded.sub, organization_id: (decoded.organization_id as string | null) ?? null, typ: "access" };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = safeVerify(token, env.JWT_REFRESH_SECRET);
  if (decoded.typ !== "refresh" || typeof decoded.sub !== "string" || typeof decoded.jti !== "string") {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  return { sub: decoded.sub, jti: decoded.jti, typ: "refresh" };
}

function safeVerify(token: string, secret: string): jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") {
      throw new AppError("Invalid token", 401);
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("Invalid or expired token", 401);
  }
}
