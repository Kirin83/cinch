/** Float API. Amounts are decimal strings. Ratios are 0–1. */

export type HexAddress = string;
export type ChecksumAddress = string;
export type Ticker = string;
export type DecimalString = string;
export type IntegerString = string;

export type AssetType = "equity" | "etf" | "commodity";
export type Sector = "mega" | "meme_stocks" | "ai";
export type Dex = "uniswap_v2" | "uniswap_v3" | "uniswap_v4" | "pons_curve";
export type Launchpad = "pons" | "uniswap" | "long" | "other";
export type PairQuality =
  | "pair_canonical"
  | "pair_fake_underlying"
  | "pair_spot_stock"
  | "pair_stock_stock"
  | "unknown";
export type ClassifyKind =
  | "stock_canonical"
  | "stock_impersonator"
  | PairQuality;
export type PoolKind = "meme" | "spot";
export type RiskGrade = "clear" | "caution" | "danger";
export type RiskSeverity = "caution" | "danger";

export type RiskCode =
  | "MINT_ENABLED"
  | "BLACKLIST"
  | "FAKE_UNDERLYING"
  | "HONEYPOT_SIGNAL"
  | "OWNER_ACTIVE"
  | "BUNDLE_FIRST_BUYS"
  | "HIGH_CONCENTRATION"
  | "LP_UNLOCKED";

export type StockSort = "float_locked" | "meme_vol" | "premium" | "pairs";
export type StockFilter = "all" | "mega" | "meme_stocks" | "ai" | "etf";

export type RiskReason = {
  code: RiskCode;
  severity: RiskSeverity;
  text: string;
};

export const RISK_REASON_TEXT: Record<RiskCode, string> = {
  MINT_ENABLED: "Contract can mint",
  BLACKLIST: "Address can be blocked from selling",
  FAKE_UNDERLYING: "Quote is not an official Stock Token",
  HONEYPOT_SIGNAL: "Sells reverted in simulation",
  OWNER_ACTIVE: "Owner can still change parameters",
  BUNDLE_FIRST_BUYS: "First buyers share one funding source",
  HIGH_CONCENTRATION: "Top 10 hold over 30%",
  LP_UNLOCKED: "Liquidity is not locked",
};

export type AsOf = {
  block_number: number;
  taken_at: string;
  lag_seconds: number;
};

export type IndexerMeta = {
  head: AsOf;
  status: "synced" | "behind" | "paused";
};

export type RegistryMeta = {
  asset_count: number;
  synced_at: string;
};

export type ApiErrorCode =
  | "NOT_STOCK_TOKEN"
  | "NOT_IN_REGISTRY"
  | "NOT_INDEXED"
  | "CHAIN_UNREADABLE"
  | "RATE_LIMIT";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    last_good_block?: number;
  };
};

export const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  NOT_STOCK_TOKEN:
    "Not a Robinhood Stock Token. Check the address, not the ticker.",
  NOT_IN_REGISTRY: "That ticker is not in the Robinhood registry.",
  NOT_INDEXED: "Token not indexed yet. Paste the contract on Live in a minute.",
  CHAIN_UNREADABLE: "Could not read the chain. Numbers stale. Last good block …",
  RATE_LIMIT: "Slow down.",
};

export type GetStocksQuery = {
  sort?: StockSort;
  order?: "asc" | "desc";
  filter?: StockFilter;
  hide_empty?: boolean;
};

export type StockHeatmapRow = {
  ticker: Ticker;
  name: string;
  asset_type: AssetType;
  sectors: Sector[];
  is_active: boolean;
  contract: ChecksumAddress;
  contract_hex: HexAddress;
  oracle_price_usd: number | null;
  dex_price_usd: number | null;
  premium_bps: number | null;
  float_locked_pct: number;
  float_locked_pct_change_24h: number | null;
  float_locked_raw: IntegerString;
  total_supply_raw: IntegerString;
  meme_pair_count: number;
  new_pair_count_24h: number;
  meme_vol_24h_usd: number;
  spot_vol_24h_usd: number;
  meme_pressure: number | null;
  as_of: AsOf;
};

export type GetStocksResponse = {
  indexer: IndexerMeta;
  registry: RegistryMeta;
  sort: StockSort;
  order: "asc" | "desc";
  filter: StockFilter;
  hide_empty: boolean;
  stocks: StockHeatmapRow[];
};

export type TokenAmount = {
  raw: IntegerString;
  amount: DecimalString;
  decimals: number;
  symbol: Ticker;
};

export type StockIdentity = {
  ticker: Ticker;
  name: string;
  asset_type: AssetType;
  sectors: Sector[];
  is_active: boolean;
  contract: ChecksumAddress;
  contract_hex: HexAddress;
  decimals: number;
  explorer_url: string;
};

