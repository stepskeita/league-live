"use client";

import type { FixtureStatus, PublicFixtureSummary } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Filters, type FixtureFilterValues } from "../../components/Filters";
import { Banner } from "../../components/ui/Banner";
import { api } from "../../lib/api";
import { getErrorMessage } from "../../lib/error";
import { formatDateHeading, formatKickoff } from "../../lib/format";
import { useFilterOptions } from "../../lib/use-filter-options";
import styles from "./page.module.css";

const PAGE_SIZE = 20;

type StatusTab = "all" | "upcoming" | "results";

const STATUS_FOR_TAB: Record<StatusTab, FixtureStatus | undefined> = {
  all: undefined,
  upcoming: "scheduled",
  results: "completed",
};

function groupByDate(rows: PublicFixtureSummary[]): [string, PublicFixtureSummary[]][] {
  const map = new Map<string, PublicFixtureSummary[]>();
  for (const row of rows) {
    const key = formatDateHeading(row.datetime);
    const existing = map.get(key);
    if (existing) {
      existing.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return [...map.entries()];
}

function scoreLabel(row: PublicFixtureSummary): string {
  if (row.status === "cancelled") {
    return "Cancelled";
  }
  if (row.home_score !== null && row.away_score !== null) {
    return `${row.home_score} – ${row.away_score}`;
  }
  if (row.status === "in_progress") {
    return "Live";
  }
  return formatKickoff(row.datetime);
}

/**
 * FR33: "browse fixtures and results by country, confederation,
 * organization, competition, category, team, or date" — GET
 * /fixtures/browse, every filter dimension FR33 names plus a status tab to
 * separate upcoming fixtures from results (fixtures *and* results is one
 * listing, distinguished by status, not two separate pages).
 */
export default function FixturesBrowsePage() {
  const filterOptions = useFilterOptions();
  const [filters, setFilters] = useState<FixtureFilterValues>({});
  const [tab, setTab] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<PublicFixtureSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFiltersChange = (next: FixtureFilterValues): void => {
    setFilters(next);
    setPage(1);
  };

  const handleTabChange = (value: StatusTab): void => {
    setTab(value);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setRows(null);
      try {
        const result = await api.fixtures.browse({
          organization_id: filters.organization_id,
          country: filters.country,
          confederation: filters.confederation,
          competition_id: filters.competition_id,
          category: filters.category,
          team_id: filters.team_id,
          date: filters.date,
          status: STATUS_FOR_TAB[tab],
          page,
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setRows(result.fixtures);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load fixtures."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, tab, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groups = groupByDate(rows ?? []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Fixtures &amp; Results</h1>
      <p className={styles.subtitle}>Browse every fixture and result across every competition on LeagueLive.</p>

      <div className={styles.tabs}>
        {(["all", "upcoming", "results"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={value === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => handleTabChange(value)}
          >
            {value === "all" ? "All" : value === "upcoming" ? "Upcoming" : "Results"}
          </button>
        ))}
      </div>

      <Filters
        fields={["country", "confederation", "organization", "competition", "category", "team", "date"]}
        value={filters}
        onChange={handleFiltersChange}
        options={filterOptions}
      />

      {error ? <Banner variant="error">{error}</Banner> : null}
      {filterOptions.error ? <Banner variant="error">{filterOptions.error}</Banner> : null}

      {rows === null ? (
        <p className={styles.empty}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>No fixtures match these filters.</p>
      ) : (
        groups.map(([date, dateRows]) => (
          <section key={date} className={styles.group}>
            <h2 className={styles.groupTitle}>{date}</h2>
            <div className={styles.list}>
              {dateRows.map((row) => (
                <div key={row.id} className={styles.row}>
                  <div className={styles.rowMeta}>
                    <span className={styles.competition}>{row.competition_name}</span>
                    <span className={styles.dot}>·</span>
                    <span>{row.organization_name}</span>
                    {row.venue ? (
                      <>
                        <span className={styles.dot}>·</span>
                        <span>{row.venue.name}</span>
                      </>
                    ) : null}
                  </div>
                  <div className={styles.matchup}>
                    <span className={styles.team}>{row.home_team.name}</span>
                    <span className={styles.score}>{scoreLabel(row)}</span>
                    <span className={styles.team}>{row.away_team.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {total > PAGE_SIZE ? (
        <div className={styles.pager}>
          <button type="button" className={styles.pagerButton} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            Previous
          </button>
          <span className={styles.pagerLabel}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
