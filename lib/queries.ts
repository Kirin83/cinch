import { getAddress, formatUnits } from "viem";
import { db, databaseUrl } from "@/lib/db";
import { explorerAddress, ponsTokenUrl, longTokenUrl, dexScreenerPairUrl, PONS_LAUNCH_URL, USDG, WETH, ZERO, CBBTC, LONG_V4_TICK_SPACING } from "@/lib/chain";
import { classify, isFakeUnderlying, isMemeCanonical, isSpotStockPair, normalizeHex } from "@/lib/classify";
import { SITE_ORIGIN } from "@/routes";
import { fetchTokenHolders, withPctOfSupply } from "@/lib/holders";
import {
  memePriceUsdg,
  otherToken,
  quoteUsdRate,
  readTotalSupplies,
  readV4States,
  readV4WantAmounts,
  rpcClient,
  tokenDecimals,
} from "@/lib/v4rpc";
import { priceToken1PerToken0, sortedPair } from "@/lib/v4math";
import type {
  ClassifyKind,
  GetHomeSummaryResponse,
  HomeFakeHit,
  GetLaunchPrefillResponse,
  GetLivePairsQuery,
  GetLivePairsResponse,
  GetLookupResponse,
  GetOgResponse,
  GetPairsQuery,
  GetPairsResponse,
  MarketStage,
  GetMarketStocksQuery,
  GetMarketStocksResponse,
  MarketStockRow,
  GetMemesQuery,
  GetMemesResponse,
  MemeBoardRow,
  MemeTradePool,
  GetSearchResponse,
  GetStatusResponse,
  GetStockResponse,
  GetStocksResponse,
  GetTokenResponse,
  GetVerifyResponse,
  MemePairRow,
  PairBoardRow,
  PairQuality,
  RiskGrade,
  Sector,
  StockHeatmapRow,
  SwapUrls,
  TokenAmount,
} from "@/types";
import { parseMarketStage, pairStage } from "@/types";
import { asLaunchpad } from "@/lib/format";
import { memo } from "@/lib/memo";

const READ_TTL_MS = 20_000;

const STOCK_MEME_PAGE_SIZE = 10;
const BOARD_PAGE_SIZE = 20;

/** Live 24h volume from swaps — not stale pool_snapshots.volume_usd_24h. */
const VOL24_CTE = `
  vol24 AS (
    SELECT pool_id, sum(usd_notional) AS volume_usd_24h
    FROM swaps
    WHERE taken_at > now() - interval '24 hours'
    GROUP BY pool_id
  )
`;

/** Curve = not swept/graduated yet. Graduated = LaunchSwept/PoolGraduated/PoolRegistered (flag or v4 pool_id). */
function poolStageSql(alias = "p", param = "$2") {
  return `
    AND (
      ${param}::text = 'all'
      OR (${param} = 'curve' AND NOT COALESCE(${alias}.graduated, false) AND ${alias}.pool_id IS NULL)
      OR (${param} = 'graduated' AND (COALESCE(${alias}.graduated, false) OR ${alias}.pool_id IS NOT NULL))
    )
  `;
}

