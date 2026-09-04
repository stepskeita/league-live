import { Types } from "mongoose";
import { User, type UserDocument } from "../models/user.model";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import { hashPassword } from "../utils/password";

export interface CreateUserAccountInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  organization_id: Types.ObjectId | string | null;
}

/**
 * The one place that knows how to create a User account with a password —
 * shared by self-service signup (auth.service.ts) and Platform-Operator
 * driven creation (organization.service.ts's onboarding flow), so the
 * uniqueness check / hashing / duplicate-key handling isn't duplicated
 * between them. Callers own everything after creation (issuing tokens,
 * assigning a role, audit logging) since those differ by caller.
 */
export async function createUserAccount(input: CreateUserAccountInput): Promise<UserDocument> {
  const email = input.email.toLowerCase();

  const existing = await User.findOne({ "contact.email": email });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const password_hash = await hashPassword(input.password);

  try {
    return await User.create({
      name: input.name,
      contact: { email, phone: input.phone },
      password_hash,
      organization_id: input.organization_id,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("An account with this email already exists", 409);
    }
    throw err;
  }
}
