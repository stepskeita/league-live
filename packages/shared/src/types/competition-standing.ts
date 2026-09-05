// A competition's final, locked standing for one season — an ordered list
// of CompetitionEntry ids, best to worst. Deliberately just rank order, not
// a full computed table (played/won/drawn/goals/points): LeagueSystem's
// endSeason (FR22/FR23) takes the final order directly from the admin
// confirming it rather than deriving it from standings.service.ts's
// computeCompetitionTable, since ending a season is a deliberate admin
// action independent of whatever the live computed table happens to say at
// that moment — see league-system.service.ts's endSeason for the full
// reasoning. Immutable once created — locking a season's standing is meant
// to be final.
export interface CompetitionStanding {
  id: string;
  organization_id: string;
  competition_id: string;
  season: string;
  entries: string[];
  createdAt: string;
  updatedAt: string;
}
