import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@leaguelive/shared";
import { api } from "./api";
import { clearTokens, getRefreshToken, loadPersistedTokens, registerForceLogoutHandler, setTokens } from "./token-store";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

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
        const { user: me } = await api.auth.me();
        if (!cancelled) {
          setUser(me);
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
      setStatus("signedOut");
    });
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await api.auth.login({ email, password });
    await setTokens(response);
    setUser(response.user);
    setStatus("signedIn");
  };

  const logout = async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    await clearTokens();
    setUser(null);
    setStatus("signedOut");
    if (refreshToken) {
      // Best-effort: the user is logged out locally either way, and
      // logout() server-side just revokes a refresh token that's about to
      // sit unused regardless.
      api.auth.logout(refreshToken).catch(() => {});
    }
  };

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, logout }), [status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
