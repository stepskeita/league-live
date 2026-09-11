import { ApiRequestError } from "@leaguelive/shared";

/** The one place this ternary lives, instead of repeated across every page that calls the API. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}
