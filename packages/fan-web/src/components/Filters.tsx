"use client";

import { useMemo } from "react";
import type { FilterOptions } from "../lib/use-filter-options";
import styles from "./Filters.module.css";

export interface FixtureFilterValues {
  organization_id?: string;
  country?: string;
  confederation?: string;
  competition_id?: string;
  category?: string;
  team_id?: string;
  date?: string;
}

export type FilterField = "country" | "confederation" | "organization" | "competition" | "category" | "team" | "date";

export interface FiltersProps {
  /** Which dimensions to show, and in what order — FR32's live scores page shows fewer than FR33's browse page. */
  fields: FilterField[];
  value: FixtureFilterValues;
  onChange: (next: FixtureFilterValues) => void;
  options: FilterOptions;
}

/**
 * FR33: "browse fixtures and results by country, confederation,
 * organization, competition, category, team, or date" — one filter bar,
 * reused (with a narrower `fields` list) by the live scores page for FR32's
 * "across organizations, countries, and categories." Each dropdown narrows
 * the ones after it (picking an Organization scopes Competition/Team, for
 * instance) — selections that would become invalid are cleared, not left
 * silently mismatched.
 */
export function Filters({ fields, value, onChange, options }: FiltersProps) {
  const countries = useMemo(
    () => [...new Set(options.organizations.map((org) => org.country).filter((c): c is string => Boolean(c)))].sort(),
    [options.organizations],
  );
  const confederations = useMemo(
    () => [...new Set(options.organizations.map((org) => org.confederation).filter((c): c is string => Boolean(c)))].sort(),
    [options.organizations],
  );

  const organizations = useMemo(
    () =>
      options.organizations.filter(
        (org) =>
          (!value.country || org.country === value.country) &&
          (!value.confederation || org.confederation === value.confederation),
      ),
    [options.organizations, value.country, value.confederation],
  );

  const competitionsScopedToOrg = useMemo(
    () => options.competitions.filter((comp) => !value.organization_id || comp.organization_id === value.organization_id),
    [options.competitions, value.organization_id],
  );

  const categories = useMemo(
    () => [...new Set(competitionsScopedToOrg.map((comp) => comp.category))].sort(),
    [competitionsScopedToOrg],
  );

  const competitions = useMemo(
    () => competitionsScopedToOrg.filter((comp) => !value.category || comp.category === value.category),
    [competitionsScopedToOrg, value.category],
  );

  const teams = useMemo(
    () =>
      options.teams.filter(
        (team) =>
          (!value.organization_id || team.organization_id === value.organization_id) &&
          (!value.category || team.category === value.category),
      ),
    [options.teams, value.organization_id, value.category],
  );

  const setField = (patch: Partial<FixtureFilterValues>): void => onChange({ ...value, ...patch });

  const hasActiveFilter = Object.values(value).some((v) => v !== undefined && v !== "");

  return (
    <div className={styles.bar}>
      {fields.includes("country") ? (
        <select
          className={styles.select}
          value={value.country ?? ""}
          onChange={(event) =>
            setField({
              country: event.target.value || undefined,
              organization_id: undefined,
              competition_id: undefined,
              team_id: undefined,
            })
          }
        >
          <option value="">Country</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("confederation") ? (
        <select
          className={styles.select}
          value={value.confederation ?? ""}
          onChange={(event) =>
            setField({
              confederation: event.target.value || undefined,
              organization_id: undefined,
              competition_id: undefined,
              team_id: undefined,
            })
          }
        >
          <option value="">Confederation</option>
          {confederations.map((confederation) => (
            <option key={confederation} value={confederation}>
              {confederation}
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("organization") ? (
        <select
          className={styles.select}
          value={value.organization_id ?? ""}
          onChange={(event) =>
            setField({ organization_id: event.target.value || undefined, competition_id: undefined, team_id: undefined })
          }
        >
          <option value="">Organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("category") ? (
        <select
          className={styles.select}
          value={value.category ?? ""}
          onChange={(event) => setField({ category: event.target.value || undefined, competition_id: undefined, team_id: undefined })}
        >
          <option value="">Category</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("competition") ? (
        <select
          className={styles.select}
          value={value.competition_id ?? ""}
          onChange={(event) => setField({ competition_id: event.target.value || undefined })}
        >
          <option value="">Competition</option>
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name} ({comp.season})
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("team") ? (
        <select
          className={styles.select}
          value={value.team_id ?? ""}
          onChange={(event) => setField({ team_id: event.target.value || undefined })}
        >
          <option value="">Team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      ) : null}

      {fields.includes("date") ? (
        <input
          type="date"
          className={styles.select}
          value={value.date ?? ""}
          onChange={(event) => setField({ date: event.target.value || undefined })}
        />
      ) : null}

      {hasActiveFilter ? (
        <button type="button" className={styles.clear} onClick={() => onChange({})}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
