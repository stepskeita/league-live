// FR22: promotion/relegation rules "between adjacent tiers" — applied
// uniformly at every adjacent tier boundary (top N promoted from the lower
// tier, bottom N relegated from the higher tier), not configured per
// boundary; that's what FR21's "for example top N promoted, bottom N
// relegated" describes.
export interface LeagueSystemRules {
  promote_count: number;
  relegate_count: number;
}

// FR21/FR23: an ordered set of Competitions linked as tiers in a pyramid.
// `tiers` is ordered top to bottom by array position — index 0 is the
// highest tier — rather than carrying a separate, redundant tier-number
// field per entry.
export interface LeagueSystem {
  id: string;
  organization_id: string;
  name: string;
  // Free-form (e.g. "national", "regional"), same pattern as Team.category.
  scope: string;
  tiers: string[];
  rules: LeagueSystemRules;
  createdAt: string;
  updatedAt: string;
}