export type StockHero = {
  float_locked_pct: number;
  locked_in_meme_lps: TokenAmount;
  onchain_supply: TokenAmount;
  oracle_price_usd: number | null;
  dex_price_usd: number | null;
  premium_bps: number | null;
  meme_pressure: number | null;
  meme_pair_count: number;
  meme_vol_24h_usd: number;
  spot_vol_24h_usd: number;
};

export type PairRiskChip = {
  grade: RiskGrade;
  summary: string;
  reasons: RiskReason[];
};

export type SwapUrls = {
  pons: string | null;
  long: string | null;
  uniswap: string | null;
  dexscreener: string | null;
};

export type MemePairRow = {
  pool_address: HexAddress;
  dex: Dex;
  launchpad: Launchpad;
  stage: PairStage;
  pair_quality: Extract<PairQuality, "pair_canonical" | "pair_fake_underlying">;
  pool_kind: "meme";
  token: {
    address: HexAddress;
    symbol: string;
    name: string | null;
    created_at: string | null;
  };
  age_seconds: number | null;
  fdv_usd: number | null;
  stock_in_lp: TokenAmount;
  stock_in_lp_pct_of_supply: number;
  volume_usd_24h: number;
  risk: PairRiskChip | null;
  chart_url: string | null;
  swap_urls: SwapUrls | null;
};

export type SpotPoolRow = {
  pool_address: HexAddress;
  dex: Dex;
  pair_quality: "pair_spot_stock";
  pool_kind: "spot";
  quote: "USDG" | "WETH" | "CBBTC";
  stock_in_lp: TokenAmount;
  reserve_usd: number | null;
  volume_usd_24h: number;
};

export type HolderRow = {
  address: HexAddress;
  balance: TokenAmount;
  pct_of_supply: number;
  is_pool: boolean;
};

export type GetStockQuery = {
  hide_dead?: boolean;
  holders?: boolean;
  page?: number;
  page_size?: number;
};

export type GetStockResponse = {
  indexer: IndexerMeta;
  stock: StockIdentity;
  hero: StockHero;
  as_of: AsOf;
  meme_pairs: MemePairRow[];
  meme_pairs_total: number;
  page: number;
  page_size: number;
  spot_pools: SpotPoolRow[];
  holders: HolderRow[] | null;
  og: {
    title: string;
    url: string;
  };
};

// ── GET /api/tokens/:address ─────────────────────────────────────
// Address is lowercased. Official stock contracts set redirect_to_stock.

export type GetTokenQuery = {
  pool?: HexAddress;
};

export type TokenIdentity = {
  address: HexAddress;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  created_at: string | null;
  creator: HexAddress | null;
  launchpad: Launchpad | null;
  is_stock_token: boolean;
  redirect_to_stock: Ticker | null;
};

export type PairUnderlying = {
  pair_quality: Extract<PairQuality, "pair_canonical" | "pair_fake_underlying">;
  pool_address: HexAddress;
  dex: Dex;
  launchpad: Launchpad;
  quote: {
    ticker: Ticker;
    contract: ChecksumAddress;
    contract_hex: HexAddress;
    is_official: boolean;
  };
  stock_in_lp: TokenAmount;
  stock_in_lp_pct_of_supply: number | null;
};

export type FakeUnderlyingBanner = {
  claimed_ticker: Ticker;
  official: {
    ticker: Ticker;
    contract: ChecksumAddress;
    contract_hex: HexAddress;
  };
  this_contract: ChecksumAddress;
  this_contract_hex: HexAddress;
};

export type TokenRisk = {
  grade: RiskGrade;
  checked_at: string;
  owner: HexAddress | null;
  owner_renounced: boolean | null;
  can_mint: boolean | null;
  can_pause: boolean | null;
  can_blacklist: boolean | null;
  buy_tax_bps: number | null;
  sell_tax_bps: number | null;
  lp_locked: boolean | null;
  honeypot_signal: boolean | null;
  top10_pct: number | null;
  creator_launch_count: number | null;
  reasons: RiskReason[];
};

export type TokenMarket = {
  chart_url: string | null;
  price_usdg: number | null;
  marketcap_usdg: number | null;
  quote: string | null;
  volume_usd_1h: number | null;
  volume_usd_6h: number | null;
  volume_usd_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  traders_24h: number | null;
};

export type MemeTradePool = {
  pool_address: HexAddress;
  dex: Dex;
  stage: PairStage;
  quote: string;
  volume_usd_24h: number;
  price_usdg: number | null;
  chart_url: string | null;
  swap_urls: SwapUrls | null;
};

export type TokenPeople = {
  creator: {
    address: HexAddress;
    launch_count: number | null;
    explorer_url: string;
  } | null;
  holders: HolderRow[] | null;
};

