import type {
  GetLaunchPrefillResponse,
  GetLivePairsQuery,
  GetLivePairsResponse,
  GetOgResponse,
  GetSearchResponse,
  GetStatusResponse,
  GetStockResponse,
  GetStocksResponse,
  GetTokenResponse,
  PairQuality,
} from "@/types";
import { parseMarketStage, pairStage } from "@/types";
import { PONS_LAUNCH_URL } from "@/lib/chain";
import { SITE_ORIGIN } from "@/routes";
import stocks from "@/examples/get-stocks.json";
import hims from "@/examples/get-stock-HIMS.json";
import boner from "@/examples/get-token-BONER.json";
import fake from "@/examples/get-token-fake.json";
import live from "@/examples/get-pairs-live.json";
import searchHims from "@/examples/get-search.json";
import status from "@/examples/get-status.json";
import launchNvda from "@/examples/get-launch-NVDA.json";
import ogHome from "@/examples/get-og-home.json";
import ogHims from "@/examples/get-og-stock-HIMS.json";

const stocksData = stocks as GetStocksResponse;
const stockByTicker: Record<string, GetStockResponse> = {
  HIMS: hims as GetStockResponse,
};
const tokens: GetTokenResponse[] = [
  boner as GetTokenResponse,
  fake as GetTokenResponse,
];
const liveData = live as GetLivePairsResponse;

export function getStocks(): GetStocksResponse {
  return stocksData;
}

export function getStock(ticker: string): GetStockResponse | null {
  const upper = ticker.toUpperCase();
  if (stockByTicker[upper]) return stockByTicker[upper];
  const row = stocksData.stocks.find((s) => s.ticker === upper);
  if (!row) return null;
  const amount = (raw: string) => String(Number(raw) / 1e18);
  return {
    indexer: stocksData.indexer,
    stock: {
      ticker: row.ticker,
      name: row.name,
      asset_type: row.asset_type,
      sectors: row.sectors,
      is_active: row.is_active,
      contract: row.contract,
      contract_hex: row.contract_hex,
      decimals: 18,
      explorer_url: `https://explorer.robinhood.com/address/${row.contract_hex}`,
    },
    hero: {
      float_locked_pct: row.float_locked_pct,
      locked_in_meme_lps: {
        raw: row.float_locked_raw,
        amount: amount(row.float_locked_raw),
        decimals: 18,
        symbol: row.ticker,
      },
      onchain_supply: {
        raw: row.total_supply_raw,
        amount: amount(row.total_supply_raw),
        decimals: 18,
        symbol: row.ticker,
      },
      oracle_price_usd: row.oracle_price_usd,
      dex_price_usd: row.dex_price_usd,
      premium_bps: row.premium_bps,
      meme_pressure: row.meme_pressure,
      meme_pair_count: row.meme_pair_count,
      meme_vol_24h_usd: row.meme_vol_24h_usd,
      spot_vol_24h_usd: row.spot_vol_24h_usd,
    },
    as_of: row.as_of,
    meme_pairs: [],
    meme_pairs_total: 0,
    page: 1,
    page_size: 10,
    spot_pools: [],
    holders: null,
    og: {
      title: `${row.ticker} is ${Math.round(row.float_locked_pct * 100)}% locked`,
      url: `${SITE_ORIGIN}/s/${row.ticker}`,
    },
  };
}

export function getToken(address: string): GetTokenResponse | null {
  const hex = address.toLowerCase();
  return tokens.find((t) => t.token.address === hex) ?? null;
}

export function getLivePairs(query: GetLivePairsQuery = {}): GetLivePairsResponse {
  const canonicalOnly = query.canonical_only !== false;
  const ticker = query.ticker?.toUpperCase() ?? null;
  const stage = parseMarketStage(query.stage);
  const pairs = liveData.pairs
    .map((row) => ({ ...row, stage: row.stage ?? pairStage(null) }))
    .filter((row) => {
      if (canonicalOnly && row.pair_quality !== "pair_canonical") return false;
      if (ticker && row.quote.ticker !== ticker) return false;
      if (stage === "curve" && row.stage !== "curve") return false;
      if (stage === "graduated" && row.stage !== "graduated") return false;
      return true;
    });
  return {
    ...liveData,
    canonical_only: canonicalOnly,
    stage,
    ticker,
    pairs,
    pairs_total: pairs.length,
    has_more: false,
    page: 1,
    page_size: 20,
  };
}

export function search(q: string): GetSearchResponse {
  const query = q.trim();
  if (!query) return { query, stocks: [], tokens: [] };
  if (query.toUpperCase() === "HIMS" || query.toLowerCase().startsWith("0xcc")) {
    return searchHims as GetSearchResponse;
  }
  const upper = query.toUpperCase();
  const lower = query.toLowerCase();
  const stockHits = stocksData.stocks
    .filter(
      (s) =>
        s.ticker.includes(upper) ||
        s.name.toLowerCase().includes(lower) ||
        s.contract_hex === lower,
    )
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      contract_hex: s.contract_hex,
      float_locked_pct: s.float_locked_pct,
      path: `/s/${s.ticker}`,
    }));
  const tokenHits = tokens
    .filter(
      (t) =>
        t.token.address === lower ||
        (t.token.symbol && t.token.symbol.toUpperCase().includes(upper)),
    )
    .map((t) => ({
      address: t.token.address,
      symbol: t.token.symbol,
      pair_quality: (t.underlying?.pair_quality ?? "unknown") as PairQuality,
      stock_ticker: t.underlying?.quote.is_official
        ? t.underlying.quote.ticker
        : null,
      stock_contract_hex: t.underlying?.quote.contract_hex ?? null,
      path: `/t/${t.token.address}`,
    }));
  return { query, stocks: stockHits, tokens: tokenHits };
}

export function getStatus(): GetStatusResponse {
  return status as GetStatusResponse;
}

export function getLaunchPrefill(ticker: string): GetLaunchPrefillResponse | null {
  const upper = ticker.toUpperCase();
  if (upper === "NVDA") return launchNvda as GetLaunchPrefillResponse;
  const row = stocksData.stocks.find((s) => s.ticker === upper);
  if (!row) return null;
  return {
    ticker: row.ticker,
    name: row.name,
    contract: row.contract,
    contract_hex: row.contract_hex,
    pons_url: PONS_LAUNCH_URL,
  };
}

export function getOgHome(): GetOgResponse {
  return ogHome as GetOgResponse;
}

export function getOgStock(ticker: string): GetOgResponse | null {
  if (ticker.toUpperCase() === "HIMS") return ogHims as GetOgResponse;
  const row = stocksData.stocks.find((s) => s.ticker === ticker.toUpperCase());
  if (!row) return null;
  return {
    type: "stock",
    ticker: row.ticker,
    name: row.name,
    float_locked_pct: row.float_locked_pct,
    top_meme_symbol: null,
    top_meme_stock_in_lp: null,
    onchain_supply: {
      raw: row.total_supply_raw,
      amount: "0",
      decimals: 18,
      symbol: row.ticker,
    },
    premium_bps: row.premium_bps,
    meme_vol_24h_usd: row.meme_vol_24h_usd,
    meme_pair_count: row.meme_pair_count,
    url: `${SITE_ORIGIN}/s/${row.ticker}`,
  };
}