function clampPage(opts: { page?: number; page_size?: number }, cap: number) {
  const pageSize = Math.min(cap, Math.max(1, opts.page_size ?? cap));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function amount(raw: string | number | bigint | null, decimals: number, symbol: string): TokenAmount {
  const rawStr = raw == null ? "0" : String(raw);
  let formatted = "0";
  try {
    formatted = formatUnits(BigInt(rawStr.split(".")[0] || "0"), decimals);
  } catch {
    formatted = "0";
  }
  return { raw: rawStr.split(".")[0] || "0", amount: formatted, decimals, symbol };
}

function checksum(hex: string): string {
  try {
    return getAddress(hex);
  } catch {
    return hex;
  }
}

function memeSwapUrls(
  meme: string,
  quoteHex: string,
  poolId: string | null,
  launchpad: string | null,
): SwapUrls {
  const pad = asLaunchpad(launchpad);
  return {
    pons: pad === "long" ? null : ponsTokenUrl(meme),
    long: pad === "long" ? longTokenUrl(meme) : null,
    uniswap: `https://app.uniswap.org/swap?chain=robinhood&inputCurrency=${quoteHex}&outputCurrency=${meme}`,
    dexscreener: dexScreenerPairUrl(poolId),
  };
}

type PairSqlRow = {
  address: string;
  dex: string;
  meme_address: string | null;
  pair_quality: string;
  created_at: Date | null;
  token0: string;
  token1: string;
  pool_id: string | null;
  graduated?: boolean | null;
  symbol: string | null;
  name: string | null;
  token_created: Date | null;
  tick_spacing: number | null;
  stock_bal_raw: string | null;
  volume_usd_24h: string | null;
  reserve_usd: string | null;
  grade: string | null;
  reasons: unknown;
  launchpad: string | null;
};

async function hydrateZeroV4StockLp(
  rows: {
    pool_id: string | null;
    token0: string;
    token1: string;
    tick_spacing?: number | null;
    launchpad?: string | null;
    stock_bal_raw: string | null;
    stock_hex: string;
  }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const client = rpcClient();
  if (!client) return out;
  const jobs = rows.filter((r) => {
    if (!r.pool_id || !/^0x[0-9a-f]{64}$/i.test(r.pool_id)) return false;
    const raw = (r.stock_bal_raw ?? "0").split(".")[0] || "0";
    return raw === "0";
  });
  if (!jobs.length) return out;
  try {
    const amts = await readV4WantAmounts(
      client,
      jobs.map((r) => ({
        poolId: r.pool_id as string,
        token0: r.token0,
        token1: r.token1,
        want: r.stock_hex,
        tickSpacing: r.tick_spacing ?? (r.launchpad === "long" ? LONG_V4_TICK_SPACING : null),
      })),
    );
    for (const [id, amt] of amts) {
      if (amt <= 0n) continue;
      out.set(id, amt.toString());
      await db().query(
        `UPDATE pool_snapshots s SET stock_bal_raw = $1
         FROM pools p
         WHERE s.pool_id = p.id
           AND lower(p.pool_id) = $2
           AND s.block_number = (SELECT max(block_number) FROM pool_snapshots)`,
        [amt.toString(), id],
      );
    }
  } catch {
    /* RPC miss — keep snapshot zeros */
  }
  return out;
}

function mapMemePair(p: PairSqlRow, ticker: string, stockHex: string, supply: TokenAmount): MemePairRow {
  const bal = amount(p.stock_bal_raw, 18, ticker);
  const supplyNum = Number(supply.amount) || 0;
  const lockedNum = Number(bal.amount) || 0;
  const grade = (p.grade as RiskGrade | null) ?? null;
  const pairQuality = isFakeUnderlying(p.pair_quality) ? "pair_fake_underlying" as const : "pair_canonical" as const;
  return {
    pool_address: p.address,
    dex: p.dex as MemePairRow["dex"],
    launchpad: asLaunchpad(p.launchpad),
    stage: pairStage(p.pool_id, p.graduated),
    pair_quality: pairQuality,
    pool_kind: "meme",
    token: {
      address: p.meme_address as string,
      symbol: p.symbol ?? "???",
      name: p.name,
      created_at: p.token_created?.toISOString() ?? null,
    },
    age_seconds: p.created_at
      ? Math.round((Date.now() - p.created_at.getTime()) / 1000)
      : null,
    fdv_usd: null,
    stock_in_lp: bal,
    stock_in_lp_pct_of_supply: supplyNum > 0 ? lockedNum / supplyNum : 0,
    volume_usd_24h: Number(p.volume_usd_24h ?? 0),
    risk: grade
      ? {
          grade,
          summary: Array.isArray(p.reasons) && p.reasons[0] && typeof p.reasons[0] === "object" && "text" in p.reasons[0]
            ? String((p.reasons[0] as { text: string }).text)
            : grade,
          reasons: (Array.isArray(p.reasons) ? p.reasons : []) as MemePairRow["risk"] extends infer R
            ? R extends { reasons: infer X }
              ? X
              : never
            : never,
        }
      : null,
    chart_url: dexScreenerPairUrl(p.pool_id),
    swap_urls:
      isMemeCanonical(p.pair_quality)
        ? memeSwapUrls(p.meme_address as string, stockHex, p.pool_id, p.launchpad)
        : null,
  };
}

function emptyAsOf() {
  return { block_number: 0, taken_at: new Date().toISOString(), lag_seconds: 0 };
}

function emptyIndexer() {
  return { head: emptyAsOf(), status: "paused" as const };
}

type BoardSql = {
  address: string;
  dex: string;
  meme_address: string | null;
  pool_id: string | null;
  graduated?: boolean | null;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  ticker: string;
  contract_hex: string;
  stock_bal_raw: string | null;
  volume_usd_24h: string | null;
  dex_usdg?: string | null;
};

function mapBoardRow(r: BoardSql): PairBoardRow {
  const vol = Number(r.volume_usd_24h ?? 0);
  const meme = r.meme_address as string;
  return {
    pool_address: r.address,
    pair_quality: "pair_canonical",
    dex: r.dex as PairBoardRow["dex"],
    launchpad: asLaunchpad(r.launchpad),
    stage: pairStage(r.pool_id, r.graduated),
    volume_usd_24h: vol,
    meme: { address: meme, symbol: r.symbol, name: r.name },
    stock: {
      ticker: r.ticker,
      contract: checksum(r.contract_hex),
      contract_hex: r.contract_hex,
    },
    stock_in_lp: amount(r.stock_bal_raw, 18, r.ticker),
    stock_dex_usdg: r.dex_usdg != null ? Number(r.dex_usdg) : null,
    chart_url: dexScreenerPairUrl(r.pool_id),
    swap_urls: memeSwapUrls(meme, r.contract_hex, r.pool_id, r.launchpad),
    token_path: `/t/${meme}`,
    stock_path: `/s/${r.ticker}`,
  };
}

function mapFakeHit(r: {
  address: string;
  symbol: string | null;
  ticker: string;
  contract_hex: string;
}): HomeFakeHit {
  return {
    meme: { address: r.address, symbol: r.symbol },
    official: {
      ticker: r.ticker,
      contract: checksum(r.contract_hex),
      contract_hex: r.contract_hex,
    },
    this_contract_hex: r.address,
    token_path: `/t/${r.address}`,
    stock_path: `/s/${r.ticker}`,
  };
}

function emptyRegistry() {
  return { asset_count: 0, synced_at: new Date().toISOString() };
}

async function loadIndexerMeta() {
  if (!databaseUrl()) return { indexer: emptyIndexer(), registry: emptyRegistry() };
  try {
    const status = await loadStatus();
    const lag = status.head.lag_seconds ?? 0;
    return {
      indexer: {
        head: {
          block_number: status.head.last_block,
          taken_at: status.head.last_ok_at,
          lag_seconds: lag,
        },
        status: (lag > 30 ? "behind" : "synced") as "behind" | "synced",
      },
      registry: status.registry,
    };
  } catch {
    return { indexer: emptyIndexer(), registry: emptyRegistry() };
  }
}

async function loadRegistryRows() {
  if (!databaseUrl()) return [];
  const { rows } = await db().query<{ ticker: string; contract_hex: string }>(
    `SELECT ticker, contract_hex FROM stock_tokens`,
  );
  return rows;
}

export async function loadStocks(): Promise<GetStocksResponse> {
  return memo("stocks", READ_TTL_MS, loadStocksUncached);
}

async function loadStocksUncached(): Promise<GetStocksResponse> {
  const empty: GetStocksResponse = {
    indexer: emptyIndexer(),
    registry: emptyRegistry(),
    sort: "meme_vol",
    order: "desc",
    filter: "all",
    hide_empty: false,
    stocks: [],
  };
  if (!databaseUrl()) return empty;
  try {
    const { rows } = await db().query<{
      ticker: string;
      name: string;
      asset_type: StockHeatmapRow["asset_type"];
      sectors: string[] | null;
      is_active: boolean;
      contract_hex: string;
      oracle_price_usd: string | null;
      dex_price_usd: string | null;
      premium_bps: number | null;
      float_locked_pct: string | null;
      float_locked_raw: string | null;
      total_supply_raw: string | null;
      meme_pair_count: number | null;
      meme_vol_24h_usd: string | null;
      spot_vol_24h_usd: string | null;
      block_number: string | null;
      taken_at: Date | null;
      prev_pct: string | null;
      new_pair_count_24h: string | null;
      lag_seconds: number | null;
      asset_count: string;
      registry_synced_at: Date | null;
    }>(`
      WITH latest AS (
        SELECT DISTINCT ON (ticker) *
        FROM stock_snapshots
        ORDER BY ticker, block_number DESC
      ),
      prev AS (
        SELECT DISTINCT ON (s.ticker) s.ticker, s.float_locked_pct
        FROM stock_snapshots s
        WHERE s.taken_at < now() - interval '24 hours'
        ORDER BY s.ticker, s.block_number DESC
      ),
      new_pairs AS (
        SELECT stock_ticker AS ticker, count(*)::int AS n
        FROM pools
        WHERE stock_ticker IS NOT NULL
          AND created_at > now() - interval '24 hours'
          AND pair_quality IN ('pair_canonical', 'canonical')
          AND meme_address IS NOT NULL
        GROUP BY stock_ticker
      ),
      head AS (
        SELECT last_block, last_ok_at, lag_seconds FROM indexer_state WHERE key = 'head'
      ),
      reg AS (
        SELECT count(*)::int AS asset_count, max(registry_synced_at) AS registry_synced_at
        FROM stock_tokens
      )
      SELECT
        st.ticker, st.name, st.asset_type, st.sectors, st.is_active, st.contract_hex,
        l.oracle_price_usd, l.dex_price_usd, l.premium_bps,
        l.float_locked_pct, l.float_locked_raw, l.total_supply_raw,
        l.meme_pair_count, l.meme_vol_24h_usd, l.spot_vol_24h_usd,
        l.block_number, l.taken_at,
        p.float_locked_pct AS prev_pct,
        coalesce(np.n, 0) AS new_pair_count_24h,
        h.lag_seconds, r.asset_count, r.registry_synced_at
      FROM stock_tokens st
      LEFT JOIN latest l ON l.ticker = st.ticker
      LEFT JOIN prev p ON p.ticker = st.ticker
      LEFT JOIN new_pairs np ON np.ticker = st.ticker
      LEFT JOIN head h ON true
      CROSS JOIN reg r
      WHERE st.is_active
      ORDER BY coalesce(l.meme_vol_24h_usd, 0) DESC, st.ticker
    `);

    if (!rows.length) {
      const meta = await loadIndexerMeta();
      return { ...empty, indexer: meta.indexer, registry: meta.registry };
    }

    const lag = rows[0].taken_at
      ? Math.max(0, Math.round((Date.now() - new Date(rows[0].taken_at).getTime()) / 1000))
      : (rows[0].lag_seconds ?? 0);
    const asOf = {
      block_number: Number(rows[0].block_number ?? 0),
      taken_at: (rows[0].taken_at ?? new Date()).toISOString(),
      lag_seconds: lag,
    };
    const stocks: StockHeatmapRow[] = rows.map((r) => {
      const locked = Number(r.float_locked_pct ?? 0);
      const prev = r.prev_pct != null ? Number(r.prev_pct) : null;
      const oracle = r.oracle_price_usd != null ? Number(r.oracle_price_usd) : null;
      const dex = r.dex_price_usd != null ? Number(r.dex_price_usd) : null;
      const memeVol = Number(r.meme_vol_24h_usd ?? 0);
      const spotVol = Number(r.spot_vol_24h_usd ?? 0);
      return {
        ticker: r.ticker,
        name: r.name,
        asset_type: r.asset_type,
        sectors: (r.sectors ?? []) as Sector[],
        is_active: r.is_active,
        contract: checksum(r.contract_hex),
        contract_hex: r.contract_hex,
        oracle_price_usd: oracle,
        dex_price_usd: dex,
        premium_bps: r.premium_bps,
        float_locked_pct: locked,
        float_locked_pct_change_24h: prev == null ? null : locked - prev,
        float_locked_raw: r.float_locked_raw ?? "0",
        total_supply_raw: r.total_supply_raw ?? "0",
        meme_pair_count: r.meme_pair_count ?? 0,
        new_pair_count_24h: Number(r.new_pair_count_24h ?? 0),
        meme_vol_24h_usd: memeVol,
        spot_vol_24h_usd: spotVol,
        meme_pressure: spotVol > 0 ? memeVol / spotVol : null,
        as_of: {
          block_number: Number(r.block_number ?? asOf.block_number),
          taken_at: (r.taken_at ?? new Date()).toISOString(),
          lag_seconds: lag,
        },
      };
    });

    const status = lag > 30 ? "behind" : "synced";
    return {
      indexer: { head: asOf, status },
      registry: {
        asset_count: Number(rows[0].asset_count),
        synced_at: (rows[0].registry_synced_at ?? new Date()).toISOString(),
      },
      sort: "meme_vol",
      order: "desc",
      filter: "all",
      hide_empty: false,
      stocks,
    };
  } catch (err) {
    console.error("loadStocks db failed", err);
    return empty;
  }
}

export async function loadStock(
  ticker: string,
  opts: { hide_dead?: boolean; holders?: boolean; page?: number; page_size?: number } = {},
): Promise<GetStockResponse | null> {
  if (opts.holders) return loadStockUncached(ticker, opts);
  const hideDead = opts.hide_dead !== false;
  const { page, pageSize } = clampPage(opts, STOCK_MEME_PAGE_SIZE);
  return memo(
    `stock:${ticker.toUpperCase()}:${hideDead}:${page}:${pageSize}`,
    READ_TTL_MS,
    () => loadStockUncached(ticker, opts),
  );
}

async function loadStockUncached(
  ticker: string,
  opts: { hide_dead?: boolean; holders?: boolean; page?: number; page_size?: number } = {},
): Promise<GetStockResponse | null> {
  if (!databaseUrl()) return null;
  const hideDead = opts.hide_dead !== false;
  const wantHolders = opts.holders === true;
  const { page, pageSize, offset } = clampPage(opts, STOCK_MEME_PAGE_SIZE);
  const list = await loadStocks();
  const row = list.stocks.find((s) => s.ticker === ticker.toUpperCase());
  if (!row) return null;
  const upper = ticker.toUpperCase();
  const memeWhere = `
    p.stock_ticker = $1
    AND p.meme_address IS NOT NULL
    AND p.pair_quality IN ('pair_canonical', 'canonical', 'pair_fake_underlying')
    AND ($2::boolean = false OR coalesce(s.volume_usd_24h, 0) <> 0)
  `;
  const snapJoin = `
    FROM pools p
    CROSS JOIN snap_head h
    LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
  `;
  const [countQ, memeQ, spotQ, holderRows] = await Promise.all([
    db().query<{ n: number }>(`
      WITH snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots)
      SELECT count(*)::int AS n
      ${snapJoin}
      WHERE ${memeWhere}
    `, [upper, hideDead]),
    db().query<PairSqlRow>(`
      WITH snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots)
      SELECT p.address, p.dex, p.meme_address, p.pair_quality, p.created_at,
             p.token0, p.token1, p.pool_id, p.graduated, p.tick_spacing,
             t.symbol, t.name, t.created_at AS token_created, t.launchpad,
             s.stock_bal_raw, s.volume_usd_24h, s.reserve_usd,
             r.grade, r.reasons
      ${snapJoin}
      LEFT JOIN tokens t ON t.address = p.meme_address
      LEFT JOIN token_risk r ON r.address = p.meme_address
      WHERE ${memeWhere}
      ORDER BY
        CASE WHEN p.pair_quality IN ('pair_canonical', 'canonical') THEN 0 ELSE 1 END,
        coalesce(s.volume_usd_24h, 0) DESC,
        coalesce(s.stock_bal_raw, 0) DESC
      LIMIT $3 OFFSET $4
    `, [upper, hideDead, pageSize, offset]),
    db().query<PairSqlRow>(`
      WITH snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots)
      SELECT p.address, p.dex, p.meme_address, p.pair_quality, p.created_at,
             p.token0, p.token1, p.pool_id,
             t.symbol, t.name, t.created_at AS token_created, t.launchpad,
             s.stock_bal_raw, s.volume_usd_24h, s.reserve_usd,
             r.grade, r.reasons
      ${snapJoin}
      LEFT JOIN tokens t ON t.address = p.meme_address
      LEFT JOIN token_risk r ON r.address = p.meme_address
      WHERE p.stock_ticker = $1 AND p.meme_address IS NULL
      ORDER BY coalesce(s.volume_usd_24h, 0) DESC
    `, [upper]),
    wantHolders
      ? fetchTokenHolders({ token: row.contract_hex, symbol: row.ticker, decimals: 18 })
      : Promise.resolve(null),
  ]);

  const heroLocked = amount(row.float_locked_raw, 18, row.ticker);
  const supply = amount(row.total_supply_raw, 18, row.ticker);
  const liveLp = await hydrateZeroV4StockLp(
    memeQ.rows.map((p) => ({
      pool_id: p.pool_id,
      token0: p.token0,
      token1: p.token1,
      tick_spacing: p.tick_spacing,
      launchpad: p.launchpad,
      stock_bal_raw: p.stock_bal_raw,
      stock_hex: row.contract_hex,
    })),
  );
  for (const p of memeQ.rows) {
    const id = p.pool_id?.toLowerCase();
    if (id && liveLp.has(id)) p.stock_bal_raw = liveLp.get(id)!;
  }
  const memePairs = memeQ.rows
    .filter((p) => p.meme_address)
    .map((p) => mapMemePair(p, row.ticker, row.contract_hex, supply));
  const holders = holderRows
    ? withPctOfSupply(holderRows, Number(supply.amount) || 0)
    : null;

  return {
    indexer: list.indexer,
    stock: {
      ticker: row.ticker,
      name: row.name,
      asset_type: row.asset_type,
      sectors: row.sectors,
      is_active: row.is_active,
      contract: row.contract,
      contract_hex: row.contract_hex,
      decimals: 18,
      explorer_url: explorerAddress(row.contract_hex),
    },
    hero: {
      float_locked_pct: row.float_locked_pct,
      locked_in_meme_lps: heroLocked,
      onchain_supply: supply,
      oracle_price_usd: row.oracle_price_usd,
      dex_price_usd: row.dex_price_usd,
      premium_bps: row.premium_bps,
      meme_pressure: row.meme_pressure,
      meme_pair_count: row.meme_pair_count,
      meme_vol_24h_usd: row.meme_vol_24h_usd,
      spot_vol_24h_usd: row.spot_vol_24h_usd,
    },
    as_of: row.as_of,
    meme_pairs: memePairs,
    meme_pairs_total: countQ.rows[0]?.n ?? 0,
    page,
    page_size: pageSize,
    spot_pools: spotQ.rows
      .filter((p) => {
        if (p.meme_address) return false;
        if (isSpotStockPair(p.pair_quality)) return true;
        const a = [p.token0, p.token1].map((x) => (x ?? "").toLowerCase());
        return a.includes(USDG) || a.includes(WETH) || a.includes(ZERO) || a.includes(CBBTC);
      })
      .map((p) => {
        const t0 = (p.token0 ?? "").toLowerCase();
        const t1 = (p.token1 ?? "").toLowerCase();
        const quote: "USDG" | "WETH" | "CBBTC" =
          t0 === USDG || t1 === USDG ? "USDG" : t0 === CBBTC || t1 === CBBTC ? "CBBTC" : "WETH";
        const bal = amount(p.stock_bal_raw, 18, row.ticker);
        const oracle = row.oracle_price_usd;
        const reserve =
          p.reserve_usd != null
            ? Number(p.reserve_usd)
            : oracle
              ? Number(bal.amount) * oracle
              : null;
        return {
          pool_address: p.address,
          dex: (p.dex as GetStockResponse["spot_pools"][0]["dex"]) ?? "uniswap_v4",
          pair_quality: "pair_spot_stock" as const,
          pool_kind: "spot" as const,
          quote,
          stock_in_lp: bal,
          reserve_usd: reserve,
          volume_usd_24h: Number(p.volume_usd_24h ?? 0),
        };
      }),
    holders,
    og: {
      title: `${row.ticker} is ${Math.round(row.float_locked_pct * 100)}% locked`,
      url: `${SITE_ORIGIN}/s/${row.ticker}`,
    },
  };
}

export async function loadToken(
  address: string,
  opts: { holders?: boolean } = {},
): Promise<GetTokenResponse | null> {
  if (opts.holders) return loadTokenUncached(address, opts);
  return memo(`token:${address.toLowerCase()}`, READ_TTL_MS, () => loadTokenUncached(address, opts));
}

async function loadTokenUncached(
  address: string,
  opts: { holders?: boolean } = {},
): Promise<GetTokenResponse | null> {
  if (!databaseUrl()) return null;
  const hex = address.toLowerCase();
  const { rows } = await db().query<{
    address: string;
    symbol: string | null;
    name: string | null;
    decimals: number | null;
    created_at: Date | null;
    creator: string | null;
    launchpad: string | null;
    is_stock_token: boolean;
    total_supply_raw: string | null;
    stock_ticker: string | null;
  }>(`SELECT * FROM tokens WHERE address = $1`, [hex]);
  const stockHit = await db().query(`SELECT ticker FROM stock_tokens WHERE contract_hex = $1`, [hex]);
  if (stockHit.rows[0]) {
    return {
      indexer: (await loadStocks()).indexer,
      token: {
        address: hex,
        symbol: stockHit.rows[0].ticker,
        name: null,
        decimals: 18,
        created_at: null,
        creator: null,
        launchpad: null,
        is_stock_token: true,
        redirect_to_stock: stockHit.rows[0].ticker,
      },
      as_of: (await loadStocks()).indexer.head,
      stage: null,
      underlying: null,
      fake_underlying: null,
      risk: null,
      market: {
        chart_url: null,
        price_usdg: null,
        marketcap_usdg: null,
        quote: null,
        volume_usd_1h: null,
        volume_usd_6h: null,
        volume_usd_24h: null,
        buys_24h: null,
        sells_24h: null,
        traders_24h: null,
      },
      pools: [],
      people: { creator: null, holders: null },
      swap_urls: null,
    };
  }
  if (!rows[0]) return null;
  const t = rows[0];
  const poolQ = await db().query<{
    address: string;
    dex: string;
    pair_quality: string;
    stock_ticker: string | null;
    token0: string;
    token1: string;
    pool_id: string | null;
    graduated?: boolean | null;
    tick_spacing: number | null;
    created_at: Date | null;
    launchpad: string | null;
    stock_bal_raw: string | null;
    volume_usd_24h: string | null;
    price_meme_usdg: string | null;
    contract_hex: string | null;
    stock_dex_usdg: string | null;
  }>(`
    WITH snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots),
    stock_px AS (
      SELECT DISTINCT ON (ticker) ticker, dex_price_usd
      FROM stock_snapshots
      ORDER BY ticker, block_number DESC
    )
    SELECT p.address, p.dex, p.pair_quality, p.stock_ticker, p.token0, p.token1, p.pool_id, p.graduated,
           p.tick_spacing, p.created_at, t.launchpad, s.stock_bal_raw, s.volume_usd_24h, s.price_meme_usdg,
           st.contract_hex, sp.dex_price_usd AS stock_dex_usdg
    FROM pools p
    CROSS JOIN snap_head h
    LEFT JOIN tokens t ON t.address = $1
    LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
    LEFT JOIN stock_tokens st ON st.ticker = p.stock_ticker
    LEFT JOIN stock_px sp ON sp.ticker = p.stock_ticker
    WHERE p.meme_address = $1 OR p.token0 = $1 OR p.token1 = $1
    ORDER BY coalesce(s.volume_usd_24h, 0) DESC, p.address
  `, [hex]);
  const poolsRaw = poolQ.rows;
  const liveLp = await hydrateZeroV4StockLp(
    poolsRaw
      .filter((p) => p.contract_hex)
      .map((p) => ({
        pool_id: p.pool_id,
        token0: p.token0,
        token1: p.token1,
        tick_spacing: p.tick_spacing,
        launchpad: p.launchpad,
        stock_bal_raw: p.stock_bal_raw,
        stock_hex: p.contract_hex as string,
      })),
  );
  for (const p of poolsRaw) {
    const id = p.pool_id?.toLowerCase();
    if (id && liveLp.has(id)) p.stock_bal_raw = liveLp.get(id)!;
  }
  const best = poolsRaw[0];
  const list = await loadStocks();
  const riskQ = await db().query(`SELECT * FROM token_risk WHERE address = $1`, [hex]);
  const risk = riskQ.rows[0];
  const stockPair = poolsRaw.find((p) => isMemeCanonical(p.pair_quality) && p.stock_ticker && p.contract_hex) ?? best;
  const quality = stockPair?.pair_quality ?? "unknown";
  const official = isMemeCanonical(quality) && stockPair?.stock_ticker && stockPair.contract_hex;
  const fakeRow = poolsRaw.find((p) => isFakeUnderlying(p.pair_quality));
  const fake = Boolean(fakeRow);
  const quoteTicker = stockPair?.stock_ticker ?? fakeRow?.stock_ticker ?? "???";
  const quoteSide = stockPair
    ? stockPair.token0 === hex
      ? stockPair.token1
      : stockPair.token1 === hex
        ? stockPair.token0
        : stockPair.token1
    : hex;
  const quoteHex = official ? (stockPair?.contract_hex ?? quoteSide) : quoteSide;
  const stockRow = list.stocks.find((s) => s.ticker === stockPair?.stock_ticker);
  const supply = stockRow ? Number(formatUnits(BigInt(stockRow.total_supply_raw || "0"), 18)) : 0;
  const lockedAmt = amount(stockPair?.stock_bal_raw ?? "0", 18, quoteTicker);
  const lockedNum = Number(lockedAmt.amount);
  const peopleHolders = opts.holders
    ? await fetchTokenHolders({
        token: hex,
        symbol: t.symbol ?? "???",
        decimals: t.decimals ?? 18,
        poolAddresses: poolsRaw.map((p) => p.address),
      })
    : null;

  const prices = await fillMemePrices(
    poolsRaw.map((p) => ({
      pool_id: p.pool_id,
      token0: p.token0,
      token1: p.token1,
      meme: hex,
      stock_dex_usdg: p.stock_dex_usdg != null ? Number(p.stock_dex_usdg) : null,
      price_usdg: p.price_meme_usdg != null ? Number(p.price_meme_usdg) : null,
    })),
  );

  let supplyRaw = t.total_supply_raw as string | null | undefined;
  if (!supplyRaw) {
    const client = rpcClient();
    if (client) {
      try {
        const map = await readTotalSupplies(client, [hex]);
        const raw = map.get(hex);
        if (raw != null) {
          supplyRaw = raw.toString();
          await db().query(`UPDATE tokens SET total_supply_raw = $2 WHERE address = $1`, [hex, supplyRaw]);
        }
      } catch {
        /* keep null */
      }
    }
  }

  const tradePools: MemeTradePool[] = poolsRaw.map((p) => {
    const q = quoteLabel(p.token0, p.token1, hex, p.stock_ticker);
    const px = (p.pool_id ? prices.get(p.pool_id.toLowerCase()) : null) ??
      (p.price_meme_usdg != null ? Number(p.price_meme_usdg) : null);
    const quoteAddr = otherToken(p.token0, p.token1, hex);
    return {
      pool_address: p.address,
      dex: (p.dex as MemeTradePool["dex"]) ?? "uniswap_v4",
      stage: pairStage(p.pool_id, p.graduated),
      quote: q,
      volume_usd_24h: Number(p.volume_usd_24h ?? 0),
      price_usdg: px,
      chart_url: dexScreenerPairUrl(p.pool_id),
      swap_urls: memeSwapUrls(hex, quoteAddr, p.pool_id, t.launchpad),
    };
  });
  const top = tradePools[0] ?? null;
  const volSum = tradePools.reduce((n, p) => n + p.volume_usd_24h, 0);
  const price = top?.price_usdg ?? null;
  const dec = tokenDecimals(hex, t.decimals);
  let marketcap: number | null = null;
  if (price != null && supplyRaw) {
    try {
      marketcap = Number(formatUnits(BigInt(String(supplyRaw).split(".")[0] || "0"), dec)) * price;
      if (!Number.isFinite(marketcap)) marketcap = null;
    } catch {
      marketcap = null;
    }
  }

  return {
    indexer: list.indexer,
    token: {
      address: hex,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      created_at: t.created_at?.toISOString() ?? null,
      creator: t.creator,
      launchpad: asLaunchpad(t.launchpad),
      is_stock_token: t.is_stock_token,
      redirect_to_stock: null,
    },
    as_of: list.indexer.head,
    stage: best ? pairStage(best.pool_id) : null,
    underlying: official && stockPair
      ? {
          pair_quality: "pair_canonical" as const,
          pool_address: stockPair.address,
          dex: stockPair.dex as NonNullable<GetTokenResponse["underlying"]>["dex"],
          launchpad: asLaunchpad(stockPair.launchpad),
          quote: {
            ticker: quoteTicker,
            contract: checksum(quoteHex),
            contract_hex: quoteHex.toLowerCase(),
            is_official: true,
          },
          stock_in_lp: lockedAmt,
          stock_in_lp_pct_of_supply: supply > 0 ? lockedNum / supply : null,
        }
      : null,
    fake_underlying: fake && fakeRow
      ? {
          claimed_ticker: fakeRow.stock_ticker ?? quoteTicker,
          official: stockRow
            ? {
                ticker: stockRow.ticker,
                contract: stockRow.contract,
                contract_hex: stockRow.contract_hex,
              }
            : {
                ticker: quoteTicker,
                contract: checksum(quoteHex),
                contract_hex: quoteHex.toLowerCase(),
              },
          this_contract: checksum(otherToken(fakeRow.token0, fakeRow.token1, hex)),
          this_contract_hex: otherToken(fakeRow.token0, fakeRow.token1, hex),
        }
      : null,
    risk: risk
      ? {
          grade: risk.grade,
          checked_at: risk.checked_at.toISOString(),
          owner: risk.owner,
          owner_renounced: risk.owner_renounced,
          can_mint: risk.can_mint,
          can_pause: risk.can_pause,
          can_blacklist: risk.can_blacklist,
          buy_tax_bps: risk.buy_tax_bps,
          sell_tax_bps: risk.sell_tax_bps,
          lp_locked: risk.lp_locked,
          honeypot_signal: risk.honeypot_signal,
          top10_pct: risk.top10_pct != null ? Number(risk.top10_pct) : null,
          creator_launch_count: risk.creator_launch_count,
          reasons: risk.reasons ?? [],
        }
      : null,
    market: {
      chart_url: top?.chart_url ?? null,
      price_usdg: price,
      marketcap_usdg: marketcap,
      quote: top?.quote ?? null,
      volume_usd_1h: null,
      volume_usd_6h: null,
      volume_usd_24h: volSum,
      buys_24h: null,
      sells_24h: null,
      traders_24h: null,
    },
    pools: tradePools,
    people: {
      creator: t.creator
        ? {
            address: t.creator,
            launch_count: risk?.creator_launch_count ?? null,
            explorer_url: explorerAddress(t.creator),
          }
        : null,
      holders: peopleHolders,
    },
    swap_urls: top?.swap_urls ?? (official && stockPair
      ? memeSwapUrls(hex, stockPair.contract_hex ?? stockPair.token1, stockPair.pool_id, t.launchpad)
      : null),
  };
}

export async function loadLive(query: GetLivePairsQuery = {}): Promise<GetLivePairsResponse> {
  const canonicalOnly = query.canonical_only !== false;
  const ticker = query.ticker?.toUpperCase() ?? "";
  const stage = parseMarketStage(query.stage);
  const { page, pageSize } = clampPage(query, BOARD_PAGE_SIZE);
  return memo(
    `live:${canonicalOnly}:${ticker}:${stage}:${page}:${pageSize}`,
    READ_TTL_MS,
    () => loadLiveUncached(query),
  );
}

async function loadLiveUncached(query: GetLivePairsQuery = {}): Promise<GetLivePairsResponse> {
  const canonicalOnly = query.canonical_only !== false;
  const ticker = query.ticker?.toUpperCase() ?? null;
  const stage: MarketStage = parseMarketStage(query.stage);
  const { page, pageSize, offset } = clampPage(query, BOARD_PAGE_SIZE);
  const empty: GetLivePairsResponse = {
    indexer: emptyIndexer(),
    canonical_only: canonicalOnly,
    stage,
    ticker,
    last_pair_at: null,
    pairs: [],
    pairs_total: 0,
    has_more: false,
    page,
    page_size: pageSize,
  };
  if (!databaseUrl()) return empty;

  const where = `
    p.meme_address IS NOT NULL
    AND p.created_at IS NOT NULL
    AND p.pair_quality IN ('pair_canonical', 'pair_fake_underlying', 'canonical', 'fake_underlying')
    AND ($1::text IS NULL OR p.stock_ticker = $1)
    AND ($2::boolean = false OR p.pair_quality IN ('pair_canonical', 'canonical'))
    ${poolStageSql("p", "$3")}
  `;
  const { rows } = await db().query<{
    created_at: Date;
    address: string;
    dex: string;
    pair_quality: string;
    meme_address: string | null;
    pool_id: string | null;
    graduated?: boolean | null;
    stock_ticker: string | null;
    symbol: string | null;
    launchpad: string | null;
    contract_hex: string | null;
  }>(`
    SELECT p.created_at, p.address, p.dex, p.pair_quality, p.meme_address, p.pool_id, p.graduated, p.stock_ticker,
           t.symbol, t.launchpad, st.contract_hex
    FROM pools p
    LEFT JOIN tokens t ON t.address = p.meme_address
    LEFT JOIN stock_tokens st ON st.ticker = p.stock_ticker
    WHERE ${where}
    ORDER BY p.created_at DESC
    LIMIT $4 OFFSET $5
  `, [ticker, canonicalOnly, stage, pageSize + 1, offset]);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    indexer: emptyIndexer(),
    canonical_only: canonicalOnly,
    stage,
    ticker,
    last_pair_at: page === 1 && pageRows[0] ? pageRows[0].created_at.toISOString() : null,
    pairs_total: 0,
    has_more: hasMore,
    page,
    page_size: pageSize,
    pairs: pageRows.map((r) => ({
      created_at: r.created_at.toISOString(),
      age_seconds: Math.round((Date.now() - r.created_at.getTime()) / 1000),
      pool_address: r.address,
      dex: r.dex as GetLivePairsResponse["pairs"][0]["dex"],
      launchpad: asLaunchpad(r.launchpad),
      stage: pairStage(r.pool_id, r.graduated),
      pair_quality: isFakeUnderlying(r.pair_quality) ? "pair_fake_underlying" : "pair_canonical",
      meme: { address: r.meme_address as string, symbol: r.symbol },
      quote: {
        ticker: r.stock_ticker ?? "???",
        contract: checksum(r.contract_hex ?? r.address),
        contract_hex: (r.contract_hex ?? "").toLowerCase(),
        is_official: isMemeCanonical(r.pair_quality),
      },
      stock_in_lp: null,
      creator_launches_today: null,
      token_path: `/t/${r.meme_address}`,
    })),
  };
}

