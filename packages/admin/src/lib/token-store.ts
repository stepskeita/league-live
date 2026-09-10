import type { AuthTokens } from "@leaguelive/shared";

const ACCESS_TOKEN_KEY = "leaguelive.admin.accessToken";
const REFRESH_TOKEN_KEY = "leaguelive.admin.refreshToken";

// A synchronous in-memory mirror of localStorage, same reasoning as
// reporter-app's token-store.ts: the API client's getAccessToken() (called
// on every request) shouldn't have to touch storage each time.
let accessToken: string | null = null;
let refreshToken: string | null = null;

// localStorage is only ever touched from client components, and only after
// mount — this module is imported by server-rendered code too (the root
// layout tree), so every access here is guarded against SSR, where
// `window` doesn't exist.
function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function loadPersistedTokens(): AuthTokens | null {
  if (!hasWindow()) {
    return null;
  }
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export function setTokens(tokens: AuthTokens): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (hasWindow()) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  if (hasWindow()) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

// Same bridge as reporter-app: the API client's own refresh-on-401 path
// (lib/api.ts) can decide a session is over (refresh token also expired)
// from outside React entirely — this is how that reaches back into
// AuthProvider's state so the UI actually redirects to /login.
type ForceLogoutHandler = () => void;
let forceLogoutHandler: ForceLogoutHandler | null = null;

export function registerForceLogoutHandler(handler: ForceLogoutHandler): void {
  forceLogoutHandler = handler;
}

export function triggerForceLogout(): void {
  forceLogoutHandler?.();
}
