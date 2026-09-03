import { Organization } from "../models/organization.model";
import { connectMongo, disconnectMongo } from "../services/db.service";
import { seedDefaultRolesForOrganization } from "../services/role.service";

/**
 * FR6: every newly onboarded Organization is seeded with two default roles.
 * There's no Organization-onboarding endpoint yet (out of scope here) — this
 * script backfills default roles for every Organization that doesn't have
 * them yet, and seedDefaultRolesForOrganization() is what a future onboarding
 * flow should call directly for a single Organization at creation time.
 * Idempotent either way.
 */
async function main(): Promise<void> {
  await connectMongo();

  try {
    const organizations = await Organization.find().select("_id name");
    for (const organization of organizations) {
      const { organizationAdminRole, reporterRole } = await seedDefaultRolesForOrganization(organization._id);
      console.log(
        `${organization.name}: Organization Admin (${organizationAdminRole._id.toString()}), Reporter (${reporterRole._id.toString()})`,
      );
    }
    console.log(`Done. ${organizations.length} Organization(s) checked.`);
  } finally {
    await disconnectMongo();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed default roles:", err);
    process.exit(1);
  });