export async function loadSearch(q: string): Promise<GetSearchResponse> {
  if (!databaseUrl()) return { query: q.trim(), stocks: [], tokens: [] };
  const query = q.trim();
  if (!query) return { query, stocks: [], tokens: [] };
  const stocks = await loadStocks();
  const upper = query.toUpperCase();
  const lower = query.toLowerCase();
  const stockHits = stocks.stocks
    .filter(
      (s) =>
        s.ticker.includes(upper) ||
        s.name.toLowerCase().includes(lower) ||
        s.contract_hex === lower,
    )
    .slice(0, 8)
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      contract_hex: s.contract_hex,
      float_locked_pct: s.float_locked_pct,
      path: `/s/${s.ticker}`,
    }));
  const { rows } = await db().query<{
    address: string;
    symbol: string | null;
    pair_quality: string | null;
    stock_ticker: string | null;
  }>(`
    SELECT t.address, t.symbol, p.pair_quality, p.stock_ticker
    FROM tokens t
    LEFT JOIN pools p ON p.meme_address = t.address
    WHERE t.is_stock_token = false
      AND (t.address = $1 OR t.symbol ILIKE $2)
    LIMIT 8
  `, [lower, `%${query}%`]);
  return {
    query,
    stocks: stockHits,
    tokens: rows.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      pair_quality: (isFakeUnderlying(t.pair_quality)
        ? "pair_fake_underlying"
        : isMemeCanonical(t.pair_quality)
          ? "pair_canonical"
          : isSpotStockPair(t.pair_quality)
            ? "pair_spot_stock"
            : "unknown") as PairQuality,
      stock_ticker: t.stock_ticker,
      stock_contract_hex:
        stocks.stocks.find((s) => s.ticker === t.stock_ticker)?.contract_hex ?? null,
      path: `/t/${t.address}`,
    })),
  };
}

