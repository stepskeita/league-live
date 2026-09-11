"use client";

import type { LiveMatchState } from "@leaguelive/shared";
import { formatElapsedMinutes } from "../lib/format";
import { useNowTick } from "../lib/use-now-tick";
import { LiveBadge } from "./LiveBadge";
import styles from "./LiveScoreCard.module.css";

export interface LiveScoreCardProps {
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  state: LiveMatchState;
}

export function LiveScoreCard({ homeTeam, awayTeam, state }: LiveScoreCardProps) {
  // The elapsed-minute label is derived from started_at + Date.now() (see
  // formatElapsedMinutes) — this tick is what keeps it advancing between
  // FIXTURE_STATE pushes, not a value the server sends.
  useNowTick();

  return (
    <div className={styles.card}>
      <div className={styles.meta}>
        <LiveBadge />
        <span className={styles.minute}>{formatElapsedMinutes(state.started_at)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.team}>{homeTeam.name}</span>
        <span className={styles.score}>{state.home_score}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.team}>{awayTeam.name}</span>
        <span className={styles.score}>{state.away_score}</span>
      </div>
    </div>
  );
}
