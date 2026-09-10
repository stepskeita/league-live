"use client";

import { useAuth } from "../../lib/auth-context";
import styles from "./page.module.css";

// Demonstrates the whole session-load pipeline this shell exists for:
// GET /auth/me + GET /auth/me/permissions ran once, on load, and both are
// available here from the shared AuthProvider — nothing on this page
// fetches either itself.
export default function DashboardPage() {
  const { user, permissions } = useAuth();

  return (
    <>
      <h1 className={styles.title}>Welcome, {user?.name}</h1>
      <p className={styles.subtitle}>
        {user?.organization_id === null
          ? "You're signed in as a Platform Operator — you can manage every Organization on the platform."
          : "Use the sidebar to manage your Organization."}
      </p>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Your effective permissions</h2>
        {permissions.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            No permissions assigned yet — ask an admin to assign you a role.
          </p>
        ) : (
          <ul className={styles.permissionList}>
            {permissions.map((permission) => (
              <li key={permission} className={styles.permissionChip}>
                {permission}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
