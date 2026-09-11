/**
 * LiveMatchState has no running-clock field of its own (see its comment in
 * @leaguelive/shared — deliberately a small, flat shape), so the "elapsed
 * minute" a fan sees is derived client side from `started_at` rather than
 * pushed by the server.
 */
export function formatElapsedMinutes(startedAt: string | null): string {
  if (!startedAt) {
    return "";
  }
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  return `${minutes}'`;
}

export function formatKickoff(datetime: string): string {
  return new Date(datetime).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateHeading(datetime: string): string {
  return new Date(datetime).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