export async function loadStatus(): Promise<GetStatusResponse> {
  return memo("status", 10_000, loadStatusUncached);
}

async function loadStatusUncached(): Promise<GetStatusResponse> {
  const emptyKey = {
    last_block: 0,
    last_ok_at: new Date().toISOString(),
    lag_seconds: null as number | null,
  };
  const empty: GetStatusResponse = {
    head: emptyKey,
    pons: emptyKey,
    long: emptyKey,
    uniswap_v4: emptyKey,
    registry: emptyRegistry(),
  };
  if (!databaseUrl()) return empty;
  try {
    const { rows } = await db().query<{
      key: string;
      last_block: string;
      last_ok_at: Date;
      lag_seconds: number | null;
    }>(`SELECT key, last_block, last_ok_at, lag_seconds FROM indexer_state`);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    const { rows: reg } = await db().query(
      `SELECT count(*)::int AS n, max(registry_synced_at) AS synced FROM stock_tokens`,
    );
    const empty = {
      last_block: 0,
      last_ok_at: new Date().toISOString(),
      lag_seconds: null as number | null,
    };
    const map = (k: string) => {
      if (!by[k]) return empty;
      const lastOk = by[k].last_ok_at;
      return {
        last_block: Number(by[k].last_block),
        last_ok_at: lastOk.toISOString(),
        lag_seconds: Math.max(0, Math.round((Date.now() - lastOk.getTime()) / 1000)),
      };
    };
    return {
      head: map("head"),
      pons: map("pons"),
      long: map("long"),
      uniswap_v4: map("uniswap_v4"),
      registry: {
        asset_count: Number(reg[0]?.n ?? 0),
        synced_at: (reg[0]?.synced ?? new Date()).toISOString(),
      },
    };
  } catch {
    return empty;
  }
}

