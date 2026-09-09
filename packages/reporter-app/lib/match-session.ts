import type { FixtureContext, MatchEvent } from "@leaguelive/shared";

export interface MatchScore {
  home: number;
  away: number;
}

/** Local, instant score display — the same "count goal events per side" the backend does at confirmResult, computed client-side so the reporter sees it update the moment they log a goal, no round trip needed. */
export function computeMatchScore(events: MatchEvent[], context: FixtureContext): MatchScore {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.type !== "goal") {
      continue;
    }
    if (event.team_id === context.home_team.id) {
      home += 1;
    } else if (event.team_id === context.away_team.id) {
      away += 1;
    }
  }
  return { home, away };
}

/** A sensible default for the minute field: how long the match has actually been running, so logging an event is usually just "confirm this number" rather than "type a number". */
export function computeElapsedMinutes(startedAt: string | null): number {
  if (!startedAt) {
    return 0;
  }
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(elapsedMs / 60000));
}

/** FR27's idempotency key. Doesn't need cryptographic randomness — just unique enough that one reporter's device never repeats one within a match — so a timestamp plus a short random suffix avoids pulling in a UUID dependency/polyfill. */
export function generateClientEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