export type GetTokenResponse = {
  indexer: IndexerMeta;
  token: TokenIdentity;
  as_of: AsOf;
  stage: PairStage | null;
  underlying: PairUnderlying | null;
  fake_underlying: FakeUnderlyingBanner | null;
  risk: TokenRisk | null;
  market: TokenMarket;
  pools: MemeTradePool[];
  people: TokenPeople;
  swap_urls: SwapUrls | null;
};

// ── GET /api/pairs/live ──────────────────────────────────────────

export type GetLivePairsQuery = {
  ticker?: Ticker;
  canonical_only?: boolean;
  stage?: MarketStage;
  page?: number;
  page_size?: number;
};

export type LivePairRow = {
  created_at: string;
  age_seconds: number;
  pool_address: HexAddress;
  dex: Dex;
  launchpad: Launchpad;
  stage: PairStage;
  pair_quality: Extract<PairQuality, "pair_canonical" | "pair_fake_underlying">;
  meme: {
    address: HexAddress;
    symbol: string | null;
  };
  quote: {
    ticker: Ticker;
    contract: ChecksumAddress;
    contract_hex: HexAddress;
    is_official: boolean;
  };
  stock_in_lp: TokenAmount | null;
  creator_launches_today: number | null;
  token_path: string;
};

export type GetLivePairsResponse = {
  indexer: IndexerMeta;
  canonical_only: boolean;
  stage: MarketStage;
  ticker: Ticker | null;
  last_pair_at: string | null;
  pairs: LivePairRow[];
  pairs_total: number;
  has_more: boolean;
  page: number;
  page_size: number;
};

// ── GET /api/search?q= ───────────────────────────────────────────

export type GetSearchQuery = {
  q: string;
};

export type SearchStockHit = {
  ticker: Ticker;
  name: string;
  contract_hex: HexAddress;
  float_locked_pct: number;
  path: string;
};

export type SearchTokenHit = {
  address: HexAddress;
  symbol: string | null;
  pair_quality: PairQuality;
  stock_ticker: Ticker | null;
  stock_contract_hex: HexAddress | null;
  path: string;
};

export type GetSearchResponse = {
  query: string;
  stocks: SearchStockHit[];
  tokens: SearchTokenHit[];
};

// ── GET /api/status ──────────────────────────────────────────────

export type IndexerKeyState = {
  last_block: number;
  last_ok_at: string;
  lag_seconds: number | null;
};

export type GetStatusResponse = {
  head: IndexerKeyState;
  pons: IndexerKeyState;
  long: IndexerKeyState;
  uniswap_v4: IndexerKeyState;
  registry: RegistryMeta;
};

// ── GET /og/:type/:id and GET /api/og/:type/:id ──────────────────

export type OgType = "home" | "stock" | "token";

export type OgHomeLine = {
  ticker: Ticker;
  float_locked_pct: number;
  meme_vol_24h_usd: number;
};

export type OgHomePayload = {
  type: "home";
  title: "cinch · Robinhood Chain";
  lines: OgHomeLine[];
  url: string;
};

export type OgStockPayload = {
  type: "stock";
  ticker: Ticker;
  name: string | null;
  float_locked_pct: number;
  top_meme_symbol: string | null;
  top_meme_stock_in_lp: TokenAmount | null;
  onchain_supply: TokenAmount;
  premium_bps: number | null;
  meme_vol_24h_usd: number;
  meme_pair_count: number;
  url: string;
};

export type OgTokenPayload = {
  type: "token";
  symbol: string | null;
  pair_quality: Extract<PairQuality, "pair_canonical" | "pair_fake_underlying">;
  stock_ticker: Ticker | null;
  stock_in_lp_pct_of_supply: number | null;
  url: string;
};

export type GetOgResponse = OgHomePayload | OgStockPayload | OgTokenPayload;

// ── GET /api/launch/prefill?ticker= ──────────────────────────────

export type GetLaunchPrefillQuery = {
  ticker: Ticker;
};

export type GetLaunchPrefillResponse = {
  ticker: Ticker;
  name: string;
  contract: ChecksumAddress;
  contract_hex: HexAddress;
  pons_url: string;
};

export type GetVerifyQuery = {
  address: HexAddress;
};

export type GetVerifyResponse = {
  address: HexAddress;
  kind: ClassifyKind;
  copy_line: string;
  official: {
    ticker: Ticker;
    contract: ChecksumAddress;
    contract_hex: HexAddress;
  } | null;
  impersonator: {
    claimed_ticker: Ticker;
    this_contract: ChecksumAddress;
    this_contract_hex: HexAddress;
    official: {
      ticker: Ticker;
      contract: ChecksumAddress;
      contract_hex: HexAddress;
    };
  } | null;
  pair: {
    token0: HexAddress;
    token1: HexAddress;
    pool_address: HexAddress | null;
  } | null;
};