export async function loadLaunchPrefill(ticker: string): Promise<GetLaunchPrefillResponse | null> {
  const stocks = await loadStocks();
  const row = stocks.stocks.find((s) => s.ticker === ticker.toUpperCase());
  if (!row) return null;
  return {
    ticker: row.ticker,
    name: row.name,
    contract: row.contract,
    contract_hex: row.contract_hex,
    pons_url: PONS_LAUNCH_URL,
  };
}

export async function loadOgHome(): Promise<GetOgResponse> {
  const pairs = await loadPairs({ quality: "canonical", sort: "vol24h", hide_dead: true });
  return {
    type: "home",
    title: "cinch · Robinhood Chain",
    lines: pairs.pairs.slice(0, 4).map((p) => ({
      ticker: p.stock.ticker,
      float_locked_pct: 0,
      meme_vol_24h_usd: p.volume_usd_24h,
    })),
    url: SITE_ORIGIN,
  };
}

export async function loadOgStock(ticker: string): Promise<GetOgResponse | null> {
  const stock = await loadStock(ticker);
  if (!stock) return null;
  const top = stock.meme_pairs[0];
  return {
    type: "stock",
    ticker: stock.stock.ticker,
    name: stock.stock.name,
    float_locked_pct: stock.hero.float_locked_pct,
    top_meme_symbol: top?.token.symbol ?? null,
    top_meme_stock_in_lp: top?.stock_in_lp ?? null,
    onchain_supply: stock.hero.onchain_supply,
    premium_bps: stock.hero.premium_bps,
    meme_vol_24h_usd: stock.hero.meme_vol_24h_usd,
    meme_pair_count: stock.hero.meme_pair_count,
    url: `${SITE_ORIGIN}/s/${stock.stock.ticker}`,
  };
}

export async function loadPairs(query: GetPairsQuery = {}): Promise<GetPairsResponse> {
  const hideDead = query.hide_dead !== false;
  const stage = parseMarketStage(query.stage);
  const quality = query.quality ?? "canonical";
  const sort = query.sort ?? "vol24h";
  const { page, pageSize } = clampPage(query, BOARD_PAGE_SIZE);
  return memo(
    `pairs:${hideDead}:${stage}:${quality}:${sort}:${page}:${pageSize}`,
    READ_TTL_MS,
    () => loadPairsUncached(query),
  );
}

