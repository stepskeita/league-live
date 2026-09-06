export interface ApiErrorIssue {
  path: string;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly issues?: ApiErrorIssue[];

  constructor(status: number, message: string, issues?: ApiErrorIssue[]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.issues = issues;
  }
}

export interface ApiRequestOptions {
  body?: unknown;
  query?: Record<string, string | undefined>;
  // Defaults to true. Set false for a request that must go out with no
  // access token attached (login, signup, refresh, logout) — those are the
  // only requests where sending a stale/absent token isn't just unnecessary
  // but would trigger the refresh-and-retry dance below for no reason.
  auth?: boolean;
}

export interface ApiClient {
  request<T>(method: string, path: string, options?: ApiRequestOptions): Promise<T>;
  get<T>(
    path: string,
    query?: Record<string, string | undefined>,
    options?: Omit<ApiRequestOptions, "body" | "query">,
  ): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body">): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body">): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "body">): Promise<T>;
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T>;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  // Called on a 401 for a request that had a token attached. Should refresh
  // and return the new access token (persisting it is the caller's job —
  // this client only holds it for the single retry below), or return
  // null/throw if refreshing itself failed, in which case the original 401
  // is what the caller sees.
  refreshAccessToken?: () => Promise<string | null>;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | undefined>): string {
  // Deliberately not using the URL/URLSearchParams globals: they're not
  // reliably available across every runtime this package ships to (older
  // React Native/Hermes in particular), and string concatenation is all a
  // handful of query params needs.
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${cleanPath}`;

  if (query) {
    const parts = Object.entries(query)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    if (parts.length > 0) {
      url += `?${parts.join("&")}`;
    }
  }

  return url;
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

interface ErrorResponseBody {
  error?: {
    message?: string;
    issues?: ApiErrorIssue[];
  };
}

/**
 * A minimal HTTP client with no dependency beyond the global `fetch` —
 * available in browsers, Node 18+, and React Native — so it works
 * identically across every LeagueLive frontend (admin, fan-web, fan-app,
 * reporter-app). The point of putting this here, in `shared`, rather than
 * in each frontend, is that request/response shapes (and error handling,
 * and the refresh-on-401 dance) are defined exactly once.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    options: ApiRequestOptions = {},
    isRetryAfterRefresh = false,
  ): Promise<T> {
    const auth = options.auth ?? true;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    let token: string | null = null;
    if (auth && config.getAccessToken) {
      token = await config.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(buildUrl(config.baseUrl, path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    // Exactly one refresh-and-retry per request — never for a request that
    // deliberately went out without a token (auth: false, e.g. login
    // itself), and never a second time, so a refresh that produces a token
    // still rejected by the server fails instead of looping.
    if (response.status === 401 && auth && token && !isRetryAfterRefresh && config.refreshAccessToken) {
      const newToken = await config.refreshAccessToken().catch(() => null);
      if (newToken) {
        return request<T>(method, path, options, true);
      }
    }

    if (!response.ok) {
      const body = (await safeParseJson(response)) as ErrorResponseBody | undefined;
      throw new ApiRequestError(
        response.status,
        body?.error?.message ?? response.statusText ?? "Request failed",
        body?.error?.issues,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  return {
    request,
    get: (path, query, options) => request("GET", path, { ...options, query }),
    post: (path, body, options) => request("POST", path, { ...options, body }),
    patch: (path, body, options) => request("PATCH", path, { ...options, body }),
    put: (path, body, options) => request("PUT", path, { ...options, body }),
    delete: (path, options) => request("DELETE", path, options),
  };
}
