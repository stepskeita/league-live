import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiRequestError, type Fixture } from "@leaguelive/shared";
import { api } from "./api";

export interface FixturesContextValue {
  fixtures: Fixture[] | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  /**
   * There's no GET /fixtures/:id a plain Reporter can call (that's
   * fixture.manage gated) — so screens that need one fixture's data look it
   * up from this already-fetched list rather than fetching it again.
   */
  getById: (id: string) => Fixture | undefined;
  /** After start/end/confirm, the backend returns the updated Fixture — push it back in here so every screen (home list included) stays in sync without a full refetch. */
  updateFixture: (fixture: Fixture) => void;
}

const FixturesContext = createContext<FixturesContextValue | undefined>(undefined);

// Only ever mounted while status is "signedIn" — the (app) layout renders
// <Redirect> instead of this provider's subtree as soon as it isn't (see
// app/(app)/_layout.tsx), so there's no "clear on logout" branch to write
// here: this provider unmounts, state and all, right along with it.
export function FixturesProvider({ children }: { children: ReactNode }) {
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const { fixtures: mine } = await api.fixtures.listMine();
      setFixtures(mine);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load your fixtures.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const { fixtures: mine } = await api.fixtures.listMine();
        if (!cancelled) {
          setFixtures(mine);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Couldn't load your fixtures.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const getById = useCallback((id: string) => fixtures?.find((fixture) => fixture.id === id), [fixtures]);

  const updateFixture = useCallback((updated: Fixture) => {
    setFixtures((prev) => (prev ? prev.map((fixture) => (fixture.id === updated.id ? updated : fixture)) : prev));
  }, []);

  const value = useMemo<FixturesContextValue>(
    () => ({ fixtures, error, refreshing, refresh, getById, updateFixture }),
    [fixtures, error, refreshing, refresh, getById, updateFixture],
  );

  return <FixturesContext.Provider value={value}>{children}</FixturesContext.Provider>;
}

export function useFixtures(): FixturesContextValue {
  const context = useContext(FixturesContext);
  if (!context) {
    throw new Error("useFixtures must be used within a FixturesProvider");
  }
  return context;
}