async function loadPairsUncached(query: GetPairsQuery = {}): Promise<GetPairsResponse> {
  const hideDead = query.hide_dead !== false;
  const stage: MarketStage = parseMarketStage(query.stage);
  const quality = query.quality ?? "canonical";
  const sort = query.sort ?? "vol24h";
  const { page, pageSize, offset } = clampPage(query, BOARD_PAGE_SIZE);
  const meta = await loadIndexerMeta();
  const empty: GetPairsResponse = {
    indexer: meta.indexer,
    quality,
    sort,
    hide_dead: hideDead,
    stage,
    pairs: [],
    pairs_total: 0,
    page,
    page_size: pageSize,
  };
  if (!databaseUrl()) return empty;

  const where = `
    p.meme_address IS NOT NULL
    AND p.pair_quality IN ('pair_canonical', 'canonical')
    AND (
      $1::boolean = false
      OR $2::text = 'graduated'
      OR coalesce(v.volume_usd_24h, 0) <> 0
    )
    ${poolStageSql("p")}
  `;
  const [countQ, listQ] = await Promise.all([
    db().query<{ n: number }>(`
      WITH ${VOL24_CTE}
      SELECT count(*)::int AS n
      FROM pools p
      LEFT JOIN vol24 v ON v.pool_id = p.id
      WHERE ${where}
    `, [hideDead, stage]),
    db().query<{
      address: string;
      dex: string;
      pair_quality: string;
      meme_address: string | null;
      pool_id: string | null;
      token0: string;
      token1: string;
      symbol: string | null;
      name: string | null;
      launchpad: string | null;
      ticker: string;
      contract_hex: string;
      tick_spacing: number | null;
      graduated: boolean;
      stock_bal_raw: string | null;
      volume_usd_24h: string | null;
      dex_usdg: string | null;
    }>(`
      WITH ${VOL24_CTE},
      snap_head AS (
        SELECT max(block_number) AS block_number FROM pool_snapshots
      ),
      stock_px AS (
        SELECT DISTINCT ON (ticker) ticker, dex_price_usd
        FROM stock_snapshots
        ORDER BY ticker, block_number DESC
      )
      SELECT p.address, p.dex, p.pair_quality, p.meme_address, p.pool_id, p.graduated, p.tick_spacing,
             p.token0, p.token1,
             t.symbol, t.name, t.launchpad,
             st.ticker, st.contract_hex,
             s.stock_bal_raw, coalesce(v.volume_usd_24h, 0) AS volume_usd_24h,
             px.dex_price_usd AS dex_usdg
      FROM pools p
      LEFT JOIN vol24 v ON v.pool_id = p.id
      LEFT JOIN snap_head h ON true
      LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
      INNER JOIN stock_tokens st ON st.ticker = p.stock_ticker
      LEFT JOIN tokens t ON t.address = p.meme_address
      LEFT JOIN stock_px px ON px.ticker = st.ticker
      WHERE ${where}
      ORDER BY
        CASE WHEN p.pair_quality IN ('pair_canonical', 'canonical') THEN 0 ELSE 1 END,
        coalesce(v.volume_usd_24h, 0) DESC, p.address
      LIMIT $3 OFFSET $4
    `, [hideDead, stage, pageSize, offset]),
  ]);

  const liveLp = await hydrateZeroV4StockLp(
    listQ.rows.map((r) => ({
      pool_id: r.pool_id,
      token0: r.token0,
      token1: r.token1,
      tick_spacing: r.tick_spacing,
      launchpad: r.launchpad,
      stock_bal_raw: r.stock_bal_raw,
      stock_hex: r.contract_hex,
    })),
  );
  for (const r of listQ.rows) {
    const id = r.pool_id?.toLowerCase();
    if (id && liveLp.has(id)) r.stock_bal_raw = liveLp.get(id)!;
  }

  const mapped: PairBoardRow[] = listQ.rows.map((r) => {
    const vol = Number(r.volume_usd_24h ?? 0);
    const meme = r.meme_address as string;
    return {
      pool_address: r.address,
      pair_quality: "pair_canonical",
      dex: r.dex as PairBoardRow["dex"],
      launchpad: asLaunchpad(r.launchpad),
      stage: pairStage(r.pool_id, r.graduated),
      volume_usd_24h: vol,
      meme: { address: meme, symbol: r.symbol, name: r.name },
      stock: {
        ticker: r.ticker,
        contract: checksum(r.contract_hex),
        contract_hex: r.contract_hex,
      },
      stock_in_lp: amount(r.stock_bal_raw, 18, r.ticker),
      stock_dex_usdg: r.dex_usdg != null ? Number(r.dex_usdg) : null,
      chart_url: dexScreenerPairUrl(r.pool_id),
      swap_urls: memeSwapUrls(meme, r.contract_hex, r.pool_id, r.launchpad),
      token_path: `/t/${meme}`,
      stock_path: `/s/${r.ticker}`,
    };
  });

  return {
    indexer: meta.indexer,
    quality,
    sort,
    hide_dead: hideDead,
    stage,
    pairs: mapped,
    pairs_total: countQ.rows[0]?.n ?? 0,
    page,
    page_size: pageSize,
  };
}

export async function loadMarketStocks(
  query: GetMarketStocksQuery = {},
): Promise<GetMarketStocksResponse> {
  const hideDead = query.hide_dead !== false;
  const { page, pageSize } = clampPage(query, BOARD_PAGE_SIZE);
  return memo(`mstocks:${hideDead}:${page}:${pageSize}`, READ_TTL_MS, () =>
    loadMarketStocksUncached(query),
  );
}

async function loadMarketStocksUncached(
  query: GetMarketStocksQuery = {},
): Promise<GetMarketStocksResponse> {
  const hideDead = query.hide_dead !== false;
  const { page, pageSize, offset } = clampPage(query, BOARD_PAGE_SIZE);
  const meta = await loadIndexerMeta();
  const empty: GetMarketStocksResponse = {
    indexer: meta.indexer,
    hide_dead: hideDead,
    stocks: [],
    stocks_total: 0,
    page,
    page_size: pageSize,
  };
  if (!databaseUrl()) return empty;

  const volExpr = `coalesce(l.spot_vol_24h_usd, 0) + coalesce(l.meme_vol_24h_usd, 0)`;
  const where = `
    st.is_active
    AND ($1::boolean = false OR ${volExpr} <> 0)
  `;
  const [countQ, listQ] = await Promise.all([
    db().query<{ n: number }>(`
      WITH latest AS (
        SELECT DISTINCT ON (ticker) *
        FROM stock_snapshots
        ORDER BY ticker, block_number DESC
      )
      SELECT count(*)::int AS n
      FROM stock_tokens st
      LEFT JOIN latest l ON l.ticker = st.ticker
      WHERE ${where}
    `, [hideDead]),
    db().query<{
      ticker: string;
      name: string;
      contract_hex: string;
      volume_usd_24h: string;
      dex_usdg: string | null;
    }>(`
      WITH latest AS (
        SELECT DISTINCT ON (ticker) *
        FROM stock_snapshots
        ORDER BY ticker, block_number DESC
      )
      SELECT st.ticker, st.name, st.contract_hex,
             ${volExpr} AS volume_usd_24h,
             l.dex_price_usd AS dex_usdg
      FROM stock_tokens st
      LEFT JOIN latest l ON l.ticker = st.ticker
      WHERE ${where}
      ORDER BY ${volExpr} DESC, st.ticker
      LIMIT $2 OFFSET $3
    `, [hideDead, pageSize, offset]),
  ]);

  const stocks: MarketStockRow[] = listQ.rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    contract_hex: r.contract_hex,
    volume_usd_24h: Number(r.volume_usd_24h ?? 0),
    dex_usdg: r.dex_usdg != null ? Number(r.dex_usdg) : null,
    stock_path: `/s/${r.ticker}`,
  }));

  return {
    indexer: meta.indexer,
    hide_dead: hideDead,
    stocks,
    stocks_total: countQ.rows[0]?.n ?? 0,
    page,
    page_size: pageSize,
  };
}

function quoteLabel(token0: string, token1: string, meme: string, stockTicker: string | null): string {
  const q = otherToken(token0, token1, meme);
  if (q === USDG) return "USDG";
  if (q === WETH || q === ZERO) return "WETH";
  if (q === CBBTC) return "cbBTC";
  if (stockTicker) return stockTicker;
  return q.slice(0, 6);
}

async function ethUsdFromSpot(): Promise<number | null> {
  const client = rpcClient();
  if (!client) return null;
  const { rows } = await db().query<{ pool_id: string }>(
    `SELECT pool_id FROM pools
     WHERE pool_id IS NOT NULL
       AND (
         (lower(token0) = $1 AND lower(token1) = $2)
         OR (lower(token0) = $2 AND lower(token1) = $1)
       )
     LIMIT 1`,
    [USDG, WETH],
  );
  const id = rows[0]?.pool_id;
  if (!id) return null;
  const v4 = await readV4States(client, [id]);
  const st = v4.get(id.toLowerCase());
  if (!st) return null;
  const [c0, c1] = sortedPair(USDG, WETH);
  const t1PerT0 = priceToken1PerToken0(st.sqrt, tokenDecimals(c0), tokenDecimals(c1));
  if (!Number.isFinite(t1PerT0) || t1PerT0 <= 0) return null;
  return c0 === USDG ? 1 / t1PerT0 : t1PerT0;
}

async function fillMemePrices(
  seeds: {
    pool_id: string | null;
    token0: string;
    token1: string;
    meme: string;
    stock_dex_usdg: number | null;
    price_usdg: number | null;
  }[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const s of seeds) {
    if (s.price_usdg != null && s.pool_id) out.set(s.pool_id.toLowerCase(), s.price_usdg);
  }
  const missing = seeds.filter((s) => s.price_usdg == null && s.pool_id);
  const client = rpcClient();
  if (!missing.length || !client) return out;
  try {
  let ethUsd: number | null = null;
  if (
    missing.some((s) => {
      const q = otherToken(s.token0, s.token1, s.meme);
      return q === WETH || q === ZERO;
    })
  ) {
    ethUsd = await ethUsdFromSpot();
  }
  const v4 = await readV4States(
    client,
    missing.map((s) => s.pool_id as string),
  );
  for (const s of missing) {
    const id = (s.pool_id as string).toLowerCase();
    const st = v4.get(id);
    if (!st) continue;
    const quote = otherToken(s.token0, s.token1, s.meme);
    const px = memePriceUsdg({
      token0: s.token0,
      token1: s.token1,
      meme: s.meme,
      sqrt: st.sqrt,
      dec0: tokenDecimals(s.token0),
      dec1: tokenDecimals(s.token1),
      quoteUsd: quoteUsdRate({
        quote,
        ethUsd,
        stockDexUsdg: s.stock_dex_usdg,
      }),
    });
    if (px != null) out.set(id, px);
  }
  } catch {
    // RPC/multicall miss: keep DB prices if any.
  }
  return out;
}