export type LookupLookalike = {
  address: HexAddress;
  symbol: string | null;
  contract_hex: HexAddress;
};

export type GetLookupResponse = {
  ticker: Ticker;
  name: string;
  asset_type: AssetType;
  is_active: boolean;
  contract: ChecksumAddress;
  contract_hex: HexAddress;
  kind: "stock_canonical";
  explorer_url: string;
  lookalikes: LookupLookalike[];
};

export type PairBoardSort = "vol24h";
export type PairBoardQuality = "canonical";
export type MarketStage = "all" | "curve" | "graduated";

export function parseMarketStage(v: string | null | undefined): MarketStage {
  if (v === "curve" || v === "graduated") return v;
  return "all";
}

export type PairStage = Exclude<MarketStage, "all">;

export function pairStage(
  poolId: string | null | undefined,
  graduated?: boolean | null,
): PairStage {
  return poolId || graduated ? "graduated" : "curve";
}

export type GetPairsQuery = {
  quality?: PairBoardQuality;
  sort?: PairBoardSort;
  hide_dead?: boolean;
  stage?: MarketStage;
  page?: number;
  page_size?: number;
};

export type PairBoardRow = {
  pool_address: HexAddress;
  pair_quality: "pair_canonical";
  dex: Dex;
  launchpad: Launchpad;
  stage: PairStage;
  volume_usd_24h: number;
  meme: {
    address: HexAddress;
    symbol: string | null;
    name: string | null;
  };
  stock: {
    ticker: Ticker;
    contract: ChecksumAddress;
    contract_hex: HexAddress;
  };
  stock_in_lp: TokenAmount;
  stock_dex_usdg: number | null;
  chart_url: string | null;
  swap_urls: SwapUrls | null;
  token_path: string;
  stock_path: string;
};

export type GetPairsResponse = {
  indexer: IndexerMeta;
  quality: PairBoardQuality;
  sort: PairBoardSort;
  hide_dead: boolean;
  stage: MarketStage;
  pairs: PairBoardRow[];
  pairs_total: number;
  page: number;
  page_size: number;
};

export type MarketStockRow = {
  ticker: Ticker;
  name: string;
  contract_hex: HexAddress;
  volume_usd_24h: number;
  dex_usdg: number | null;
  stock_path: string;
};

export type GetMarketStocksQuery = {
  hide_dead?: boolean;
  page?: number;
  page_size?: number;
};

export type GetMarketStocksResponse = {
  indexer: IndexerMeta;
  hide_dead: boolean;
  stocks: MarketStockRow[];
  stocks_total: number;
  page: number;
  page_size: number;
};

export type MemeBoardRow = {
  address: HexAddress;
  symbol: string | null;
  name: string | null;
  stage: PairStage;
  volume_usd_24h: number;
  price_usdg: number | null;
  marketcap_usdg: number | null;
  quote: string | null;
  token_path: string;
};

export type GetMemesQuery = {
  hide_dead?: boolean;
  stage?: MarketStage;
  page?: number;
  page_size?: number;
};

export type GetMemesResponse = {
  indexer: IndexerMeta;
  hide_dead: boolean;
  stage: MarketStage;
  memes: MemeBoardRow[];
  memes_total: number;
  page: number;
  page_size: number;
};

export type HomePairHit = PairBoardRow & {
  created_at: string | null;
};

export type HomeFakeHit = {
  meme: { address: HexAddress; symbol: string | null };
  official: { ticker: Ticker; contract: ChecksumAddress; contract_hex: HexAddress };
  this_contract_hex: HexAddress;
  token_path: string;
  stock_path: string;
};

export type HomeMemeHit = {
  address: HexAddress;
  symbol: string | null;
  volume_usd_24h: number;
  token_path: string;
};

export type GetHomeSummaryResponse = {
  indexer: IndexerMeta;
  stage: MarketStage;
  stats: {
    live_canonical: number;
    volume_usd_24h: number;
    new_pairs_24h: number | null;
    fake_count: number | null;
  };
  hottest: PairBoardRow | null;
  newest_live: PairBoardRow | null;
  fake_example: HomeFakeHit | null;
  top_pairs: PairBoardRow[];
  top_stocks: MarketStockRow[];
  top_memes: HomeMemeHit[];
  top: PairBoardRow[];
  newest: HomePairHit[];
  fakes: HomeFakeHit[];
};

// ── /watch localStorage ──────────────────────────────────────────

export const WATCHLIST_STORAGE_KEY = "float.watchlist.v1";

export type WatchlistLocal = {
  version: 1;
  tickers: Ticker[];
};

export type WatchlistRow = {
  ticker: Ticker;
  name: string;
  float_locked_pct: number;
  float_locked_pct_change_24h: number | null;
  new_pair_count_24h: number;
  path: string;
};
