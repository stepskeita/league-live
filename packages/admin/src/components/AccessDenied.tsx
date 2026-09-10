"use client";

import Link from "next/link";
import { Button } from "./ui/Button";
import styles from "./AccessDenied.module.css";

/**
 * NFR10: shown by AdminGuard when the current page's mapping entry requires
 * a permission the user doesn't hold. This is a usability safeguard, not
 * the security boundary — the backend independently rejects the same
 * request regardless of whether this page ever renders.
 */
export function AccessDenied() {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>🔒</div>
      <h1 className={styles.title}>You don&apos;t have access to this page</h1>
      <p className={styles.body}>
        Your account doesn&apos;t hold the permission this section requires. If you think that&apos;s wrong, ask an admin in
        your Organization to check your assigned roles.
      </p>
      <Link href="/">
        <Button variant="secondary">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