export async function loadMemes(query: GetMemesQuery = {}): Promise<GetMemesResponse> {
  const hideDead = query.hide_dead !== false;
  const stage = parseMarketStage(query.stage);
  const { page, pageSize } = clampPage(query, BOARD_PAGE_SIZE);
  return memo(`memes:${hideDead}:${stage}:${page}:${pageSize}`, READ_TTL_MS, () =>
    loadMemesUncached(query),
  );
}

async function loadMemesUncached(query: GetMemesQuery = {}): Promise<GetMemesResponse> {
  const hideDead = query.hide_dead !== false;
  const stage: MarketStage = parseMarketStage(query.stage);
  const { page, pageSize, offset } = clampPage(query, BOARD_PAGE_SIZE);
  const meta = await loadIndexerMeta();
  const empty: GetMemesResponse = {
    indexer: meta.indexer,
    hide_dead: hideDead,
    stage,
    memes: [],
    memes_total: 0,
    page,
    page_size: pageSize,
  };
  if (!databaseUrl()) return empty;

  const whereVol = `$1::boolean = false OR $2::text = 'graduated' OR coalesce(v.volume_usd_24h, 0) <> 0`;
  const poolStage = poolStageSql("p");
  const [countQ, listQ] = await Promise.all([
    db().query<{ n: number }>(`
      WITH ${VOL24_CTE},
      vols AS (
        SELECT p.meme_address, sum(coalesce(v.volume_usd_24h, 0)) AS volume_usd_24h
        FROM pools p
        LEFT JOIN vol24 v ON v.pool_id = p.id
        WHERE p.meme_address IS NOT NULL
        ${poolStage}
        GROUP BY p.meme_address
      )
      SELECT count(*)::int AS n FROM vols v WHERE ${whereVol}
    `, [hideDead, stage]),
    db().query<{
      meme_address: string;
      symbol: string | null;
      name: string | null;
      decimals: number | null;
      total_supply_raw: string | null;
      pool_id: string | null;
      graduated: boolean;
      token0: string;
      token1: string;
      stock_ticker: string | null;
      volume_usd_24h: string;
      price_meme_usdg: string | null;
      stock_dex_usdg: string | null;
    }>(`
      WITH ${VOL24_CTE},
      snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots),
      stock_px AS (
        SELECT DISTINCT ON (ticker) ticker, dex_price_usd
        FROM stock_snapshots
        ORDER BY ticker, block_number DESC
      ),
      vols AS (
        SELECT p.meme_address, sum(coalesce(v.volume_usd_24h, 0)) AS volume_usd_24h
        FROM pools p
        LEFT JOIN vol24 v ON v.pool_id = p.id
        WHERE p.meme_address IS NOT NULL
        ${poolStage}
        GROUP BY p.meme_address
      ),
      best AS (
        SELECT DISTINCT ON (p.meme_address)
          p.meme_address, p.pool_id, p.graduated, p.token0, p.token1, p.stock_ticker,
          s.price_meme_usdg, sp.dex_price_usd AS stock_dex_usdg
        FROM pools p
        LEFT JOIN vol24 v ON v.pool_id = p.id
        LEFT JOIN snap_head h ON true
        LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
        LEFT JOIN stock_px sp ON sp.ticker = p.stock_ticker
        WHERE p.meme_address IS NOT NULL
        ${poolStage}
        ORDER BY p.meme_address, coalesce(v.volume_usd_24h, 0) DESC
      )
      SELECT v.meme_address, t.symbol, t.name, t.decimals, t.total_supply_raw,
             b.pool_id, b.graduated, b.token0, b.token1, b.stock_ticker, v.volume_usd_24h,
             b.price_meme_usdg, b.stock_dex_usdg
      FROM vols v
      INNER JOIN best b ON b.meme_address = v.meme_address
      LEFT JOIN tokens t ON t.address = v.meme_address
      WHERE ${whereVol}
      ORDER BY coalesce(v.volume_usd_24h, 0) DESC, v.meme_address
      LIMIT $3 OFFSET $4
    `, [hideDead, stage, pageSize, offset]),
  ]);

  const prices = await fillMemePrices(
    listQ.rows.map((r) => ({
      pool_id: r.pool_id,
      token0: r.token0,
      token1: r.token1,
      meme: r.meme_address,
      stock_dex_usdg: r.stock_dex_usdg != null ? Number(r.stock_dex_usdg) : null,
      price_usdg: r.price_meme_usdg != null ? Number(r.price_meme_usdg) : null,
    })),
  );

  const needSupply = listQ.rows.filter((r) => !r.total_supply_raw).map((r) => r.meme_address);
  const client = rpcClient();
  let supplies = new Map<string, bigint>();
  if (client && needSupply.length) {
    try {
      supplies = await readTotalSupplies(client, needSupply);
    } catch {
      supplies = new Map();
    }
  }
  for (const [addr, raw] of supplies) {
    await db().query(`UPDATE tokens SET total_supply_raw = $2 WHERE address = $1`, [addr, raw.toString()]);
  }

  const memes: MemeBoardRow[] = listQ.rows.map((r) => {
    const price =
      (r.pool_id ? prices.get(r.pool_id.toLowerCase()) : null) ??
      (r.price_meme_usdg != null ? Number(r.price_meme_usdg) : null);
    const raw = r.total_supply_raw ?? supplies.get(r.meme_address.toLowerCase())?.toString() ?? null;
    const dec = tokenDecimals(r.meme_address, r.decimals);
    let marketcap: number | null = null;
    if (price != null && raw) {
      try {
        marketcap = Number(formatUnits(BigInt(String(raw).split(".")[0] || "0"), dec)) * price;
        if (!Number.isFinite(marketcap)) marketcap = null;
      } catch {
        marketcap = null;
      }
    }
    return {
      address: r.meme_address,
      symbol: r.symbol,
      name: r.name,
      volume_usd_24h: Number(r.volume_usd_24h ?? 0),
      price_usdg: price,
      marketcap_usdg: marketcap,
      quote: quoteLabel(r.token0, r.token1, r.meme_address, r.stock_ticker),
      stage: pairStage(r.pool_id, r.graduated),
      token_path: `/t/${r.meme_address}`,
    };
  });

  return {
    indexer: meta.indexer,
    hide_dead: hideDead,
    stage,
    memes,
    memes_total: countQ.rows[0]?.n ?? 0,
    page,
    page_size: pageSize,
  };
}

const LIVE_CANONICAL = `
  p.meme_address IS NOT NULL
  AND p.pair_quality IN ('pair_canonical', 'canonical')
`;

const BOARD_SELECT = `
  p.address, p.dex, p.meme_address, p.pool_id, p.graduated, p.created_at,
  t.symbol, t.name, t.launchpad,
  st.ticker, st.contract_hex,
  s.stock_bal_raw, coalesce(v.volume_usd_24h, 0) AS volume_usd_24h
`;

export async function loadHomeSummary(
  query: { stage?: MarketStage } = {},
): Promise<GetHomeSummaryResponse> {
  const stage = parseMarketStage(query.stage);
  return memo(`home:${stage}`, READ_TTL_MS, () => loadHomeSummaryUncached(stage));
}

