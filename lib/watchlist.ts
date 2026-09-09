export const WATCHLIST_KEY = "float.watchlist.v1";

export function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version: number; tickers: string[] };
    return parsed.tickers ?? [];
  } catch {
    return [];
  }
}

export function writeWatchlist(tickers: string[]) {
  localStorage.setItem(
    WATCHLIST_KEY,
    JSON.stringify({ version: 1, tickers }),
  );
}

export function togglePin(ticker: string): string[] {
  const next = readWatchlist();
  const i = next.indexOf(ticker);
  if (i >= 0) next.splice(i, 1);
  else next.push(ticker);
  writeWatchlist(next);
  return next;
}
