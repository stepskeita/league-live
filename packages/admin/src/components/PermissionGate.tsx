"use client";

import type { PermissionKey } from "@leaguelive/shared";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth-context";

export interface PermissionGateProps {
  need: PermissionKey | PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * The button/action-level counterpart to AdminGuard's whole-page check —
 * same "read from the shared permission context, never invent a bespoke
 * check" rule, just at finer granularity: hides (or swaps in `fallback`
 * for) one action a page's viewer can see but isn't allowed to use, e.g. a
 * "Delete" button on a page they can otherwise view. For *disabling* rather
 * than hiding a control, call useAuth().hasPermission()/hasAnyPermission()
 * directly instead — there's no separate wrapper for that, it's a one-line
 * `disabled={!hasPermission(...)}`.
 */
export function PermissionGate({ need, children, fallback = null }: PermissionGateProps) {
  const { hasAnyPermission } = useAuth();
  const keys = Array.isArray(need) ? need : [need];
  if (!hasAnyPermission(keys)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