async function loadHomeSummaryUncached(stage: MarketStage): Promise<GetHomeSummaryResponse> {
  const meta = await loadIndexerMeta();
  const empty: GetHomeSummaryResponse = {
    indexer: meta.indexer,
    stage,
    stats: { live_canonical: 0, volume_usd_24h: 0, new_pairs_24h: null, fake_count: null },
    hottest: null,
    newest_live: null,
    fake_example: null,
    top_pairs: [],
    top_stocks: [],
    top_memes: [],
    top: [],
    newest: [],
    fakes: [],
  };
  if (!databaseUrl()) return empty;

  const [statsQ, pairTopQ, stockTopQ, memeTopQ, topQ] = await Promise.all([
    db().query<{
      live_canonical: number;
      volume_usd_24h: string;
      new_pairs_24h: number;
      fake_pairs: number;
      impersonators: number;
    }>(`
      WITH ${VOL24_CTE}
      SELECT
        (
          SELECT count(*)::int FROM pools p
          LEFT JOIN vol24 v ON v.pool_id = p.id
          WHERE ${LIVE_CANONICAL} AND coalesce(v.volume_usd_24h, 0) <> 0
        ) AS live_canonical,
        (
          SELECT coalesce(sum(v.volume_usd_24h), 0) FROM pools p
          INNER JOIN vol24 v ON v.pool_id = p.id
          WHERE ${LIVE_CANONICAL}
        ) AS volume_usd_24h,
        (
          SELECT count(*)::int FROM pools
          WHERE meme_address IS NOT NULL
            AND pair_quality IN ('pair_canonical', 'canonical')
            AND created_at > now() - interval '24 hours'
        ) AS new_pairs_24h,
        (
          SELECT count(*)::int FROM pools
          WHERE meme_address IS NOT NULL
            AND pair_quality IN ('pair_fake_underlying', 'fake_underlying')
        ) AS fake_pairs,
        (
          SELECT count(*)::int FROM tokens t
          INNER JOIN stock_tokens st
            ON upper(regexp_replace(coalesce(t.symbol, ''), '^RH', '', 'i')) = st.ticker
          WHERE coalesce(t.is_stock_token, false) = false
            AND lower(t.address) <> lower(st.contract_hex)
        ) AS impersonators
    `),
    db().query<BoardSql>(`
      WITH ${VOL24_CTE},
      snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots)
      SELECT ${BOARD_SELECT}
      FROM pools p
      LEFT JOIN vol24 v ON v.pool_id = p.id
      LEFT JOIN snap_head h ON true
      LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
      INNER JOIN stock_tokens st ON st.ticker = p.stock_ticker
      LEFT JOIN tokens t ON t.address = p.meme_address
      WHERE ${LIVE_CANONICAL} AND coalesce(v.volume_usd_24h, 0) <> 0
      ORDER BY coalesce(v.volume_usd_24h, 0) DESC, p.address
      LIMIT 3
    `),
    db().query<{
      ticker: string;
      name: string;
      contract_hex: string;
      volume_usd_24h: string;
    }>(`
      WITH ${VOL24_CTE},
      stock_vol AS (
        SELECT p.stock_ticker AS ticker, sum(v.volume_usd_24h) AS volume_usd_24h
        FROM pools p
        INNER JOIN vol24 v ON v.pool_id = p.id
        WHERE p.stock_ticker IS NOT NULL
        GROUP BY p.stock_ticker
      )
      SELECT st.ticker, st.name, st.contract_hex, coalesce(sv.volume_usd_24h, 0) AS volume_usd_24h
      FROM stock_tokens st
      INNER JOIN stock_vol sv ON sv.ticker = st.ticker
      WHERE st.is_active AND coalesce(sv.volume_usd_24h, 0) <> 0
      ORDER BY coalesce(sv.volume_usd_24h, 0) DESC, st.ticker
      LIMIT 3
    `),
    db().query<{ meme_address: string; symbol: string | null; volume_usd_24h: string }>(`
      WITH ${VOL24_CTE},
      vols AS (
        SELECT p.meme_address, sum(coalesce(v.volume_usd_24h, 0)) AS volume_usd_24h
        FROM pools p
        LEFT JOIN vol24 v ON v.pool_id = p.id
        WHERE p.meme_address IS NOT NULL
          AND p.pair_quality IN ('pair_canonical', 'canonical')
        GROUP BY p.meme_address
      )
      SELECT v.meme_address, t.symbol, v.volume_usd_24h
      FROM vols v
      LEFT JOIN tokens t ON t.address = v.meme_address
      WHERE coalesce(v.volume_usd_24h, 0) <> 0
      ORDER BY v.volume_usd_24h DESC, v.meme_address
      LIMIT 3
    `),
    db().query<BoardSql>(`
      WITH ${VOL24_CTE},
      snap_head AS (SELECT max(block_number) AS block_number FROM pool_snapshots)
      SELECT ${BOARD_SELECT}
      FROM pools p
      LEFT JOIN vol24 v ON v.pool_id = p.id
      LEFT JOIN snap_head h ON true
      LEFT JOIN pool_snapshots s ON s.pool_id = p.id AND s.block_number = h.block_number
      INNER JOIN stock_tokens st ON st.ticker = p.stock_ticker
      LEFT JOIN tokens t ON t.address = p.meme_address
      WHERE ${LIVE_CANONICAL}
        AND ($1::text = 'graduated' OR coalesce(v.volume_usd_24h, 0) <> 0)
        ${poolStageSql("p", "$1")}
      ORDER BY coalesce(v.volume_usd_24h, 0) DESC, p.address
      LIMIT 20
    `, [stage]),
  ]);

  const st = statsQ.rows[0];
  const top_pairs = pairTopQ.rows.filter((r) => r.meme_address).map(mapBoardRow);
  const top_stocks = stockTopQ.rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    contract_hex: r.contract_hex,
    volume_usd_24h: Number(r.volume_usd_24h ?? 0),
    dex_usdg: null,
    stock_path: `/s/${r.ticker}`,
  }));
  const top_memes = memeTopQ.rows.map((r) => ({
    address: r.meme_address,
    symbol: r.symbol,
    volume_usd_24h: Number(r.volume_usd_24h ?? 0),
    token_path: `/t/${r.meme_address}`,
  }));
  const top = topQ.rows.filter((r) => r.meme_address).map(mapBoardRow);
  const fakePoolCount = st?.fake_pairs ?? 0;
  const impersonatorCount = st?.impersonators ?? 0;
  const fake_count =
    fakePoolCount > 0 ? fakePoolCount : impersonatorCount > 0 ? impersonatorCount : null;

  return {
    indexer: meta.indexer,
    stage,
    stats: {
      live_canonical: st?.live_canonical ?? 0,
      volume_usd_24h: Number(st?.volume_usd_24h ?? 0),
      new_pairs_24h: st ? st.new_pairs_24h : null,
      fake_count,
    },
    hottest: top_pairs[0] ?? null,
    newest_live: null,
    fake_example: null,
    top_pairs,
    top_stocks,
    top_memes,
    top,
    newest: [],
    fakes: [],
  };
}

export async function loadLookup(ticker: string): Promise<GetLookupResponse | null> {
  if (!databaseUrl()) return null;
  const { rows } = await db().query<{
    ticker: string;
    name: string;
    asset_type: GetLookupResponse["asset_type"];
    is_active: boolean;
    contract_hex: string;
  }>(
    `SELECT ticker, name, asset_type, is_active, contract_hex FROM stock_tokens WHERE ticker = $1`,
    [ticker.toUpperCase()],
  );
  const row = rows[0];
  if (!row) return null;
  const { rows: likes } = await db().query<{ address: string; symbol: string | null }>(
    `SELECT address, symbol FROM tokens
     WHERE coalesce(is_stock_token, false) = false
       AND upper(regexp_replace(coalesce(symbol, ''), '^RH', '', 'i')) = $1
       AND lower(address) <> $2
     ORDER BY address
     LIMIT 50`,
    [row.ticker, row.contract_hex],
  );
  return {
    ticker: row.ticker,
    name: row.name,
    asset_type: row.asset_type,
    is_active: row.is_active,
    contract: checksum(row.contract_hex),
    contract_hex: row.contract_hex,
    kind: "stock_canonical",
    explorer_url: explorerAddress(row.contract_hex),
    lookalikes: likes.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      contract_hex: t.address,
    })),
  };
}

export async function loadVerify(address: string): Promise<GetVerifyResponse | null> {
  const hex = normalizeHex(address);
  if (!hex) return null;
  const registry = await loadRegistryRows();

  let symbol: string | null = null;
  let pool: { address: string; token0: string; token1: string } | null = null;
  if (databaseUrl()) {
    const tokenQ = await db().query<{ symbol: string | null }>(
      `SELECT symbol FROM tokens WHERE address = $1`,
      [hex],
    );
    symbol = tokenQ.rows[0]?.symbol ?? null;
    const poolQ = await db().query<{ address: string; token0: string; token1: string }>(
      `SELECT address, token0, token1 FROM pools
       WHERE token0 = $1 OR token1 = $1 OR meme_address = $1 OR address = $1
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [hex],
    );
    pool = poolQ.rows[0] ?? null;
  }

  const tokenResult = classify({
    address: hex,
    symbols: { [hex]: symbol },
    registry,
  });

  let result = tokenResult;
  if (tokenResult.kind === "unknown" && pool) {
    const other = pool.token0 === hex ? pool.token1 : pool.token1 === hex ? pool.token0 : pool.token1;
    let otherSymbol: string | null = null;
    if (databaseUrl()) {
      const o = await db().query<{ symbol: string | null }>(
        `SELECT symbol FROM tokens WHERE address = $1`,
        [other],
      );
      otherSymbol = o.rows[0]?.symbol ?? null;
    }
    result = classify({
      token0: pool.token0,
      token1: pool.token1,
      symbols: { [hex]: symbol, [other]: otherSymbol },
      registry,
    });
  }

  return {
    address: hex,
    kind: result.kind as ClassifyKind,
    copy_line: result.copy_line,
    official: result.official
      ? {
          ticker: result.official.ticker,
          contract: checksum(result.official.contract_hex),
          contract_hex: result.official.contract_hex,
        }
      : null,
    impersonator: result.impersonator
      ? {
          claimed_ticker: result.impersonator.claimed_ticker,
          this_contract: checksum(result.impersonator.this_contract),
          this_contract_hex: result.impersonator.this_contract,
          official: {
            ticker: result.impersonator.official.ticker,
            contract: checksum(result.impersonator.official.contract_hex),
            contract_hex: result.impersonator.official.contract_hex,
          },
        }
      : null,
    pair:
      result.token0 && result.token1
        ? {
            token0: result.token0,
            token1: result.token1,
            pool_address: pool?.address ?? null,
          }
        : null,
  };
}
