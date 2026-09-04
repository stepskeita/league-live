import { Organization } from "../models/organization.model";
import { User, type UserDocument } from "../models/user.model";
import { AppError } from "../utils/app-error";
import { comparePassword } from "../utils/password";
import { recordAuditLogEntry } from "./audit-log.service";
import { getRefreshTokenUserId, revokeRefreshToken, storeRefreshToken } from "./refresh-token.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.service";
import { createUserAccount } from "./user.service";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignupInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  organization_id?: string;
}

export async function signup(input: SignupInput): Promise<{ user: UserDocument; tokens: AuthTokens }> {
  if (input.organization_id) {
    const organizationExists = await Organization.exists({ _id: input.organization_id });
    if (!organizationExists) {
      throw new AppError("Organization not found", 400);
    }
  }

  const user = await createUserAccount({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    organization_id: input.organization_id ?? null,
  });

  // Self-registration: the newly created user is its own actor.
  await recordAuditLogEntry({
    actor_user_id: user._id,
    organization_id: user.organization_id,
    action: "create",
    resource_type: "User",
    resource_id: user._id,
    after: user.toJSON(),
  });

  const tokens = await issueTokens(user);
  return { user, tokens };
}

export async function login(email: string, password: string): Promise<{ user: UserDocument; tokens: AuthTokens }> {
  const user = await User.findOne({ "contact.email": email.toLowerCase() }).select("+password_hash");
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokens = await issueTokens(user);
  return { user, tokens };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);

  const storedUserId = await getRefreshTokenUserId(payload.jti);
  if (!storedUserId || storedUserId !== payload.sub) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // Rotate: the presented refresh token is single-use.
  await revokeRefreshToken(payload.jti);

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  return issueTokens(user);
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.jti);
  } catch {
    // Already invalid or expired: nothing to revoke, treat logout as a no-op success.
  }
}

async function issueTokens(user: UserDocument): Promise<AuthTokens> {
  const userId = user._id.toString();
  const organizationId = user.organization_id ? user.organization_id.toString() : null;

  const accessToken = signAccessToken(userId, organizationId);
  const { token: refreshToken, jti } = signRefreshToken(userId);
  await storeRefreshToken(jti, userId);

  return { accessToken, refreshToken };
}
