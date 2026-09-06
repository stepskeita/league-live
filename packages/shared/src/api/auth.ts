import type { PermissionKey } from "../types/permission";
import type { User } from "../types/user";
import type { ApiClient } from "./client";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  // Omit for a platform-level account.
  organization_id?: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface MyPermissionsResponse {
  permissions: PermissionKey[];
}

export function createAuthApi(client: ApiClient) {
  return {
    login: (input: LoginInput) => client.post<AuthResponse>("/auth/login", input, { auth: false }),
    signup: (input: SignupInput) => client.post<AuthResponse>("/auth/signup", input, { auth: false }),
    refresh: (refreshToken: string) => client.post<AuthTokens>("/auth/refresh", { refreshToken }, { auth: false }),
    logout: (refreshToken: string) => client.post<void>("/auth/logout", { refreshToken }, { auth: false }),
    me: () => client.get<MeResponse>("/auth/me"),
    myPermissions: () => client.get<MyPermissionsResponse>("/auth/me/permissions"),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
