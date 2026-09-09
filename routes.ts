import { PONS_LAUNCH_URL } from "@/lib/chain";

export const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://cinch.report";

export const routes = {
  home: "/",
  analytics: "/home",
  stock: (ticker: string) => `/s/${ticker.toUpperCase()}`,
  token: (address: string) => `/t/${address.toLowerCase()}`,
  live: "/live",
  verify: "/verify",
  launch: PONS_LAUNCH_URL,
  watch: "/watch",
  docs: "/docs",
  methodology: "/docs",
  disclaimer: "/disclaimer",
  status: "/status",
  og: (type: "home" | "stock" | "token", id: string) =>
    type === "home" ? "/og/home/snapshot" : `/og/${type}/${id}`,
  shareStock: (ticker: string) => `/share/${ticker.toUpperCase()}`,
} as const;

export const api = {
  stocks: "/api/stocks",
  stock: (ticker: string) => `/api/stocks/${ticker.toUpperCase()}`,
  token: (address: string) => `/api/tokens/${address.toLowerCase()}`,
  pairsLive: "/api/pairs/live",
  pairs: "/api/pairs",
  marketStocks: "/api/markets/stocks",
  memes: "/api/markets/memes",
  homeSummary: "/api/home/summary",
  verify: "/api/verify",
  lookup: (ticker: string) => `/api/lookup/${ticker.toUpperCase()}`,
  search: "/api/search",
  status: "/api/status",
  launchPrefill: "/api/launch/prefill",
  og: (type: "home" | "stock" | "token", id: string) =>
    type === "home" ? "/api/og/home/snapshot" : `/api/og/${type}/${id}`,
} as const;

export const redirects = {
  stockTicker: (ticker: string) => ({
    from: `/s/${ticker}`,
    to: `/s/${ticker.toUpperCase()}`,
  }),
  legacyToken: (address: string) => ({
    from: `/token/${address}`,
    to: `/t/${address.toLowerCase()}`,
  }),
} as const;
