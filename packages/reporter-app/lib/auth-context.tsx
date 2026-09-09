import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PermissionKey, User } from "@leaguelive/shared";
import { api } from "./api";
import { clearTokens, getRefreshToken, loadPersistedTokens, registerForceLogoutHandler, setTokens } from "./token-store";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  permissions: PermissionKey[];
  /** e.g. results.verify — the confirm screen uses this to decide whether to show the confirm action at all, since the backend gates it independently of match.report. */
  hasPermission: (key: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchSession(): Promise<{ user: User; permissions: PermissionKey[] }> {
  const [{ user }, { permissions }] = await Promise.all([api.auth.me(), api.auth.myPermissions()]);
  return { user, permissions };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokens = await loadPersistedTokens();
      if (!tokens) {
        if (!cancelled) {
          setStatus("signedOut");
        }
        return;
      }
      try {
        const session = await fetchSession();
        if (!cancelled) {
          setUser(session.user);
          setPermissions(session.permissions);
          setStatus("signedIn");
        }
      } catch {
        await clearTokens();
        if (!cancelled) {
          setStatus("signedOut");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    registerForceLogoutHandler(() => {
      setUser(null);
      setPermissions([]);
      setStatus("signedOut");
    });
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await api.auth.login({ email, password });
    await setTokens(response);
    setUser(response.user);
    setStatus("signedIn");
    // Best-effort, after the fact: login itself only needs the tokens to
    // succeed. If this one call fails, permission-gated UI just stays
    // conservatively hidden until the next successful fetch (e.g. a pull to
    // refresh) rather than failing the sign-in itself over it.
    api.auth
      .myPermissions()
      .then(({ permissions: fetched }) => setPermissions(fetched))
      .catch(() => {});
  };

  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    await clearTokens();
    setUser(null);
    setPermissions([]);
    setStatus("signedOut");
    if (refreshToken) {
      // Best-effort: the user is logged out locally either way, and
      // logout() server-side just revokes a refresh token that's about to
      // sit unused regardless.
      api.auth.logout(refreshToken).catch(() => {});
    }
  };

  const hasPermission = useCallback((key: PermissionKey): boolean => permissions.includes(key), [permissions]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, permissions, hasPermission, login, logout }),
    [status, user, permissions, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
