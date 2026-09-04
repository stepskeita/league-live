// FR14: the three supported formats.
export const COMPETITION_FORMATS = ["league", "knockout", "group_and_knockout"] as const;

export type CompetitionFormat = (typeof COMPETITION_FORMATS)[number];

export interface CompetitionFormatConfig {
  type: CompetitionFormat;
  // Format-specific settings (e.g. group count for group_and_knockout) —
  // deliberately unstructured, since each format's settings differ.
  config: Record<string, unknown>;
}

export interface Competition {
  id: string;
  organization_id: string;
  name: string;
  // Free-form, Organization-defined (see docs/SRS.md section 1.3), same as
  // Team.category — not a fixed enum.
  category: string;
  format: CompetitionFormatConfig;
  // FR15: standings rules, configurable per competition, not hardcoded —
  // deliberately unstructured (points per win/draw/loss, tiebreaker order,
  // etc. are all caller-defined).
  ruleset: Record<string, unknown>;
  season: string;
  createdAt: string;
  updatedAt: string;
}
