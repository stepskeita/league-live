"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ROUTES } from "../config/admin-routes";
import { useAuth } from "../lib/auth-context";
import styles from "./Sidebar.module.css";

/**
 * FR9: renders only the links the current user's permissions unlock,
 * reading from the exact same ADMIN_ROUTES mapping AdminGuard checks pages
 * against — so nothing shown here is ever blocked when clicked, and
 * nothing reachable by direct navigation is missing from here.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();
  const visibleRoutes = ADMIN_ROUTES.filter((route) => hasAnyPermission(route.permissions));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>LeagueLive Admin</div>
      <nav className={styles.nav}>
        {visibleRoutes.map((route) => {
          const active = route.path === "/" ? pathname === "/" : pathname.startsWith(route.path);
          return (
            <Link key={route.path} href={route.path} className={`${styles.link} ${active ? styles.active : ""}`}>
              {route.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
