"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccessDenied } from "./AccessDenied";
import { findAdminRoute } from "../config/admin-routes";
import { useAuth } from "../lib/auth-context";

/**
 * FR9/NFR10: checks the current pathname against ADMIN_ROUTES before
 * rendering any protected page's content — the single central guard every
 * page gets automatically by living under (protected)/layout.tsx, rather
 * than each page wrapping itself (and risking its own check drifting from
 * the mapping Sidebar reads).
 *
 * A pathname with no mapping entry at all fails closed: rendered as
 * inaccessible, not silently allowed through. That's what keeps "every
 * route belongs in ADMIN_ROUTES" an enforced rule instead of a convention
 * someone can forget to follow.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();

  const route = findAdminRoute(pathname);
  if (!route || !hasAnyPermission(route.permissions)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
