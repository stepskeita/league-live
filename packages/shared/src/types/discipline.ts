// FR41: disciplinary records tracked per player, per competition, across a
// season. Computed from confirmed fixtures' "card" MatchEvents — not a
// separate, manually maintained ledger — the same "derive from confirmed
// results, MongoDB stays the source of truth" approach as
// standings.service.ts. "Per season" needs no field of its own here: each
// Competition document already represents exactly one season (see
// docs/SRS.md section 7 and competition.ts), so "per competition" already
// means "per competition per season."
export interface DisciplinaryRecordRow {
  player_id: string;
  yellow_cards: number;
  red_cards: number;
}
