import { createLeagueLiveApiClient } from "@leaguelive/shared";
import { clearTokens, getAccessToken, getRefreshToken, setTokens, triggerForceLogout } from "./token-store";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const api = createLeagueLiveApiClient({
  baseUrl,
  getAccessToken: () => getAccessToken(),
  // Referencing `api` from inside its own config is safe: this function
  // only ever runs later, on a 401 from some other request, by which point
  // the `const api = ...` assignment below has long since completed.
  refreshAccessToken: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }
    try {
      const tokens = await api.auth.refresh(refreshToken);
      setTokens(tokens);
      return tokens.accessToken;
    } catch {
      clearTokens();
      triggerForceLogout();
      return null;
    }
  },
});
