import { PLATFORM_OPERATOR_DEFAULT_PASSWORD, env } from "../config/env";
import { User } from "../models/user.model";
import { connectMongo, disconnectMongo } from "../services/db.service";
import { ensureRoleAssignment, seedPlatformOperatorRole } from "../services/role.service";
import { hashPassword } from "../utils/password";

/**
 * Creates one Platform Operator account (a User with organization_id: null)
 * and grants it the platform scoped "Platform Operator" role (every
 * permission key) — see role.service.ts's seedPlatformOperatorRole() for why
 * that's not a hardcoded role-name check. Without this, the account this
 * script creates would have zero effective permissions and nothing in the
 * system could ever grant the first role to anyone. Idempotent.
 */
async function main(): Promise<void> {
  const email = env.PLATFORM_OPERATOR_EMAIL.toLowerCase();

  if (env.PLATFORM_OPERATOR_PASSWORD === PLATFORM_OPERATOR_DEFAULT_PASSWORD) {
    if (env.NODE_ENV === "production") {
      console.error(
        "Refusing to seed the Platform Operator with the default password in production. Set PLATFORM_OPERATOR_PASSWORD.",
      );
      process.exit(1);
    }
    console.warn("PLATFORM_OPERATOR_PASSWORD not set — using the default seed password. Change it after first login.");
  }

  await connectMongo();

  try {
    let user = await User.findOne({ "contact.email": email });
    if (user) {
      console.log(`Platform Operator account already exists for ${email}.`);
    } else {
      const password_hash = await hashPassword(env.PLATFORM_OPERATOR_PASSWORD);
      user = await User.create({
        organization_id: null,
        name: env.PLATFORM_OPERATOR_NAME,
        contact: { email },
        password_hash,
      });
      console.log(`Created Platform Operator account: ${email}`);
    }

    const role = await seedPlatformOperatorRole();
    await ensureRoleAssignment(user._id, role);
    console.log(`Ensured ${email} holds the Platform Operator role.`);
  } finally {
    await disconnectMongo();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed Platform Operator account:", err);
    process.exit(1);
  });
