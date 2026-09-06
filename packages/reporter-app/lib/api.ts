import { createLeagueLiveApiClient } from "@leaguelive/shared";
import { clearTokens, getAccessToken, getRefreshToken, setTokens, triggerForceLogout } from "./token-store";

// Set EXPO_PUBLIC_API_BASE_URL in .env for a physical device or emulator —
// "localhost" only reaches the backend from the same machine running the
// Metro bundler. See .env.example.
const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const api = createLeagueLiveApiClient({
  baseUrl,
  getAccessToken: () => getAccessToken(),
  // Referencing `api` from inside its own config is safe here: this
  // function only ever runs later, on a 401 from some other request, by
  // which point the `const api = ...` assignment below has long since
  // completed.
  refreshAccessToken: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    try {
      const tokens = await api.auth.refresh(refreshToken);
      await setTokens(tokens);
      return tokens.accessToken;
    } catch {
      await clearTokens();
      triggerForceLogout();
      return null;
    }
  },
});
