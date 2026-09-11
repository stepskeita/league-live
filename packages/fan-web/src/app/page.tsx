"use client";

import type { LiveFixtureSummary, LiveMatchState } from "@leaguelive/shared";
import { useEffect, useMemo, useState } from "react";
import { Filters, type FixtureFilterValues } from "../components/Filters";
import { LiveScoreCard } from "../components/LiveScoreCard";
import { Banner } from "../components/ui/Banner";
import { api } from "../lib/api";
import { getErrorMessage } from "../lib/error";
import { useFilterOptions } from "../lib/use-filter-options";
import { useFixtureLiveStates } from "../lib/use-fixture-live-states";
import styles from "./page.module.css";

type LiveRow = { fixture: LiveFixtureSummary; state: LiveMatchState };

function groupByCompetition(rows: LiveRow[]): [string, LiveRow[]][] {
  const map = new Map<string, LiveRow[]>();
  for (const row of rows) {
    const key = row.fixture.competition_name;
    const existing = map.get(key);
    if (existing) {
      existing.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * FR32: live scores across every in-progress match, filterable by
 * organization/country/category. Initial data comes from GET
 * /fixtures/live; ongoing updates come from Prompt 13's Socket.io channel
 * (useFixtureLiveStates), which the initial fetch's fixture ids drive —
 * see that hook and lib/socket.ts.
 */
export default function LiveScoresPage() {
  const filterOptions = useFilterOptions();
  const [filters, setFilters] = useState<FixtureFilterValues>({});
  const [fixtures, setFixtures] = useState<LiveFixtureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (): Promise<void> => {
    setError(null);
    try {
      const { fixtures: list } = await api.fixtures.listLive({
        organization_id: filters.organization_id,
        country: filters.country,
        category: filters.category,
      });
      setFixtures(list);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load live scores."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setFixtures(null);
      try {
        const { fixtures: list } = await api.fixtures.listLive({
          organization_id: filters.organization_id,
          country: filters.country,
          category: filters.category,
        });
        if (!cancelled) {
          setFixtures(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load live scores."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.organization_id, filters.country, filters.category]);

  const fixtureIds = useMemo(() => (fixtures ?? []).map((fixture) => fixture.fixture_id), [fixtures]);
  const liveStates = useFixtureLiveStates(fixtureIds);

  // Realtime pushes can move a fixture past "in_progress" (full time,
  // cancelled) without a page refresh — those drop off this live list
  // rather than lingering, since this page is specifically "what's live
  // right now," not a results list (that's the fixtures/browse page).
  const visibleRows: LiveRow[] = (fixtures ?? [])
    .map((fixture) => ({ fixture, state: liveStates[fixture.fixture_id] ?? fixture.liveMatchState }))
    .filter((row) => row.state.status === "in_progress");

  const groups = groupByCompetition(visibleRows);

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Live Scores</h1>
          <p className={styles.subtitle}>Every match in progress right now, updating live.</p>
        </div>
        <button type="button" className={styles.refresh} onClick={() => void handleRefresh()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <Filters fields={["organization", "country", "category"]} value={filters} onChange={setFilters} options={filterOptions} />

      {error ? <Banner variant="error">{error}</Banner> : null}
      {filterOptions.error ? <Banner variant="error">{filterOptions.error}</Banner> : null}

      {fixtures === null ? (
        <p className={styles.empty}>Loading live scores…</p>
      ) : visibleRows.length === 0 ? (
        <p className={styles.empty}>No matches in progress right now.</p>
      ) : (
        groups.map(([competitionName, rows]) => (
          <section key={competitionName} className={styles.group}>
            <h2 className={styles.groupTitle}>{competitionName}</h2>
            <div className={styles.grid}>
              {rows.map(({ fixture, state }) => (
                <LiveScoreCard key={fixture.fixture_id} homeTeam={fixture.home_team} awayTeam={fixture.away_team} state={state} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
