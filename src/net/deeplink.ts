/**
 * Deep links — a room can be shared as a tappable link instead of
 * dictating a 4-letter code over the phone.
 *
 * Two shapes are accepted:
 *   coupgame://join/ABCD                     (custom scheme, always works)
 *   https://coup-game-rooms.web.app/join/ABCD (Android App Link; the page
 *                                              also offers the install)
 * A `?code=ABCD` query is accepted too, for hand-written links.
 */
export const LINK_HOST = 'coup-game-rooms.web.app';

/** Shareable https link for a room code. */
export function joinLink(code: string): string {
  return `https://${LINK_HOST}/join/${code.toUpperCase()}`;
}

/** Pull a room code out of an incoming URL, or null if there isn't one. */
export function parseJoinCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const upper = url.toUpperCase();
  // .../join/ABCD  (tolerates trailing slashes and query strings)
  const path = upper.match(/\/JOIN\/([A-Z]{4})(?:[/?#]|$)/);
  if (path) return path[1];
  // ...?code=ABCD
  const query = upper.match(/[?&]CODE=([A-Z]{4})(?:[&#]|$)/);
  if (query) return query[1];
  // coupgame://ABCD (bare host form)
  const bare = upper.match(/^COUPGAME:\/\/([A-Z]{4})(?:[/?#]|$)/);
  if (bare) return bare[1];
  return null;
}

/* ------------------------------------------------------------------ */
/* Pending join — set by the /join/[code] route, consumed by Home      */
/* ------------------------------------------------------------------ */

let pending: string | null = null;
const listeners = new Set<(code: string) => void>();

export function setPendingJoin(code: string) {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(clean)) return;
  pending = clean;
  listeners.forEach((fn) => fn(clean));
}

export function consumePendingJoin(): string | null {
  const code = pending;
  pending = null;
  return code;
}

export function onPendingJoin(fn: (code: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
