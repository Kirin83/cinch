export function prefetchLiveBoard() {
  if (typeof window === "undefined") return;
  void fetch("/api/pairs/live?canonical_only=1&stage=all&page=1&page_size=20");
}
