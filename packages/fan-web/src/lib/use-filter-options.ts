"use client";

import type { PublicCompetitionSummary, PublicOrganizationSummary, PublicTeamSummary } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { api } from "./api";
import { getErrorMessage } from "./error";

export interface FilterOptions {
  organizations: PublicOrganizationSummary[];
  competitions: PublicCompetitionSummary[];
  teams: PublicTeamSummary[];
  loading: boolean;
  error: string | null;
}

/**
 * FR33's filter dropdowns (country/confederation/organization/competition/
 * category/team) all derive from these three public directories, fetched
 * once and filtered client side as the viewer narrows their selection —
 * there's no per-filter-change round trip, since none of these lists are
 * large enough to warrant one.
 */
export function useFilterOptions(): FilterOptions {
  const [organizations, setOrganizations] = useState<PublicOrganizationSummary[]>([]);
  const [competitions, setCompetitions] = useState<PublicCompetitionSummary[]>([]);
  const [teams, setTeams] = useState<PublicTeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ organizations: orgs }, { competitions: comps }, { teams: teamList }] = await Promise.all([
          api.organizations.listPublic(),
          api.competitions.listPublic(),
          api.teams.listPublic(),
        ]);
        if (!cancelled) {
          setOrganizations(orgs);
          setCompetitions(comps);
          setTeams(teamList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load filter options."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { organizations, competitions, teams, loading, error };
}
