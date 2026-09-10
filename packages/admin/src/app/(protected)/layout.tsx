"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AdminGuard } from "../../components/AdminGuard";
import { Sidebar } from "../../components/Sidebar";
import { TopBar } from "../../components/TopBar";
import { useAuth } from "../../lib/auth-context";
import styles from "./layout.module.css";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "signedIn") {
    return <div className={styles.loading}>{status === "loading" ? "Loading…" : null}</div>;
  }

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <main className={styles.content}>
          <AdminGuard>{children}</AdminGuard>
        </main>
      </div>
    </div>
  );
}
