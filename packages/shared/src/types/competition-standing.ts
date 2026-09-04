// A competition's final, locked standing for one season — an ordered list
// of CompetitionEntry ids, best to worst. Deliberately just rank order, not
// a full computed table (played/won/drawn/goals/points): there's no
// match-result data yet (that's FR25-31, not built), so "end season"
// accepts the final order directly from the admin rather than deriving it.
// Immutable once created — locking a season's standing is meant to be final.
export interface CompetitionStanding {
  id: string;
  organization_id: string;
  competition_id: string;
  season: string;
  entries: string[];
  createdAt: string;
  updatedAt: string;
}
