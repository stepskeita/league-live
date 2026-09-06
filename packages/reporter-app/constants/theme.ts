// Same visual language as KEKE Ride's driver app — big rounded tap targets,
// soft colored shadows on the primary action, a quiet neutral palette doing
// most of the work — with LeagueLive's own accent color (pitch green,
// rather than KEKE's orange) so the two unrelated apps aren't visually
// confusable.
export const colors = {
  background: "#ffffff",
  surface: "#f7f7f8",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  primary: "#16a34a",
  danger: "#dc2626",
  dangerBackground: "#fef2f2",
  dangerBorder: "#fecaca",
  white: "#ffffff",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 16,
  xl: 20,
} as const;

// The one tap-target-size decision every button/input in this app shares —
// KEKE's AppButton uses the same 52.
export const minTapTarget = 52;
