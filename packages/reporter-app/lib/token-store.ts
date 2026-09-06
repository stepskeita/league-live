import * as SecureStore from "expo-secure-store";
import type { AuthTokens } from "@leaguelive/shared";

const ACCESS_TOKEN_KEY = "leaguelive.accessToken";
const REFRESH_TOKEN_KEY = "leaguelive.refreshToken";

// A synchronous in-memory mirror of what's in SecureStore, so the API
// client's getAccessToken() (called on every request) doesn't have to await
// a SecureStore read each time — only loadPersistedTokens(), called once at
// startup, actually reads from disk.
let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadPersistedTokens(): Promise<AuthTokens | null> {
  const [storedAccess, storedRefresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  accessToken = storedAccess;
  refreshToken = storedRefresh;
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

// A forced logout can originate outside React — the API client's own
// refresh-on-401 path (see lib/api.ts) clears tokens itself when the
// refresh token has also expired. This is how that reaches back into
// AuthProvider's React state so the UI actually redirects to /login instead
// of silently failing every subsequent request.
type ForceLogoutHandler = () => void;
let forceLogoutHandler: ForceLogoutHandler | null = null;

export function registerForceLogoutHandler(handler: ForceLogoutHandler): void {
  forceLogoutHandler = handler;
}

export function triggerForceLogout(): void {
  forceLogoutHandler?.();
}
