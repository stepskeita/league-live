"use client";

import { Button } from "./ui/Button";
import { useAuth } from "../lib/auth-context";
import styles from "./TopBar.module.css";

export function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className={styles.bar}>
      <span className={styles.user}>
        Signed in as <span className={styles.userName}>{user?.name}</span>
        {user?.organization_id === null ? " (Platform Operator)" : ""}
      </span>
      <Button variant="secondary" size="small" onClick={logout}>
        Log out
      </Button>
    </header>
  );
}
