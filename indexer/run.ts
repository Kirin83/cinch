import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  getAddress,
  http,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
  type Address,
  type PublicClient,
} from "viem";
import { applySchema, db } from "../lib/db";
import {
  ASSETS_URL,
  CHAIN_ID,
  FEEDS_URL,
  isSpotQuote,
  EXPLORER,
  LONG_AIRLOCK,
  LONG_FACTORY,
  LONG_V4_FEE,
  LONG_V4_TICK_SPACING,
  PONS_V2_FACTORY,
  PONS_V2_HOOK,
  PRICES_URL,
  RPC_URL,
  UNI_V4_POOL_MANAGER,
  UNI_V4_STATE_VIEW,
  CBBTC,
  USDG,
  WETH,
  ZERO,
} from "../lib/chain";
import { classify, poolPairQuality, stockTickerFromClassify } from "../lib/classify";
import { classifyAsset } from "../lib/sectors";
import { PONS_V4_FEE, PONS_V4_TICK_SPACING, priceToken1PerToken0, sortedPair, v4PoolId, v4WantAmount } from "../lib/v4math";
import { memePriceUsdg, otherToken, quoteUsdRate, readV4States, tokenDecimals, type V4State } from "../lib/v4rpc";

const erc20Abi = [
  parseAbiItem("function totalSupply() view returns (uint256)"),
  parseAbiItem("function balanceOf(address) view returns (uint256)"),
  parseAbiItem("function symbol() view returns (string)"),
  parseAbiItem("function name() view returns (string)"),
  parseAbiItem("function decimals() view returns (uint8)"),
  parseAbiItem("function owner() view returns (address)"),
] as const;

const feedAbi = [
  parseAbiItem(
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ),
  parseAbiItem("function decimals() view returns (uint8)"),
] as const;

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);

const tokenLaunched = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);
const poolRegistered = parseAbiItem(
  "event PoolRegistered(bytes32 indexed poolId, address memecoin, address quoteToken, address creator)",
);
const launchSwept = parseAbiItem(
  "event LaunchSwept(address indexed token, uint256 sweptQuote, uint256 sweptTokens)",
);
const poolGraduated = parseAbiItem(
  "event PoolGraduated(address indexed token, bytes32 indexed poolId, address indexed pool)",
);
const getLaunchedTokenAbi = parseAbi([
  "function getLaunchedToken(address token) view returns (address token, address curve, address deployer, address creatorFeeRecipient, address pairToken, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, uint16 creatorTaxBps, bool buybackEnabled, uint8 phase, uint256 sweptQuote, uint256 sweptTokens, uint256 sweptAt, bool exists)",
]);
const launchCreated = parseAbiItem(
  "event LaunchCreated(address indexed poolOrHook, address indexed asset, address indexed numeraire, address poolInitializer, address launcher, bytes32 tickerKey, uint48 deployedAt, uint48 reservedUntil, string normalizedTicker)",
);
const v4Initialize = parseAbiItem(
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
);
const v4Swap = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);
const curveBuy = parseAbiItem(
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
);
const curveSell = parseAbiItem(
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
);
const ponsReceiptAbi = [
  tokenLaunched,
  launchSwept,
  poolGraduated,
  poolRegistered,
  v4Initialize,
  v4Swap,
  curveBuy,
  curveSell,
  parseAbiItem("event CurveCompleted(uint256 sweptQuote, uint256 sweptTokens)"),
  parseAbiItem("event AutoGraduationFailed(address indexed token)"),
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
];

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
    }
  }
}

function hexAddr(value: `0x${string}` | Address | string): string {
  return value.toLowerCase();
}

function normalizePairToken(pair: string): string {
  const p = hexAddr(pair);
  return p === ZERO ? WETH : p;
}

/** Uniswap v4 PoolKey uses native currency address(0), not WETH. */
function pairTokenForV4(pair: string): string {
  return hexAddr(pair);
}

function isZeroBytes32(id: string | null | undefined): boolean {
  if (!id) return true;
  return /^0x0+$/.test(id);
}

function chunkArr<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toBytea(hex: string) {
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(err: unknown): boolean {
  const msg = `${(err as { message?: string })?.message ?? ""} ${(err as { details?: string })?.details ?? ""}`;
  return /too many requests|429|rate limit/i.test(msg);
}

function rateLimitWaitMs(err: unknown): number {
  const msg = `${(err as { details?: string })?.details ?? ""} ${(err as { message?: string })?.message ?? ""}`;
  const m = msg.match(/(\d+)\s*seconds/i);
  return ((m ? Number(m[1]) : 60) + 2) * 1000;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRateLimited(err) || i === tries - 1) throw err;
      const wait = rateLimitWaitMs(err);
      console.log(`rate limited, sleep ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  throw last;
}

async function client(): Promise<PublicClient> {
  return createPublicClient({
    chain: {
      id: CHAIN_ID,
      name: "Robinhood Chain",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
      contracts: {
        multicall3: {
          address: "0xcA11bde05977b3631167028862bE2a173976CA11",
          blockCreated: 1,
        },
      },
    },
    transport: http(RPC_URL, { timeout: 30_000, retryCount: 3 }),
  });
}

async function setState(key: string, lastBlock: bigint, headTs?: Date) {
  const lag = headTs ? Math.max(0, Math.round((Date.now() - headTs.getTime()) / 1000)) : 0;
  await db().query(
    `INSERT INTO indexer_state(key, last_block, last_ok_at, lag_seconds)
     VALUES ($1,$2,now(),$3)
     ON CONFLICT (key) DO UPDATE SET last_block=EXCLUDED.last_block, last_ok_at=now(), lag_seconds=EXCLUDED.lag_seconds`,
    [key, lastBlock.toString(), lag],
  );
}

async function lastBlock(key: string): Promise<bigint | null> {
  const { rows } = await db().query(`SELECT last_block FROM indexer_state WHERE key=$1`, [key]);
  return rows[0] ? BigInt(rows[0].last_block) : null;
}

type DecodedLog<T = Record<string, unknown>> = {
  address: Address;
  args: T;
  blockNumber: bigint;
  logIndex: number | null;
  transactionHash: `0x${string}` | null;
};

function decoded(log: {
  args?: unknown;
  address: Address;
  blockNumber: bigint | null;
  logIndex?: number | null;
  transactionHash?: `0x${string}` | null;
}): DecodedLog | null {
  if (log.blockNumber == null || log.args == null) return null;
  return log as DecodedLog;
}

function fromBlock(saved: bigint | null, head: bigint, lookback: bigint): bigint {
  if (saved != null) return saved + 1n > head ? head : saved + 1n;
  return head > lookback ? head - lookback : 1n;
}

function indexerChunk(): bigint {
  return BigInt(process.env.INDEXER_CHUNK_BLOCKS ?? "4000");
}

function indexerHistory(): bigint {
  return BigInt(process.env.INDEXER_HISTORY_BLOCKS ?? "400000");
}

/** vol24h only needs a recent window. Skip million-block crawls that leave Markets empty. */
function volumeWindowBlocks(): bigint {
  return BigInt(process.env.INDEXER_VOLUME_WINDOW_BLOCKS ?? "120000");
}

async function seekVolumeWindow(head: bigint) {
  const window = volumeWindowBlocks();
  const saved = await lastBlock("volume");
  const floor = head > window ? head - window : 1n;
  if (saved != null && saved + 1n >= floor) return;
  const to = floor > 1n ? floor - 1n : 0n;
  console.log(`volume seek ${saved ?? "null"} -> ${to} (window ${window} blocks, head ${head})`);
  await setState("volume", to);
}

function nextWindow(
  saved: bigint | null,
  head: bigint,
  lookback: bigint,
  chunk = indexerChunk(),
): { from: bigint; to: bigint } | null {
  const from = fromBlock(saved, head, lookback);
  if (from > head) return null;
  const to = from + chunk - 1n > head ? head : from + chunk - 1n;
  return { from, to };
}

async function catchUp(
  key: string,
  head: bigint,
  lookback: bigint,
  run: (from: bigint, to: bigint) => Promise<void>,
  budgetMs: number,
): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const w = nextWindow(await lastBlock(key), head, lookback);
    if (!w) break;
    console.log(`catchup ${key} ${w.from} -> ${w.to} (head ${head})`);
    await run(w.from, w.to);
    if (w.to >= head) break;
  }
}

export async function syncRegistry() {
  const res = await fetch(ASSETS_URL);
  if (!res.ok) throw new Error(`assets ${res.status}`);
  const body = (await res.json()) as {
    assets: Array<{
      tokenSymbol: string;
      tokenName: string;
      tokenDecimals?: number;
      status: string;
      deployments: Array<{ contractAddress: string; chainId: number }>;
    }>;
  };
  const now = new Date();
  let n = 0;
  for (const a of body.assets ?? []) {
    const dep = a.deployments?.find((d) => d.chainId === CHAIN_ID);
    if (!dep) continue;
    const hex = dep.contractAddress.toLowerCase();
    const { asset_type, sectors } = classifyAsset(a.tokenSymbol, a.tokenName);
    await db().query(
      `INSERT INTO stock_tokens(ticker, name, contract, contract_hex, decimals, asset_type, sectors, is_active, registry_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (ticker) DO UPDATE SET
         name=EXCLUDED.name, contract=EXCLUDED.contract, contract_hex=EXCLUDED.contract_hex,
         decimals=EXCLUDED.decimals, asset_type=EXCLUDED.asset_type, sectors=EXCLUDED.sectors,
         is_active=EXCLUDED.is_active, registry_synced_at=EXCLUDED.registry_synced_at`,
      [
        a.tokenSymbol.toUpperCase(),
        a.tokenName.replace(/\s*•\s*Robinhood Token/i, "").trim() || a.tokenName,
        toBytea(hex),
        hex,
        a.tokenDecimals ?? 18,
        asset_type,
        sectors,
        a.status !== "ASSET_STATUS_INACTIVE",
        now,
      ],
    );
    await db().query(
      `INSERT INTO tokens(address, symbol, name, decimals, is_stock_token)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (address) DO UPDATE SET symbol=EXCLUDED.symbol, name=EXCLUDED.name, is_stock_token=true`,
      [hex, a.tokenSymbol.toUpperCase(), a.tokenName, a.tokenDecimals ?? 18],
    );
    n++;
  }

  const feedsRes = await fetch(FEEDS_URL);
  if (feedsRes.ok) {
    const feeds = (await feedsRes.json()) as Array<{ name: string; proxyAddress: string }>;
    for (const f of feeds) {
      const m = f.name.match(/Robinhood\s+([A-Z0-9.-]+)\s*[/\-]\s*USD/i);
      if (!m) continue;
      const ticker = m[1].replace(/-/g, "").toUpperCase();
      await db().query(`UPDATE stock_tokens SET oracle_feed=$1 WHERE ticker=$2`, [
        f.proxyAddress.toLowerCase(),
        ticker,
      ]);
    }
    const eth = feeds.find((f) => /(?:^|\s)ETH\s*[/\-]\s*USD/i.test(f.name));
    if (eth) process.env.ETH_USD_FEED = eth.proxyAddress.toLowerCase();
  }
  console.log(`registry ${n} assets`);
}

async function getLogsRange(
  publicClient: PublicClient,
  params: {
    address?: Address | Address[];
    event: ReturnType<typeof parseAbiItem>;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
  },
): Promise<DecodedLog[]> {
  const out: DecodedLog[] = [];
  if (params.fromBlock > params.toBlock) return out;
  let from = params.fromBlock;
  let span = 2_000n;
  while (from <= params.toBlock) {
    const to = from + span - 1n > params.toBlock ? params.toBlock : from + span - 1n;
    try {
      const logs = await publicClient.getLogs({
        ...(params.address ? { address: params.address } : {}),
        event: params.event,
        ...(params.args ? { args: params.args } : {}),
        fromBlock: from,
        toBlock: to,
      } as Parameters<PublicClient["getLogs"]>[0]);
      for (const log of logs) {
        const d = decoded(log);
        if (d) out.push(d);
      }
      from = to + 1n;
      if (logs.length < 100 && span < 8_000n) span *= 2n;
    } catch (err) {
      if (isRateLimited(err)) {
        await sleep(rateLimitWaitMs(err));
        continue;
      }
      if (span <= 1n) throw err;
      span = span / 2n;
      if (span < 1n) span = 1n;
    }
  }
  return out;
}

async function upsertMeme(opts: {
  token: string;
  curve: string;
  creator: string;
  pair: string;
  block: bigint;
  timestamp: Date;
  registry: Map<string, string>;
}) {
  const token = hexAddr(opts.token);
  const curve = hexAddr(opts.curve);
  const pair = normalizePairToken(opts.pair);
  const creator = hexAddr(opts.creator);

  await db().query(
    `INSERT INTO tokens(address, created_at, creator, launchpad, is_stock_token)
     VALUES ($1,$2,$3,'pons', false)
     ON CONFLICT (address) DO UPDATE SET
       creator=COALESCE(EXCLUDED.creator, tokens.creator),
       launchpad='pons'`,
    [token, opts.timestamp, creator],
  );

  const classified = classify({
    token0: token,
    token1: pair,
    registry: opts.registry,
  });
  const pairQuality = poolPairQuality(classified.kind);
  const ticker = stockTickerFromClassify(classified);

  await db().query(
    `INSERT INTO pools(address, dex, token0, token1, created_at, created_block, stock_ticker, meme_address, pair_quality, creator, hooks, tick_spacing, fee_bps, pool_id, graduated)
     VALUES ($1,'pons_curve',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,false)
     ON CONFLICT (address) DO UPDATE SET
       token1=EXCLUDED.token1,
       stock_ticker=COALESCE(EXCLUDED.stock_ticker, pools.stock_ticker),
       meme_address=COALESCE(EXCLUDED.meme_address, pools.meme_address),
       pair_quality=EXCLUDED.pair_quality,
       creator=COALESCE(EXCLUDED.creator, pools.creator),
       tick_spacing=COALESCE(pools.tick_spacing, EXCLUDED.tick_spacing)`,
    [
      curve,
      token,
      pair,
      opts.timestamp,
      opts.block.toString(),
      ticker,
      token,
      pairQuality,
      creator,
      PONS_V2_HOOK,
      PONS_V4_TICK_SPACING,
      0,
    ],
  );
}

async function fillMetadata(publicClient: PublicClient, only?: string[]) {
  const { rows } = only?.length
    ? { rows: only.map((address) => ({ address })) }
    : await db().query<{ address: string }>(
        `SELECT address FROM tokens WHERE is_stock_token = false AND (symbol IS NULL OR name IS NULL) LIMIT 200`,
      );
  const chunk = 80;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const symbols = await publicClient.multicall({
      contracts: slice.flatMap((r) => [
        { address: r.address as Address, abi: erc20Abi, functionName: "symbol" as const },
        { address: r.address as Address, abi: erc20Abi, functionName: "name" as const },
        { address: r.address as Address, abi: erc20Abi, functionName: "decimals" as const },
      ]),
      allowFailure: true,
    });
    for (let j = 0; j < slice.length; j++) {
      const sym = symbols[j * 3];
      const nam = symbols[j * 3 + 1];
      const dec = symbols[j * 3 + 2];
      await db().query(
        `UPDATE tokens SET symbol=COALESCE($2, symbol), name=COALESCE($3, name), decimals=COALESCE($4, decimals) WHERE address=$1`,
        [
          slice[j].address,
          sym.status === "success" ? String(sym.result) : null,
          nam.status === "success" ? String(nam.result) : null,
          dec.status === "success" ? Number(dec.result) : null,
        ],
      );
    }
  }

  const unknown = await db().query<{ address: string; token0: string; token1: string }>(
    `SELECT address, token0, token1 FROM pools WHERE pair_quality = 'unknown' AND meme_address IS NOT NULL`,
  );
  const { rows: stocks } = await db().query<{ ticker: string; contract_hex: string }>(
    `SELECT ticker, contract_hex FROM stock_tokens`,
  );
  const registry = new Map(stocks.map((s) => [s.contract_hex, s.ticker]));
  const pairAddrs = [...new Set(unknown.rows.map((r) => r.token1))];
  const symbols = new Map<string, string>();
  for (let i = 0; i < pairAddrs.length; i += 50) {
    const slice = pairAddrs.slice(i, i + 50);
    const result = await publicClient.multicall({
      contracts: slice.map((a) => ({
        address: a as Address,
        abi: erc20Abi,
        functionName: "symbol" as const,
      })),
      allowFailure: true,
    });
    for (let j = 0; j < slice.length; j++) {
      const r = result[j];
      if (r.status !== "success") continue;
      symbols.set(slice[j], String(r.result));
    }
  }
  for (const row of unknown.rows) {
    const classified = classify({
      token0: row.token0,
      token1: row.token1,
      symbols: { [row.token1]: symbols.get(row.token1) ?? null },
      registry,
    });
    const quality = poolPairQuality(classified.kind);
    if (quality === "unknown") continue;
    await db().query(
      `UPDATE pools SET pair_quality=$2, stock_ticker=COALESCE($3, stock_ticker)
       WHERE address=$1 AND pair_quality='unknown'`,
      [row.address, quality, stockTickerFromClassify(classified)],
    );
  }
}

async function onceResetPonsInferredPoolIds() {
  const { rows } = await db().query(`SELECT 1 FROM indexer_state WHERE key='pons_v2_no_inferred_poolid'`);
  if (rows[0]) return;
  await db().query(`UPDATE pools SET pool_id = NULL, graduated = false WHERE dex = 'pons_curve'`);
  await db().query(
    `UPDATE pools SET token1 = $1 WHERE dex = 'pons_curve' AND token1 = $2`,
    [WETH, ZERO],
  );
  await db().query(
    `INSERT INTO indexer_state(key, last_block, last_ok_at, lag_seconds)
     VALUES ('pons_v2_no_inferred_poolid', 1, now(), 0)`,
  );
  await db().query(`DELETE FROM indexer_state WHERE key = 'pons_grad'`);
  console.log("pons_v2: cleared inferred pool_id on pons_curve rows");
}

function decodeLogEventNames(logs: { address: Address; topics: `0x${string}`[]; data: `0x${string}`; logIndex: number | null }[]) {
  const parsed = parseEventLogs({
    abi: ponsReceiptAbi,
    logs: logs as Parameters<typeof parseEventLogs>[0]["logs"],
    strict: false,
  });
  const byIndex = new Map(parsed.map((p) => [p.logIndex, p.eventName]));
  return logs.map((log) => byIndex.get(log.logIndex) ?? `unknown:${log.topics[0] ?? "no-topic"}`);
}

function poolIdFromPonsLogs(
  logs: { address: Address; topics: `0x${string}`[]; data: `0x${string}`; logIndex: number | null }[],
  token: string,
): string | null {
  const parsed = parseEventLogs({
    abi: ponsReceiptAbi,
    logs: logs as Parameters<typeof parseEventLogs>[0]["logs"],
    strict: false,
  });
  const t = hexAddr(token);
  const hook = hexAddr(PONS_V2_HOOK);
  for (const p of parsed) {
    if (p.eventName !== "PoolRegistered") continue;
    const args = p.args as { poolId: `0x${string}`; memecoin: Address };
    if (hexAddr(args.memecoin) === t && !isZeroBytes32(args.poolId)) {
      return args.poolId.toLowerCase();
    }
  }
  for (const p of parsed) {
    if (p.eventName !== "Initialize") continue;
    const args = p.args as {
      id: `0x${string}`;
      currency0: Address;
      currency1: Address;
      hooks?: Address;
    };
    const c0 = hexAddr(args.currency0);
    const c1 = hexAddr(args.currency1);
    const h = args.hooks ? hexAddr(args.hooks) : "";
    if ((c0 === t || c1 === t) && (h === hook || !h) && !isZeroBytes32(args.id)) {
      return args.id.toLowerCase();
    }
  }
  return null;
}

async function readLaunchedToken(publicClient: PublicClient, token: Address) {
  try {
    const row = await publicClient.readContract({
      address: PONS_V2_FACTORY as Address,
      abi: getLaunchedTokenAbi,
      functionName: "getLaunchedToken",
      args: [token],
    });
    const pairRaw = pairTokenForV4(
      (Array.isArray(row) ? row[4] : (row as { pairToken: Address }).pairToken) as string,
    );
    const pairToken = normalizePairToken(pairRaw);
    const tickSpacing = Number(
      Array.isArray(row) ? row[7] : (row as { tickSpacing: number }).tickSpacing,
    );
    const phase = Number(Array.isArray(row) ? row[10] : (row as { phase: number }).phase);
    const exists = Boolean(Array.isArray(row) ? row[14] : (row as { exists: boolean }).exists);
    const spacing = tickSpacing || PONS_V4_TICK_SPACING;
    const poolId =
      exists && phase >= 2
        ? v4PoolId(hexAddr(token), pairRaw, PONS_V4_FEE, spacing, PONS_V2_HOOK).toLowerCase()
        : null;
    return { phase, poolId, pairToken, exists, tickSpacing: spacing };
  } catch {
    return null;
  }
}

async function poolIdFromFactory(
  publicClient: PublicClient,
  token: Address,
): Promise<string | null> {
  const t = await readLaunchedToken(publicClient, token);
  return t?.poolId ?? null;
}

async function resolvePonsV4PoolId(
  publicClient: PublicClient,
  token: Address,
  tx?: `0x${string}` | null,
): Promise<string | null> {
  if (tx) {
    try {
      const receipt = await withRetry(() => publicClient.getTransactionReceipt({ hash: tx }));
      const fromLogs = poolIdFromPonsLogs(receipt.logs, token);
      if (fromLogs) return fromLogs;
    } catch {
      /* fall through to factory */
    }
  }
  return poolIdFromFactory(publicClient, token);
}

async function setPonsGraduated(opts: {
  token: string;
  poolId: string | null;
  source: string;
  tx?: string | null;
}) {
  const token = hexAddr(opts.token);
  const poolId = isZeroBytes32(opts.poolId) ? null : opts.poolId!.toLowerCase();
  if (poolId) {
    await db().query(
      `UPDATE pools SET graduated=true, pool_id=$1, hooks=$2, tick_spacing=COALESCE(tick_spacing, $3)
       WHERE dex = 'pons_curve' AND (meme_address=$4 OR token0=$4)`,
      [poolId, PONS_V2_HOOK, PONS_V4_TICK_SPACING, token],
    );
    return;
  }
  await db().query(
    `UPDATE pools SET graduated=true WHERE dex = 'pons_curve' AND (meme_address=$1 OR token0=$1)`,
    [token],
  );
  console.log(
    `pons ${opts.source} without pool_id token=${token} tx=${opts.tx ?? ""}`,
  );
}

async function indexPonsGraduation(
  publicClient: PublicClient,
  fromBlockN: bigint,
  toBlock: bigint,
) {
  const swept = await getLogsRange(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: launchSwept,
    fromBlock: fromBlockN,
    toBlock,
  });
  const graduated = await getLogsRange(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: poolGraduated,
    fromBlock: fromBlockN,
    toBlock,
  });
  const registered = await getLogsRange(publicClient, {
    address: PONS_V2_HOOK as Address,
    event: poolRegistered,
    fromBlock: fromBlockN,
    toBlock,
  });
  console.log(
    `pons LaunchSwept ${swept.length} PoolGraduated ${graduated.length} PoolRegistered ${registered.length}`,
  );

  const missing: { token: string; tx: `0x${string}`; source: string }[] = [];

  for (const log of registered) {
    const args = log.args as {
      poolId: `0x${string}`;
      memecoin: Address;
    };
    await setPonsGraduated({
      token: args.memecoin,
      poolId: args.poolId,
      source: "PoolRegistered",
      tx: log.transactionHash,
    });
  }

  for (const log of graduated) {
    const args = log.args as { token: Address; poolId?: `0x${string}` };
    let poolId = args.poolId ?? null;
    if (isZeroBytes32(poolId)) {
      poolId = await resolvePonsV4PoolId(publicClient, args.token, log.transactionHash);
    }
    await setPonsGraduated({
      token: args.token,
      poolId,
      source: "PoolGraduated",
      tx: log.transactionHash,
    });
    if (isZeroBytes32(poolId) && log.transactionHash) {
      missing.push({ token: hexAddr(args.token), tx: log.transactionHash, source: "PoolGraduated" });
    }
  }

  for (const log of swept) {
    const args = log.args as { token: Address };
    const tx = log.transactionHash;
    let poolId = await resolvePonsV4PoolId(publicClient, args.token, tx);
    if (!poolId) {
      const have = await db().query<{ pool_id: string | null }>(
        `SELECT pool_id FROM pools WHERE dex='pons_curve' AND meme_address=$1 LIMIT 1`,
        [hexAddr(args.token)],
      );
      poolId = have.rows[0]?.pool_id ?? null;
    }
    await setPonsGraduated({
      token: args.token,
      poolId,
      source: "LaunchSwept",
      tx,
    });
    if (!poolId && tx) {
      missing.push({ token: hexAddr(args.token), tx, source: "LaunchSwept" });
    }
  }

  const still = await db().query<{ meme_address: string }>(
    `SELECT DISTINCT meme_address FROM pools
     WHERE dex='pons_curve' AND graduated AND pool_id IS NULL
       AND meme_address = ANY($1::text[])`,
    [missing.map((m) => m.token)],
  );
  const stillSet = new Set(still.rows.map((r) => r.meme_address));
  const seenTx = new Set<string>();
  for (const m of missing) {
    if (!stillSet.has(m.token) || seenTx.has(m.tx)) continue;
    seenTx.add(m.tx);
    try {
      const receipt = await withRetry(() =>
        publicClient.getTransactionReceipt({ hash: m.tx }),
      );
      const names = decodeLogEventNames(receipt.logs);
      console.log(
        `pons missing pool_id after ${m.source} token=${m.token} tx=${m.tx} events=${names.join(",")}`,
      );
    } catch (err) {
      console.log(`pons missing pool_id decode failed token=${m.token} tx=${m.tx} err=${err}`);
    }
  }
}

async function indexPons(
  publicClient: PublicClient,
  fromBlockN: bigint,
  toBlock: bigint,
  stateKey = "pons",
) {
  const { rows } = await db().query(`SELECT contract_hex, ticker FROM stock_tokens`);
  const registry = new Map(rows.map((r) => [r.contract_hex as string, r.ticker as string]));

  const launched = await getLogsRange(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: tokenLaunched,
    fromBlock: fromBlockN,
    toBlock,
  });
  console.log(`pons TokenLaunched ${launched.length} [${fromBlockN}..${toBlock}]`);

  const uniqueBlocks = [...new Set(launched.map((l) => l.blockNumber.toString()))];
  const blockTs = new Map<string, Date>();
  const headBlock = await withRetry(() => publicClient.getBlock({ blockNumber: toBlock }));
  const headTs = new Date(Number(headBlock.timestamp) * 1000);
  for (const n of uniqueBlocks) {
    blockTs.set(n, blockTime(BigInt(n), toBlock, headTs));
  }

  for (const log of launched) {
    const args = log.args as {
      token: Address;
      curve: Address;
      deployer: Address;
      pairToken: Address;
    };
    const ts = blockTs.get(log.blockNumber.toString()) ?? new Date();
    await upsertMeme({
      token: args.token,
      curve: args.curve,
      creator: args.deployer,
      pair: args.pairToken,
      block: log.blockNumber,
      timestamp: ts,
      registry,
    });
  }

  if (launched.length) {
    await fillMetadata(
      publicClient,
      launched.map((l) => hexAddr((l.args as { token: Address }).token)),
    );
  }

  await indexPonsGraduation(publicClient, fromBlockN, toBlock);
  await setState(stateKey, toBlock);
}

const PONS_SEED_TOKENS = [
  "0xaa07a0e9209e16ac99708c3ec70159c6ef3128a3",
  "0x812486eaea648819853f8e372dc9f1516c7868bd",
];

async function hydratePonsSeeds(publicClient: PublicClient, head: bigint) {
  const { rows } = await db().query(`SELECT contract_hex, ticker FROM stock_tokens`);
  const registry = new Map(rows.map((r) => [r.contract_hex as string, r.ticker as string]));
  for (const seed of PONS_SEED_TOKENS) {
    const have = await db().query(`SELECT 1 FROM tokens WHERE address = $1`, [seed]);
    if (have.rows[0]) continue;
    console.log(`pons hydrate ${seed}`);
    await ingestTokenLaunched(publicClient, seed as Address, registry, 1n, head);
  }
}

type LongLaunch = {
  asset: string;
  numeraire: string;
  hook: string;
  launcher: string;
  ticker: string | null;
  block: bigint;
  deployedAt: number | null;
};

function parseLongLaunch(args: {
  asset?: unknown;
  numeraire?: unknown;
  poolOrHook?: unknown;
  poolInitializer?: unknown;
  launcher?: unknown;
  normalizedTicker?: unknown;
  deployedAt?: unknown;
  block: bigint;
}): LongLaunch | null {
  const asset = hexAddr(String(args.asset ?? ""));
  const numeraire = hexAddr(String(args.numeraire ?? ""));
  const hook = hexAddr(String(args.poolOrHook ?? args.poolInitializer ?? ""));
  const launcher = hexAddr(String(args.launcher ?? ZERO));
  if (!/^0x[0-9a-f]{40}$/.test(asset) || !/^0x[0-9a-f]{40}$/.test(numeraire)) return null;
  if (!/^0x[0-9a-f]{40}$/.test(hook) || hook === ZERO) return null;
  const rawTicker = args.normalizedTicker != null ? String(args.normalizedTicker).trim() : "";
  const deployedAt = args.deployedAt != null ? Number(args.deployedAt) : null;
  return {
    asset,
    numeraire,
    hook,
    launcher,
    ticker: rawTicker || null,
    block: args.block,
    deployedAt: Number.isFinite(deployedAt) && (deployedAt as number) > 0 ? (deployedAt as number) : null,
  };
}

type V4Init = { id: string; fee: number; tickSpacing: number; hooks: string };

async function resolveV4Initialize(
  publicClient: PublicClient,
  currencyA: string,
  currencyB: string,
  hook: string | null,
  fromBlockN: bigint,
  toBlock: bigint,
): Promise<V4Init | null> {
  if (fromBlockN > toBlock) return null;
  const [c0, c1] = sortedPair(currencyA, currencyB);
  const logs = await getLogsRange(publicClient, {
    address: UNI_V4_POOL_MANAGER as Address,
    event: v4Initialize,
    args: { currency0: getAddress(c0), currency1: getAddress(c1) },
    fromBlock: fromBlockN,
    toBlock,
  });
  const wantHook = hook ? hexAddr(hook) : null;
  const parsed = logs.map((log) => {
    const args = log.args as {
      id: `0x${string}`;
      fee: number;
      tickSpacing: number;
      hooks: Address;
    };
    return {
      id: args.id.toLowerCase(),
      fee: Number(args.fee),
      tickSpacing: Number(args.tickSpacing),
      hooks: hexAddr(args.hooks),
    };
  });
  const matched = wantHook ? parsed.filter((p) => p.hooks === wantHook) : parsed;
  const pick = matched[matched.length - 1] ?? parsed[parsed.length - 1];
  return pick ?? null;
}

async function resolveLongInitialize(
  publicClient: PublicClient,
  launch: LongLaunch,
  head: bigint,
): Promise<V4Init | null> {
  const around = launch.block > 0n ? launch.block : null;
  const windows: Array<{ from: bigint; to: bigint }> = [];
  if (around != null) {
    const to = around + 64n > head ? head : around + 64n;
    windows.push({ from: around, to });
    const from2 = around > 4_096n ? around - 4_096n : 1n;
    const to2 = around + 4_096n > head ? head : around + 4_096n;
    windows.push({ from: from2, to: to2 });
  } else {
    windows.push({ from: head > 80_000n ? head - 80_000n : 1n, to: head });
  }
  for (const w of windows) {
    const hit = await resolveV4Initialize(
      publicClient,
      launch.asset,
      launch.numeraire,
      launch.hook,
      w.from,
      w.to,
    );
    if (hit) return hit;
  }
  return null;
}

async function upsertLongLaunch(
  publicClient: PublicClient,
  launch: LongLaunch,
  registry: Map<string, string>,
  head: bigint,
): Promise<boolean> {
  const classified = classify({
    token0: launch.asset,
    token1: launch.numeraire,
    registry,
  });
  const pairQuality = poolPairQuality(classified.kind);
  const ticker = stockTickerFromClassify(classified);
  const [token0, token1] = sortedPair(launch.asset, launch.numeraire);
  const createdAt = launch.deployedAt
    ? new Date(launch.deployedAt * 1000)
    : new Date();

  await db().query(
    `INSERT INTO tokens(address, symbol, created_at, creator, launchpad, is_stock_token)
     VALUES ($1,$2,$3,$4,'long', false)
     ON CONFLICT (address) DO UPDATE SET
       creator=COALESCE(EXCLUDED.creator, tokens.creator),
       symbol=COALESCE(tokens.symbol, EXCLUDED.symbol),
       launchpad='long',
       created_at=COALESCE(tokens.created_at, EXCLUDED.created_at)`,
    [launch.asset, launch.ticker, createdAt, launch.launcher],
  );

  const init = await resolveLongInitialize(publicClient, launch, head);
  if (!init) {
    console.log(
      `long no Initialize asset=${launch.asset} hook=${launch.hook} block=${launch.block} quote=${launch.numeraire}`,
    );
    return false;
  }
  const poolId = init.id;
  const guessed = v4PoolId(
    launch.asset,
    launch.numeraire,
    LONG_V4_FEE,
    LONG_V4_TICK_SPACING,
    launch.hook,
  ).toLowerCase();
  if (guessed !== poolId) {
    console.log(`long poolId from Initialize ${poolId} (guessed ${guessed}) asset=${launch.asset}`);
  }

  const exists = await db().query(`SELECT 1 FROM pools WHERE address = $1 OR pool_id = $1`, [poolId]);
  await db().query(
    `INSERT INTO pools(address, dex, token0, token1, created_at, created_block, stock_ticker, meme_address, pair_quality, creator, pool_id, hooks, tick_spacing, fee_bps)
     VALUES ($1,'uniswap_v4',$2,$3,$4,$5,$6,$7,$8,$9,$1,$10,$11,$12)
     ON CONFLICT (address) DO UPDATE SET
       stock_ticker=COALESCE(EXCLUDED.stock_ticker, pools.stock_ticker),
       meme_address=COALESCE(pools.meme_address, EXCLUDED.meme_address),
       pair_quality=EXCLUDED.pair_quality,
       creator=COALESCE(EXCLUDED.creator, pools.creator),
       pool_id=EXCLUDED.pool_id,
       hooks=EXCLUDED.hooks,
       tick_spacing=EXCLUDED.tick_spacing,
       fee_bps=EXCLUDED.fee_bps,
       created_at=COALESCE(pools.created_at, EXCLUDED.created_at)`,
    [
      poolId,
      token0,
      token1,
      createdAt,
      launch.block.toString(),
      ticker,
      launch.asset,
      pairQuality,
      launch.launcher,
      init.hooks,
      init.tickSpacing,
      init.fee,
    ],
  );
  if (guessed !== poolId) {
    await db().query(
      `UPDATE pools SET pool_id=$1, hooks=$2, tick_spacing=$3, fee_bps=$4
       WHERE meme_address=$5 AND dex='uniswap_v4' AND (address=$6 OR pool_id=$6)`,
      [poolId, init.hooks, init.tickSpacing, init.fee, launch.asset, guessed],
    );
    await db().query(
      `UPDATE pools SET address=$1
       WHERE address=$2 AND meme_address=$3
         AND NOT EXISTS (SELECT 1 FROM pools x WHERE x.address=$1)`,
      [poolId, guessed, launch.asset],
    );
  }
  return exists.rows.length === 0;
}

async function fetchLongLaunchesExplorer(): Promise<LongLaunch[]> {
  const out: LongLaunch[] = [];
  let qs = "";
  for (let page = 0; page < 250; page++) {
    const url = `${EXPLORER}/api/v2/addresses/${LONG_FACTORY}/logs${qs}`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      await sleep(3000);
      page -= 1;
      continue;
    }
    if (res.status === 429 || res.status === 403 || res.status >= 500) {
      await sleep(res.status === 429 ? 4000 : 2000);
      page -= 1;
      continue;
    }
    if (!res.ok) {
      console.log(`long explorer http ${res.status}`);
      break;
    }
    const body = (await res.json()) as {
      items?: Array<{
        block_number: number;
        decoded?: {
          method_call?: string;
          parameters?: Array<{ name: string; value: unknown }>;
        };
      }>;
      next_page_params?: Record<string, string | number> | null;
    };
    for (const item of body.items ?? []) {
      if (!item.decoded?.method_call?.startsWith("LaunchCreated")) continue;
      const args: Record<string, unknown> = {};
      for (const p of item.decoded.parameters ?? []) args[p.name] = p.value;
      const row = parseLongLaunch({ ...args, block: BigInt(item.block_number) });
      if (row) out.push(row);
    }
    const next = body.next_page_params;
    if (!next) break;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) sp.set(k, String(v));
    qs = `?${sp.toString()}`;
  }
  return out;
}

const airlockAbi = parseAbi([
  "function getAssetData(address asset) view returns (address numeraire, address timelock, address governance, address liquidityMigrator, address poolInitializer, address pool)",
]);

const LONG_SEED_TOKENS = [
  "0x385f4f8ae47651ce5f58f5265395a669f8281e18",
  "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18",
];

async function hydrateLongFromAirlock(
  publicClient: PublicClient,
  asset: string,
  registry: Map<string, string>,
  head: bigint,
): Promise<boolean> {
  const hex = hexAddr(asset);
  try {
    const data = await publicClient.readContract({
      address: LONG_AIRLOCK as Address,
      abi: airlockAbi,
      functionName: "getAssetData",
      args: [hex as Address],
    });
    const numeraire = hexAddr(data[0]);
    const initializer = hexAddr(data[4]);
    const pool = hexAddr(data[5]);
    const hook = pool !== ZERO ? pool : initializer;
    if (numeraire === ZERO || hook === ZERO) return false;
    const launch: LongLaunch = {
      asset: hex,
      numeraire,
      hook,
      launcher: ZERO,
      ticker: null,
      block: 0n,
      deployedAt: null,
    };
    return upsertLongLaunch(publicClient, launch, registry, head);
  } catch {
    return false;
  }
}

async function indexLong(
  publicClient: PublicClient,
  fromBlockN: bigint,
  toBlock: bigint,
): Promise<number> {
  const { rows } = await db().query(`SELECT contract_hex, ticker FROM stock_tokens`);
  const registry = new Map(rows.map((r) => [r.contract_hex as string, r.ticker as string]));
  const saved = await lastBlock("long");
  let added = 0;

  if (saved == null) {
    const hist = await fetchLongLaunchesExplorer();
    console.log(`long explorer ${hist.length}`);
    for (const launch of hist) {
      if (await upsertLongLaunch(publicClient, launch, registry, toBlock)) added += 1;
    }
  }

  const logs = await getLogsRange(publicClient, {
    address: LONG_FACTORY as Address,
    event: launchCreated,
    fromBlock: fromBlockN,
    toBlock,
  });
  console.log(`long LaunchCreated ${logs.length} [${fromBlockN}..${toBlock}]`);
  for (const log of logs) {
    const args = log.args as {
      poolOrHook: Address;
      asset: Address;
      numeraire: Address;
      poolInitializer: Address;
      launcher: Address;
      normalizedTicker: string;
      deployedAt: number | bigint;
    };
    const launch = parseLongLaunch({ ...args, block: log.blockNumber });
    if (!launch) continue;
    if (await upsertLongLaunch(publicClient, launch, registry, toBlock)) added += 1;
  }

  for (const seed of LONG_SEED_TOKENS) {
    const have = await db().query(`SELECT 1 FROM tokens WHERE address = $1`, [seed]);
    if (have.rows[0]) continue;
    console.log(`long hydrate ${seed}`);
    if (await hydrateLongFromAirlock(publicClient, seed, registry, toBlock)) added += 1;
  }

  if (added) await fillMetadata(publicClient);
  await setState("long", toBlock);
  console.log(`long upserted new ${added}`);
  return added;
}

async function repairLongPoolIds(publicClient: PublicClient, head: bigint) {
  const { rows } = await db().query<{
    meme_address: string;
    token0: string;
    token1: string;
    hooks: string | null;
    pool_id: string | null;
    created_block: string | null;
  }>(`
    SELECT p.meme_address, p.token0, p.token1, p.hooks, p.pool_id, p.created_block::text
    FROM pools p
    INNER JOIN tokens t ON t.address = p.meme_address
    WHERE t.launchpad = 'long' AND p.meme_address IS NOT NULL
  `);
  const registry = new Map(
    (await db().query<{ contract_hex: string; ticker: string }>(`SELECT contract_hex, ticker FROM stock_tokens`)).rows.map(
      (r) => [r.contract_hex, r.ticker],
    ),
  );
  let n = 0;
  for (const r of rows) {
    const block = r.created_block && r.created_block !== "0" ? BigInt(r.created_block) : 0n;
    const launch: LongLaunch = {
      asset: r.meme_address,
      numeraire: hexAddr(r.token0) === hexAddr(r.meme_address) ? r.token1 : r.token0,
      hook: r.hooks ?? ZERO,
      launcher: ZERO,
      ticker: null,
      block,
      deployedAt: null,
    };
    if (await upsertLongLaunch(publicClient, launch, registry, head)) n += 1;
    else n += 1;
  }
  console.log(`long repair attempted ${rows.length}`);
}

async function backfillLong(publicClient: PublicClient) {
  const head = await publicClient.getBlockNumber();
  const lookback = indexerHistory();
  const sliceMs = Number(process.env.INDEXER_CATCHUP_MS ?? "180000");
  console.log(`long backfill start cursor=${await lastBlock("long")} head=${head}`);
  await repairLongPoolIds(publicClient, head);
  const deadline = Date.now() + Number(process.env.INDEXER_LONG_DEADLINE_MS ?? "600000");
  while (Date.now() < deadline) {
    const saved = await lastBlock("long");
    if (saved != null && saved >= head) break;
    await catchUp(
      "long",
      head,
      lookback,
      (from, to) => indexLong(publicClient, from, to),
      Math.min(sliceMs, 90_000),
    );
    const now = await lastBlock("long");
    console.log(`long cursor ${now} head=${head}`);
    if (now != null && now >= head) break;
  }
  const { rows: counts } = await db().query<{ n: string; canonical: string }>(`
    SELECT count(*)::text AS n,
           count(*) FILTER (WHERE pair_quality IN ('pair_canonical','canonical'))::text AS canonical
    FROM pools p
    INNER JOIN tokens t ON t.address = p.meme_address
    WHERE t.launchpad = 'long'
  `);
  console.log(`long pools ${counts[0]?.n ?? 0} canonical ${counts[0]?.canonical ?? 0}`);
}

function spotQuoteLabel(addr: string): "USDG" | "WETH" | "CBBTC" | null {
  const a = addr.toLowerCase();
  if (a === USDG) return "USDG";
  if (a === WETH || a === ZERO) return "WETH";
  if (a === CBBTC) return "CBBTC";
  return null;
}

async function indexSpot(publicClient: PublicClient, fromBlockN: bigint, toBlock: bigint) {
  const { rows } = await db().query<{ contract_hex: string; ticker: string }>(
    `SELECT contract_hex, ticker FROM stock_tokens WHERE is_active`,
  );
  const registry = new Map(rows.map((r) => [r.contract_hex, r.ticker]));
  const quotes = [USDG, WETH] as Address[];
  const seen = new Set<string>();
  let n = 0;

  for (const quote of quotes) {
    for (const side of ["currency0", "currency1"] as const) {
      const logs = await getLogsRange(publicClient, {
        address: UNI_V4_POOL_MANAGER as Address,
        event: v4Initialize,
        args: { [side]: getAddress(quote) },
        fromBlock: fromBlockN,
        toBlock,
      });
      for (const log of logs) {
        const args = log.args as {
          id: `0x${string}`;
          currency0: Address;
          currency1: Address;
          fee: number;
          tickSpacing: number;
          hooks: Address;
        };
        const c0 = hexAddr(args.currency0);
        const c1 = hexAddr(args.currency1);
        const t0 = registry.get(c0);
        const t1 = registry.get(c1);
        const q0 = spotQuoteLabel(c0);
        const q1 = spotQuoteLabel(c1);
        const ticker = t0 && q1 ? t0 : t1 && q0 ? t1 : null;
        if (!ticker) continue;
        const poolId = args.id.toLowerCase();
        if (seen.has(poolId)) continue;
        seen.add(poolId);
        const feeBps = Math.round(Number(args.fee) / 100);
        await db().query(
          `INSERT INTO pools(address, dex, token0, token1, fee_bps, created_block, stock_ticker, meme_address, pair_quality, pool_id, hooks, tick_spacing)
           VALUES ($1,'uniswap_v4',$2,$3,$4,$5,$6,null,'pair_spot_stock',$1,$7,$8)
           ON CONFLICT (address) DO UPDATE SET
             tick_spacing=COALESCE(EXCLUDED.tick_spacing, pools.tick_spacing),
             fee_bps=COALESCE(EXCLUDED.fee_bps, pools.fee_bps),
             hooks=COALESCE(EXCLUDED.hooks, pools.hooks)`,
          [poolId, c0, c1, feeBps, log.blockNumber.toString(), ticker, hexAddr(args.hooks), Number(args.tickSpacing)],
        );
        n++;
      }
    }
  }
  console.log(`v4 spot Initialize ${n} [${fromBlockN}..${toBlock}]`);
  await setState("v4_spot", toBlock);
  await setState("uniswap_v4", toBlock);
}

const SPOT_FEE_KEYS = [
  { fee: 100, tickSpacing: 1 },
  { fee: 500, tickSpacing: 10 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 10000, tickSpacing: 200 },
] as const;

async function discoverSpotPools(publicClient: PublicClient) {
  const { rows: stocks } = await db().query<{ ticker: string; contract_hex: string }>(
    `SELECT ticker, contract_hex FROM stock_tokens WHERE is_active`,
  );
  const existing = await db().query<{ pool_id: string }>(
    `SELECT pool_id FROM pools WHERE pool_id IS NOT NULL`,
  );
  const have = new Set(existing.rows.map((r) => r.pool_id));
  const jobs: Array<{
    ticker: string;
    poolId: `0x${string}`;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
  }> = [];
  for (const s of stocks) {
    for (const quote of [USDG, WETH]) {
      for (const key of SPOT_FEE_KEYS) {
        const poolId = v4PoolId(s.contract_hex, quote, key.fee, key.tickSpacing, ZERO);
        if (have.has(poolId)) continue;
        const [token0, token1] = sortedPair(s.contract_hex, quote);
        jobs.push({
          ticker: s.ticker,
          poolId,
          token0,
          token1,
          fee: key.fee,
          tickSpacing: key.tickSpacing,
        });
      }
    }
  }
  let n = 0;
  const chunk = 40;
  for (let i = 0; i < jobs.length; i += chunk) {
    const slice = jobs.slice(i, i + chunk);
    const result = await withRetry(() =>
      publicClient.multicall({
        contracts: slice.map((j) => ({
          address: UNI_V4_STATE_VIEW as Address,
          abi: stateViewAbi,
          functionName: "getSlot0" as const,
          args: [j.poolId],
        })),
        allowFailure: true,
      }),
    );
    for (let j = 0; j < slice.length; j++) {
      const r = result[j];
      if (r.status !== "success") continue;
      const sqrt = (r.result as readonly [bigint, number, number, number])[0];
      if (sqrt === 0n) continue;
      const job = slice[j];
      await db().query(
        `INSERT INTO pools(address, dex, token0, token1, fee_bps, stock_ticker, meme_address, pair_quality, pool_id, hooks, tick_spacing)
         VALUES ($1,'uniswap_v4',$2,$3,$4,$5,null,'pair_spot_stock',$1,$6,$7)
         ON CONFLICT (address) DO NOTHING`,
        [
          job.poolId,
          job.token0,
          job.token1,
          Math.round(job.fee / 100),
          job.ticker,
          ZERO,
          job.tickSpacing,
        ],
      );
      n++;
    }
  }
  console.log(`v4 spot probe ${n}/${jobs.length}`);
}

function quoteUsd(
  quote: string,
  raw: bigint,
  stockByHex: Map<string, { ticker: string; decimals: number }>,
  oracles: Map<string, number>,
  ethUsd: number | null,
): number | null {
  const a = quote.toLowerCase();
  if (raw === 0n) return 0;
  if (a === USDG) return Number(raw) / 1e6;
  if (a === WETH || a === ZERO) {
    if (ethUsd == null) return null;
    return (Number(raw) / 1e18) * ethUsd;
  }
  const stock = stockByHex.get(a);
  if (stock) {
    const px = oracles.get(stock.ticker);
    if (px == null) return null;
    return (Number(raw) / 10 ** stock.decimals) * px;
  }
  return null;
}

async function readOracles(publicClient: PublicClient) {
  const stocks = await db().query<{
    ticker: string;
    contract_hex: string;
    decimals: number;
    oracle_feed: string | null;
  }>(`SELECT ticker, contract_hex, decimals, oracle_feed FROM stock_tokens WHERE is_active`);
  const oracles = new Map<string, number>();
  for (const s of stocks.rows) {
    if (!s.oracle_feed) continue;
    try {
      const round = await publicClient.readContract({
        address: s.oracle_feed as Address,
        abi: feedAbi,
        functionName: "latestRoundData",
      });
      const dec = await publicClient.readContract({
        address: s.oracle_feed as Address,
        abi: feedAbi,
        functionName: "decimals",
      });
      const answer = round[1];
      if (answer > 0n) oracles.set(s.ticker, Number(answer) / 10 ** Number(dec));
    } catch {
      /* feed missing */
    }
  }
  let ethUsd: number | null = null;
  const ethFeed = process.env.ETH_USD_FEED;
  if (ethFeed) {
    try {
      const round = await publicClient.readContract({
        address: ethFeed as Address,
        abi: feedAbi,
        functionName: "latestRoundData",
      });
      const dec = await publicClient.readContract({
        address: ethFeed as Address,
        abi: feedAbi,
        functionName: "decimals",
      });
      if (round[1] > 0n) ethUsd = Number(round[1]) / 10 ** Number(dec);
    } catch {
      /* optional */
    }
  }

  try {
    const res = await fetch(PRICES_URL, {
      headers: { "user-agent": "float-indexer/1" },
    });
    if (!res.ok) console.log(`rh prices ${res.status}`);
    if (res.ok) {
      const body = (await res.json()) as {
        quotes?: Array<{ tokenSymbol?: string; bid?: string; ask?: string }>;
      };
      for (const q of body.quotes ?? []) {
        const ticker = (q.tokenSymbol ?? "").toUpperCase();
        if (!ticker || oracles.has(ticker)) continue;
        const bid = Number(q.bid);
        const ask = Number(q.ask);
        if (bid > 0 && ask > 0) oracles.set(ticker, (bid + ask) / 2);
        else if (bid > 0) oracles.set(ticker, bid);
      }
    }
  } catch {
    /* rh quotes optional */
  }

  return { stocks: stocks.rows, oracles, ethUsd };
}

async function insertSwap(
  poolDbId: string,
  tx: string,
  logIndex: number,
  block: bigint,
  takenAt: Date,
  usd: number,
): Promise<boolean> {
  if (!Number.isFinite(usd) || usd <= 0 || usd > 50_000_000) return false;
  const r = await db().query(
    `INSERT INTO swaps(tx_hash, log_index, pool_id, block_number, taken_at, usd_notional)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tx_hash, log_index) DO NOTHING
     RETURNING 1`,
    [tx, logIndex, poolDbId, block.toString(), takenAt, usd],
  );
  return (r.rowCount ?? 0) > 0;
}

function blockTime(blockNumber: bigint, head: bigint, headTs: Date) {
  return new Date(headTs.getTime() - Number(head - blockNumber) * 2000);
}

async function indexVolume(
  publicClient: PublicClient,
  fromBlockN: bigint,
  toBlock: bigint,
  oracles: Map<string, number>,
  ethUsd: number | null,
  stockByHex: Map<string, { ticker: string; decimals: number }>,
) {
  if (fromBlockN > toBlock) {
    await setState("volume", toBlock);
    return;
  }

  const headBlock = await withRetry(() => publicClient.getBlock({ blockNumber: toBlock }));
  const headTs = new Date(Number(headBlock.timestamp) * 1000);

  const curves = await db().query<{
    id: string;
    address: string;
    token1: string;
  }>(
    `SELECT id, address, token1 FROM pools
     WHERE dex = 'pons_curve' AND meme_address IS NOT NULL AND stock_ticker IS NOT NULL`,
  );
  const curveByAddr = new Map(curves.rows.map((r) => [r.address, r]));
  let curveN = 0;
  for (const event of [curveBuy, curveSell]) {
    const logs = await getLogsRange(publicClient, {
      event,
      fromBlock: fromBlockN,
      toBlock,
    });
    for (const log of logs) {
      const pool = curveByAddr.get(hexAddr(log.address));
      if (!pool) continue;
      const args = log.args as { quoteIn?: bigint; quoteOut?: bigint };
      const raw = args.quoteIn ?? args.quoteOut ?? 0n;
      const usd = quoteUsd(pool.token1, raw, stockByHex, oracles, ethUsd);
      if (usd == null) continue;
      await insertSwap(
        pool.id,
        log.transactionHash ?? "0x",
        log.logIndex ?? 0,
        log.blockNumber,
        blockTime(log.blockNumber, toBlock, headTs),
        usd,
      );
      curveN++;
    }
  }
  console.log(`curve trades ${curveN}`);

  const v4pools = await db().query<{
    id: string;
    pool_id: string;
    token0: string;
    token1: string;
  }>(`SELECT id, pool_id, token0, token1 FROM pools
     WHERE pool_id IS NOT NULL AND stock_ticker IS NOT NULL`);
  const v4ById = new Map(v4pools.rows.map((p) => [p.pool_id.toLowerCase(), p]));
  let swapN = 0;
  const poolIds = [...v4ById.keys()] as `0x${string}`[];
  for (const batch of chunkArr(poolIds, 40)) {
    const logs = await getLogsRange(publicClient, {
      address: UNI_V4_POOL_MANAGER as Address,
      event: v4Swap,
      args: { id: batch },
      fromBlock: fromBlockN,
      toBlock,
    });
    for (const log of logs) {
      const args = log.args as { id?: `0x${string}`; amount0: bigint; amount1: bigint };
      const p = v4ById.get((args.id ?? "").toLowerCase());
      if (!p) continue;
      const a0 = args.amount0 < 0n ? -args.amount0 : args.amount0;
      const a1 = args.amount1 < 0n ? -args.amount1 : args.amount1;
      const usd0 = quoteUsd(p.token0, a0, stockByHex, oracles, ethUsd);
      const usd1 = quoteUsd(p.token1, a1, stockByHex, oracles, ethUsd);
      const usd = usd0 ?? usd1 ?? 0;
      await insertSwap(
        p.id,
        log.transactionHash ?? "0x",
        log.logIndex ?? 0,
        log.blockNumber,
        blockTime(log.blockNumber, toBlock, headTs),
        usd,
      );
      swapN++;
    }
  }
  console.log(`v4 swaps ${swapN} pools=${v4ById.size} [${fromBlockN}..${toBlock}]`);
  await setState("volume", toBlock);
}

async function snapshot(publicClient: PublicClient) {
  const head = await publicClient.getBlockNumber();
  const block = await publicClient.getBlock({ blockNumber: head });
  const takenAt = new Date(Number(block.timestamp) * 1000);
  const { stocks, oracles, ethUsd } = await readOracles(publicClient);

  const supplies = new Map<string, bigint>();
  for (let i = 0; i < stocks.length; i += 80) {
    const slice = stocks.slice(i, i + 80);
    const result = await publicClient.multicall({
      contracts: slice.map((s) => ({
        address: s.contract_hex as Address,
        abi: erc20Abi,
        functionName: "totalSupply" as const,
      })),
      allowFailure: true,
    });
    slice.forEach((s, j) => {
      const r = result[j];
      supplies.set(s.ticker, r.status === "success" ? (r.result as bigint) : 0n);
    });
  }

  const pools = await db().query<{
    id: string;
    address: string;
    dex: string;
    stock_ticker: string | null;
    meme_address: string | null;
    pair_quality: string;
    token0: string;
    token1: string;
    pool_id: string | null;
    tick_spacing: number | null;
    hooks: string | null;
  }>(
    `SELECT id, address, dex, stock_ticker, meme_address, pair_quality, token0, token1, pool_id, tick_spacing, hooks FROM pools`,
  );

  const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));
  const stockByHex = new Map(stocks.map((s) => [s.contract_hex.toLowerCase(), s]));
  const withStock = pools.rows.filter((p) => p.stock_ticker && stockByTicker.has(p.stock_ticker));
  const memeExtra = pools.rows.filter(
    (p) => p.meme_address && (!p.stock_ticker || !stockByTicker.has(p.stock_ticker)),
  );

  const v4Ids = [
    ...new Set(
      [...withStock, ...memeExtra]
        .map((p) => p.pool_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const v4 = await readV4States(publicClient, v4Ids);

  for (const p of withStock) {
    if (!p.pool_id || !v4.has(p.pool_id.toLowerCase())) continue;
    await db().query(
      `UPDATE pools SET tick_spacing=COALESCE(tick_spacing,$2), hooks=COALESCE(hooks,$3) WHERE id=$1`,
      [p.id, p.tick_spacing ?? PONS_V4_TICK_SPACING, p.hooks ?? PONS_V2_HOOK],
    );
  }

  const curveBal = new Map<string, bigint>();
  const curvePools = withStock.filter((p) => p.dex === "pons_curve");
  for (let i = 0; i < curvePools.length; i += 80) {
    const slice = curvePools.slice(i, i + 80);
    const result = await publicClient.multicall({
      contracts: slice.map((p) => ({
        address: stockByTicker.get(p.stock_ticker!)!.contract_hex as Address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [p.address as Address],
      })),
      allowFailure: true,
    });
    for (let j = 0; j < slice.length; j++) {
      const bal = result[j].status === "success" ? (result[j].result as bigint) : 0n;
      curveBal.set(slice[j].id, bal);
    }
  }

  const vols = await db().query<{
    pool_id: string;
    v1h: string | null;
    v24h: string | null;
  }>(`
    SELECT pool_id::text,
           sum(usd_notional) FILTER (WHERE taken_at > now() - interval '1 hour') AS v1h,
           sum(usd_notional) FILTER (WHERE taken_at > now() - interval '24 hours') AS v24h
    FROM swaps
    GROUP BY pool_id
  `);
  const volByPool = new Map(vols.rows.map((r) => [r.pool_id, r]));

  const prevSnapQ = await db().query<{ pool_id: string; stock_bal_raw: string | null; volume_usd_24h: string | null }>(`
    SELECT DISTINCT ON (pool_id) pool_id::text, stock_bal_raw, volume_usd_24h
    FROM pool_snapshots
    ORDER BY pool_id, block_number DESC
  `);
  const prevSnap = new Map(prevSnapQ.rows.map((r) => [r.pool_id, r]));

  const locked = new Map<string, bigint>();
  const pairCount = new Map<string, number>();
  const dexPrice = new Map<string, { usd: number; depth: bigint }>();
  const memeVol = new Map<string, number>();
  const spotVol = new Map<string, number>();

  for (const p of withStock) {
    const stock = stockByTicker.get(p.stock_ticker!)!;
    const stockHex = stock.contract_hex;
    let bal = curveBal.get(p.id) ?? 0n;
    const state = p.pool_id ? v4.get(p.pool_id.toLowerCase()) : undefined;
    const spacing = p.tick_spacing ?? PONS_V4_TICK_SPACING;
    if (state && state.liq > 0n) {
      bal += v4WantAmount(p.token0, p.token1, stockHex, state.sqrt, state.liq, spacing);
    } else if (p.dex === "uniswap_v4" && p.pool_id) {
      const prev = prevSnap.get(p.id)?.stock_bal_raw;
      if (prev && prev !== "0") bal = BigInt(prev);
    }
    const v = volByPool.get(p.id);
    const v1h = Number(v?.v1h ?? 0);
    let v24h = Number(v?.v24h ?? 0);
    if (!v24h) v24h = Number(prevSnap.get(p.id)?.volume_usd_24h ?? 0);
    let memeBal: bigint | null = null;
    if (p.meme_address && state && state.liq > 0n) {
      memeBal = v4WantAmount(
        p.token0,
        p.token1,
        p.meme_address,
        state.sqrt,
        state.liq,
        spacing,
      );
    }
    await db().query(
      `INSERT INTO pool_snapshots(pool_id, block_number, taken_at, stock_bal_raw, meme_bal_raw, volume_usd_1h, volume_usd_24h, price_meme_usdg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (pool_id, block_number) DO UPDATE SET
         stock_bal_raw=EXCLUDED.stock_bal_raw, meme_bal_raw=EXCLUDED.meme_bal_raw, taken_at=EXCLUDED.taken_at,
         volume_usd_1h=EXCLUDED.volume_usd_1h, volume_usd_24h=EXCLUDED.volume_usd_24h,
         price_meme_usdg=COALESCE(EXCLUDED.price_meme_usdg, pool_snapshots.price_meme_usdg)`,
      [p.id, head.toString(), takenAt, bal.toString(), memeBal?.toString() ?? null, v1h, v24h, null],
    );

    const isMemeCanonical =
      (p.pair_quality === "pair_canonical" || p.pair_quality === "canonical") &&
      p.meme_address &&
      !isSpotQuote(p.token1);
    if (isMemeCanonical && p.stock_ticker) {
      locked.set(p.stock_ticker, (locked.get(p.stock_ticker) ?? 0n) + bal);
      pairCount.set(p.stock_ticker, (pairCount.get(p.stock_ticker) ?? 0) + 1);
      memeVol.set(p.stock_ticker, (memeVol.get(p.stock_ticker) ?? 0) + v24h);
    }
    const isSpot =
      p.pair_quality === "pair_spot_stock" ||
      (!p.meme_address && p.pair_quality === "canonical" && p.stock_ticker);
    if (isSpot && p.stock_ticker) {
      const ticker = p.stock_ticker;
      spotVol.set(ticker, (spotVol.get(ticker) ?? 0) + v24h);
      if (state) {
        const [c0, c1] = sortedPair(p.token0, p.token1);
        const dec0 = c0 === USDG ? 6 : 18;
        const dec1 = c1 === USDG ? 6 : 18;
        let px = priceToken1PerToken0(state.sqrt, dec0, dec1);
        const stockIs1 = c1 === stockHex;
        if (stockIs1) px = px === 0 ? 0 : 1 / px;
        const quote = stockIs1 ? c0 : c1;
        if (quote === WETH || quote === ZERO) {
          if (ethUsd) px *= ethUsd;
          else px = 0;
        }
        if (px > 0) {
          const prev = dexPrice.get(ticker);
          if (!prev || bal > prev.depth) dexPrice.set(ticker, { usd: px, depth: bal });
        }
      }
    }
  }

  function memePx(
    p: (typeof pools.rows)[0],
    state: V4State,
  ): number | null {
    if (!p.meme_address) return null;
    const quote = otherToken(p.token0, p.token1, p.meme_address);
    const stock = stockByHex.get(quote);
    const quoteUsd = quoteUsdRate({
      quote,
      ethUsd,
      stockDexUsdg: stock
        ? (dexPrice.get(stock.ticker)?.usd ?? null)
        : p.stock_ticker
          ? (dexPrice.get(p.stock_ticker)?.usd ?? null)
          : null,
    });
    return memePriceUsdg({
      token0: p.token0,
      token1: p.token1,
      meme: p.meme_address,
      sqrt: state.sqrt,
      dec0: tokenDecimals(p.token0),
      dec1: tokenDecimals(p.token1),
      quoteUsd,
    });
  }

  for (const p of withStock) {
    if (!p.meme_address || !p.pool_id) continue;
    const state = v4.get(p.pool_id.toLowerCase());
    if (!state) continue;
    const priceUsdg = memePx(p, state);
    if (priceUsdg == null) continue;
    await db().query(
      `UPDATE pool_snapshots SET price_meme_usdg=$1 WHERE pool_id=$2 AND block_number=$3`,
      [priceUsdg, p.id, head.toString()],
    );
  }

  for (const p of memeExtra) {
    const state = p.pool_id ? v4.get(p.pool_id.toLowerCase()) : undefined;
    const v = volByPool.get(p.id);
    const v1h = Number(v?.v1h ?? 0);
    let v24h = Number(v?.v24h ?? 0);
    if (!v24h) v24h = Number(prevSnap.get(p.id)?.volume_usd_24h ?? 0);
    let memeBal: bigint | null = null;
    if (p.meme_address && state && state.liq > 0n) {
      memeBal = v4WantAmount(
        p.token0,
        p.token1,
        p.meme_address,
        state.sqrt,
        state.liq,
        p.tick_spacing ?? PONS_V4_TICK_SPACING,
      );
    }
    const priceUsdg = state && p.meme_address ? memePx(p, state) : null;
    await db().query(
      `INSERT INTO pool_snapshots(pool_id, block_number, taken_at, stock_bal_raw, meme_bal_raw, volume_usd_1h, volume_usd_24h, price_meme_usdg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (pool_id, block_number) DO UPDATE SET
         stock_bal_raw=EXCLUDED.stock_bal_raw, meme_bal_raw=EXCLUDED.meme_bal_raw, taken_at=EXCLUDED.taken_at,
         volume_usd_1h=EXCLUDED.volume_usd_1h, volume_usd_24h=EXCLUDED.volume_usd_24h,
         price_meme_usdg=EXCLUDED.price_meme_usdg`,
      [p.id, head.toString(), takenAt, "0", memeBal?.toString() ?? null, v1h, v24h, priceUsdg],
    );
  }

  for (const s of stocks) {
    const supply = supplies.get(s.ticker) ?? 0n;
    const lock = locked.get(s.ticker) ?? 0n;
    const pct = supply > 0n ? Number(lock) / Number(supply) : 0;
    const oracle = oracles.get(s.ticker) ?? null;
    const dex = dexPrice.get(s.ticker)?.usd ?? null;
    const premium =
      oracle && dex && oracle > 0 ? Math.round(((dex - oracle) / oracle) * 10_000) : null;
    await db().query(
      `INSERT INTO stock_snapshots(
         ticker, block_number, taken_at, total_supply_raw, dex_price_usd, oracle_price_usd,
         premium_bps, float_locked_raw, float_locked_pct, meme_pair_count, meme_vol_24h_usd, spot_vol_24h_usd
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (ticker, block_number) DO UPDATE SET
         total_supply_raw=EXCLUDED.total_supply_raw,
         dex_price_usd=EXCLUDED.dex_price_usd,
         oracle_price_usd=EXCLUDED.oracle_price_usd,
         premium_bps=EXCLUDED.premium_bps,
         float_locked_raw=EXCLUDED.float_locked_raw,
         float_locked_pct=EXCLUDED.float_locked_pct,
         meme_pair_count=EXCLUDED.meme_pair_count,
         meme_vol_24h_usd=EXCLUDED.meme_vol_24h_usd,
         spot_vol_24h_usd=EXCLUDED.spot_vol_24h_usd,
         taken_at=EXCLUDED.taken_at`,
      [
        s.ticker,
        head.toString(),
        takenAt,
        supply.toString(),
        dex,
        oracle,
        premium,
        lock.toString(),
        pct,
        pairCount.get(s.ticker) ?? 0,
        memeVol.get(s.ticker) ?? 0,
        spotVol.get(s.ticker) ?? 0,
      ],
    );
  }

  await setState("head", head, takenAt);
  console.log(
    `snapshot block ${head} stocks ${stocks.length} locked tickers ${locked.size} v4live ${v4.size}`,
  );
}

async function riskPass(publicClient: PublicClient) {
  const { rows } = await db().query<{
    address: string;
    creator: string | null;
    pair_quality: string | null;
  }>(`
    SELECT t.address, t.creator, p.pair_quality
    FROM tokens t
    LEFT JOIN pools p ON p.meme_address = t.address
    WHERE t.is_stock_token = false
  `);
  const creatorCount = new Map<string, number>();
  for (const r of rows) {
    if (!r.creator) continue;
    creatorCount.set(r.creator, (creatorCount.get(r.creator) ?? 0) + 1);
  }
  for (let i = 0; i < rows.length; i += 80) {
    const slice = rows.slice(i, i + 80);
    const owners = await publicClient.multicall({
      contracts: slice.map((r) => ({
        address: r.address as Address,
        abi: erc20Abi,
        functionName: "owner" as const,
      })),
      allowFailure: true,
    });
    for (let j = 0; j < slice.length; j++) {
      const r = slice[j];
      let owner: string | null = null;
      let ownerRenounced: boolean | null = null;
      const o = owners[j];
      if (o.status === "success") {
        owner = String(o.result).toLowerCase();
        ownerRenounced = owner === "0x0000000000000000000000000000000000000000";
      }
      const reasons: Array<{ code: string; severity: string; text: string }> = [];
      if (r.pair_quality === "pair_fake_underlying" || r.pair_quality === "fake_underlying") {
        reasons.push({
          code: "FAKE_UNDERLYING",
          severity: "danger",
          text: "Quote is not an official Stock Token",
        });
      }
      if (ownerRenounced === false) {
        reasons.push({
          code: "OWNER_ACTIVE",
          severity: "caution",
          text: "Owner can still change parameters",
        });
      }
      const grade =
        r.pair_quality === "pair_fake_underlying" || r.pair_quality === "fake_underlying"
          ? "danger"
          : ownerRenounced === false
            ? "caution"
            : "clear";
      await db().query(
        `INSERT INTO token_risk(address, checked_at, owner, owner_renounced, creator_launch_count, grade, reasons)
         VALUES ($1, now(), $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (address) DO UPDATE SET
           checked_at=now(), owner=EXCLUDED.owner, owner_renounced=EXCLUDED.owner_renounced,
           creator_launch_count=EXCLUDED.creator_launch_count, grade=EXCLUDED.grade, reasons=EXCLUDED.reasons`,
        [
          r.address,
          owner,
          ownerRenounced,
          r.creator ? creatorCount.get(r.creator) ?? 1 : null,
          grade,
          JSON.stringify(reasons),
        ],
      );
    }
  }
}

async function tick(publicClient: PublicClient) {
  const head = await publicClient.getBlockNumber();
  const lookback = BigInt(process.env.INDEXER_LOOKBACK_BLOCKS ?? "40000");
  const chunk = indexerChunk();
  const history = indexerHistory();
  const catchMs = Number(process.env.INDEXER_CATCHUP_MS ?? "90000");

  await onceResetPonsInferredPoolIds();
  await hydratePonsSeeds(publicClient, head);

  const { stocks, oracles, ethUsd } = await withRetry(() => readOracles(publicClient));
  const stockByHex = new Map(
    stocks.map((s) => [s.contract_hex, { ticker: s.ticker, decimals: s.decimals }]),
  );
  const runVolume = (from: bigint, to: bigint) =>
    indexVolume(publicClient, from, to, oracles, ethUsd, stockByHex);

  const ponsSaved = await lastBlock("pons");
  const volSaved = await lastBlock("volume");
  if (volSaved != null && head > volSaved && head - volSaved > volumeWindowBlocks()) {
    console.log(
      `skip sequential volume saved=${volSaved} head=${head} lag=${head - volSaved} (use --vol24h)`,
    );
  } else if (ponsSaved != null && (volSaved == null || volSaved < ponsSaved)) {
    await catchUp("volume", ponsSaved, lookback, runVolume, catchMs);
  }

  const livePons = nextWindow(await lastBlock("pons"), head, lookback, chunk);
  const volNow = (await lastBlock("volume")) ?? 0n;
  if (livePons && volNow + chunk >= livePons.from) {
    console.log(`index pons ${livePons.from} -> ${livePons.to}`);
    await indexPons(publicClient, livePons.from, livePons.to, "pons");
    const volFrom = fromBlock(await lastBlock("volume"), livePons.to, lookback);
    if (volFrom <= livePons.to) {
      await runVolume(volFrom, livePons.to);
    }
  }

  const liveLong = nextWindow(await lastBlock("long"), head, lookback, chunk);
  if (liveLong) {
    console.log(`index long ${liveLong.from} -> ${liveLong.to}`);
    await indexLong(publicClient, liveLong.from, liveLong.to);
  }

  const liveSpot = nextWindow(await lastBlock("v4_spot"), head, lookback, chunk);
  if (liveSpot) {
    console.log(`index v4 spot ${liveSpot.from} -> ${liveSpot.to}`);
    await indexSpot(publicClient, liveSpot.from, liveSpot.to);
  }

  await catchUp(
    "pons_grad",
    head,
    history,
    async (from, to) => {
      await indexPonsGraduation(publicClient, from, to);
      await setState("pons_grad", to);
    },
    Math.min(catchMs, 60_000),
  );

  await catchUp(
    "pons_history",
    head,
    history,
    (from, to) => indexPons(publicClient, from, to, "pons_history"),
    Math.min(catchMs, 60_000),
  );

  const ponsFront = (await lastBlock("pons")) ?? 0n;
  const histFront = (await lastBlock("pons_history")) ?? 0n;
  const volCap = ponsFront > histFront ? ponsFront : histFront;
  const volAtEnd = (await lastBlock("volume")) ?? 0n;
  if (volCap > 0n && !(head > volAtEnd && head - volAtEnd > volumeWindowBlocks())) {
    await catchUp("volume", volCap > head ? head : volCap, lookback, runVolume, catchMs);
  }

  await withRetry(() => snapshot(publicClient));
}

async function getLogsTryWide(
  publicClient: PublicClient,
  params: {
    address: Address;
    event: ReturnType<typeof parseAbiItem>;
    args?: Record<string, unknown>;
    fromBlock: bigint;
    toBlock: bigint;
  },
): Promise<DecodedLog[]> {
  try {
    const logs = await withRetry(() =>
      publicClient.getLogs({
        address: params.address,
        event: params.event,
        ...(params.args ? { args: params.args } : {}),
        fromBlock: params.fromBlock,
        toBlock: params.toBlock,
      } as Parameters<PublicClient["getLogs"]>[0]),
    );
    return logs.map((log) => decoded(log)).filter((d): d is DecodedLog => d != null);
  } catch {
    return getLogsRange(publicClient, params);
  }
}

async function hydrateTokenGraduation(
  publicClient: PublicClient,
  token: Address,
  fromBlockN: bigint,
  toBlock: bigint,
) {
  const launched = await readLaunchedToken(publicClient, token);
  console.log(
    `  getLaunchedToken ${hexAddr(token)} ${launched ? `phase=${launched.phase} poolId=${launched.poolId}` : "read-failed"}`,
  );
  if (launched && launched.phase >= 1) {
    await setPonsGraduated({
      token,
      poolId: launched.poolId,
      source: `getLaunchedToken phase=${launched.phase}`,
      tx: null,
    });
  }
  if (launched?.poolId) return null;
  if (launched && launched.phase === 0) return null;

  const swept = await getLogsTryWide(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: launchSwept,
    args: { token },
    fromBlock: fromBlockN,
    toBlock,
  });
  const graduated = await getLogsTryWide(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: poolGraduated,
    args: { token },
    fromBlock: fromBlockN,
    toBlock,
  });
  const txs = [...swept, ...graduated]
    .map((l) => l.transactionHash)
    .filter((h): h is `0x${string}` => Boolean(h));
  for (const tx of [...new Set(txs)]) {
    const poolId = await resolvePonsV4PoolId(publicClient, token, tx);
    if (poolId) {
      await setPonsGraduated({
        token,
        poolId,
        source: "receipt PoolRegistered/Initialize",
        tx,
      });
    } else if (swept.length || graduated.length) {
      await setPonsGraduated({
        token,
        poolId: null,
        source: graduated.length ? "PoolGraduated" : "LaunchSwept",
        tx,
      });
    }
  }

  const after = await db().query<{ pool_id: string | null; graduated: boolean }>(
    `SELECT pool_id, graduated FROM pools WHERE dex='pons_curve' AND meme_address=$1 LIMIT 1`,
    [hexAddr(token)],
  );
  if (after.rows[0]?.pool_id) return null;
  if (!after.rows[0]?.graduated && !swept.length && !graduated.length) return null;
  const namesByTx: Record<string, string[]> = {};
  for (const tx of [...new Set(txs)]) {
    const receipt = await withRetry(() => publicClient.getTransactionReceipt({ hash: tx }));
    namesByTx[tx] = decodeLogEventNames(receipt.logs);
  }
  return Object.keys(namesByTx).length ? namesByTx : null;
}

async function ingestTokenLaunched(
  publicClient: PublicClient,
  token: Address,
  registry: Map<string, string>,
  fromBlockN: bigint,
  toBlock: bigint,
) {
  const launched = await getLogsTryWide(publicClient, {
    address: PONS_V2_FACTORY as Address,
    event: tokenLaunched,
    args: { token },
    fromBlock: fromBlockN,
    toBlock,
  });
  for (const log of launched) {
    const args = log.args as {
      token: Address;
      curve: Address;
      deployer: Address;
      pairToken: Address;
    };
    await upsertMeme({
      token: args.token,
      curve: args.curve,
      creator: args.deployer,
      pair: args.pairToken,
      block: log.blockNumber,
      timestamp: new Date(),
      registry,
    });
  }
  if (launched.length) await fillMetadata(publicClient, [hexAddr(token)]);
  return launched.length;
}

async function reportPonsV2(publicClient: PublicClient) {
  await onceResetPonsInferredPoolIds();
  const head = await publicClient.getBlockNumber();
  const { rows: registryRows } = await db().query<{ ticker: string; contract_hex: string }>(
    `SELECT ticker, contract_hex FROM stock_tokens`,
  );
  const registry = new Map(registryRows.map((s) => [s.contract_hex, s.ticker]));
  for (const seed of PONS_SEED_TOKENS) {
    const n = await ingestTokenLaunched(publicClient, seed as Address, registry, 1n, head);
    console.log(`report ingest seed ${seed} TokenLaunched=${n}`);
  }
  const { rows } = await db().query<{
    meme_address: string;
    token1: string;
    ticker: string;
    created_block: string | null;
    pool_id: string | null;
    graduated: boolean;
    symbol: string | null;
  }>(`
    SELECT p.meme_address, p.token1, st.ticker, p.created_block::text, p.pool_id, p.graduated, t.symbol
    FROM pools p
    INNER JOIN stock_tokens st ON st.contract_hex = p.token1
    LEFT JOIN tokens t ON t.address = p.meme_address
    WHERE p.dex = 'pons_curve'
    ORDER BY CASE WHEN p.meme_address = ANY($1::text[]) THEN 0 ELSE 1 END,
             p.created_at DESC NULLS LAST
    LIMIT 10
  `, [PONS_SEED_TOKENS]);
  console.log(`report TokenLaunched pairToken in stock_tokens n=${rows.length} head=${head}`);
  const decoded: Record<string, Record<string, string[]>> = {};
  for (const r of rows) {
    const from = r.created_block ? BigInt(r.created_block) : (head > 200_000n ? head - 200_000n : 1n);
    console.log(`report hydrate ${r.symbol ?? "?"} ${r.meme_address} ${r.ticker}`);
    const names = await hydrateTokenGraduation(publicClient, r.meme_address as Address, from, head);
    if (names) decoded[r.meme_address] = names;
  }

  const { stocks, oracles, ethUsd } = await withRetry(() => readOracles(publicClient));
  const stockByHex = new Map(
    stocks.map((s) => [s.contract_hex, { ticker: s.ticker, decimals: s.decimals }]),
  );
  const volFrom = head > 50_000n ? head - 50_000n : 1n;
  const v4 = await db().query<{
    id: string;
    pool_id: string;
    token0: string;
    token1: string;
  }>(
    `SELECT id, pool_id, token0, token1 FROM pools
     WHERE dex='pons_curve' AND pool_id IS NOT NULL AND meme_address = ANY($1::text[])`,
    [rows.map((r) => r.meme_address)],
  );
  const headBlock = await withRetry(() => publicClient.getBlock({ blockNumber: head }));
  const headTs = new Date(Number(headBlock.timestamp) * 1000);
  for (const p of v4.rows) {
    const logs = await getLogsTryWide(publicClient, {
      address: UNI_V4_POOL_MANAGER as Address,
      event: v4Swap,
      args: { id: p.pool_id as `0x${string}` },
      fromBlock: volFrom,
      toBlock: head,
    });
    let n = 0;
    for (const log of logs) {
      const args = log.args as { amount0: bigint; amount1: bigint };
      const a0 = args.amount0 < 0n ? -args.amount0 : args.amount0;
      const a1 = args.amount1 < 0n ? -args.amount1 : args.amount1;
      const usd = quoteUsd(p.token0, a0, stockByHex, oracles, ethUsd)
        ?? quoteUsd(p.token1, a1, stockByHex, oracles, ethUsd)
        ?? 0;
      await insertSwap(
        p.id,
        log.transactionHash ?? "0x",
        log.logIndex ?? 0,
        log.blockNumber,
        blockTime(log.blockNumber, head, headTs),
        usd,
      );
      n++;
    }
    console.log(`report v4 Swap backfill ${p.pool_id} n=${n}`);
  }

  const { rows: out } = await db().query<{
    meme_address: string;
    token1: string;
    ticker: string;
    pool_id: string | null;
    graduated: boolean;
    symbol: string | null;
    vol24h: string | null;
  }>(`
    SELECT p.meme_address, p.token1, st.ticker, p.pool_id, p.graduated, t.symbol,
           coalesce((
             SELECT sum(s.usd_notional)::text FROM swaps s
             WHERE s.pool_id = p.id AND s.taken_at > now() - interval '24 hours'
           ), '0') AS vol24h
    FROM pools p
    INNER JOIN stock_tokens st ON st.contract_hex = p.token1
    LEFT JOIN tokens t ON t.address = p.meme_address
    WHERE p.dex = 'pons_curve' AND p.meme_address = ANY($1::text[])
    ORDER BY array_position($1::text[], p.meme_address)
  `, [rows.map((r) => r.meme_address)]);
  console.log(JSON.stringify(out, null, 2));
  for (const [token, txs] of Object.entries(decoded)) {
    console.log(`decoded events for swept/graduated with null pool_id token=${token}`);
    console.log(JSON.stringify(txs, null, 2));
  }
}

async function blocksAgo24h(publicClient: PublicClient, head: bigint, headTs: bigint): Promise<bigint> {
  const seconds = 24 * 60 * 60;
  const guess = head > 43_200n ? head - 43_200n : 1n;
  try {
    const b = await withRetry(() => publicClient.getBlock({ blockNumber: guess }));
    const want = Number(headTs) - seconds;
    const have = Number(b.timestamp);
    const adj = BigInt(Math.round((want - have) / 2));
    const from = guess + adj;
    if (from < 1n) return 1n;
    if (from > head) return head;
    return from;
  } catch {
    return guess;
  }
}

async function backfillVol24h(publicClient: PublicClient) {
  const head = await publicClient.getBlockNumber();
  const headBlock = await withRetry(() => publicClient.getBlock({ blockNumber: head }));
  const headTs = new Date(Number(headBlock.timestamp) * 1000);
  const volBefore = await lastBlock("volume");
  const pons = (await lastBlock("pons")) ?? (await lastBlock("pons_history"));
  const lagBefore = volBefore == null ? null : head - volBefore;
  console.log(
    JSON.stringify({
      lag_before: lagBefore?.toString() ?? null,
      volume_cursor: volBefore?.toString() ?? null,
      pons_cursor: pons?.toString() ?? null,
      head: head.toString(),
    }),
  );

  const missing = await db().query<{
    symbol: string | null;
    meme_address: string;
    stock_ticker: string | null;
  }>(`
    SELECT t.symbol, p.meme_address, p.stock_ticker
    FROM pools p
    LEFT JOIN tokens t ON t.address = p.meme_address
    WHERE p.graduated
      AND (p.pool_id IS NULL OR p.pool_id !~ '^0x[0-9a-fA-F]{64}$')
    ORDER BY t.symbol NULLS LAST
  `);
  for (const r of missing.rows) {
    console.log(
      `graduated without pool_id ticker=${r.symbol ?? "?"} meme=${r.meme_address} stock=${r.stock_ticker ?? ""}`,
    );
  }
  if (!missing.rows.length) console.log("graduated without pool_id: none");

  const canonicalOnly = process.env.INDEXER_VOL24H_CANONICAL === "1";
  const { rows: pools } = await db().query<{
    id: string;
    pool_id: string;
    token0: string;
    token1: string;
    meme_address: string | null;
    stock_ticker: string | null;
    symbol: string | null;
  }>(`
    SELECT p.id, p.pool_id, p.token0, p.token1, p.meme_address, p.stock_ticker, t.symbol
    FROM pools p
    LEFT JOIN tokens t ON t.address = p.meme_address
    WHERE p.pool_id ~ '^0x[0-9a-fA-F]{64}$'
      AND ${
        canonicalOnly
          ? "p.pair_quality IN ('pair_canonical', 'canonical') AND p.meme_address IS NOT NULL"
          : "(p.graduated OR p.meme_address IS NOT NULL)"
      }
  `);
  const v4ById = new Map<string, (typeof pools)[number]>();
  for (const p of pools) v4ById.set(p.pool_id.toLowerCase(), p);
  const poolIds = [...v4ById.keys()] as `0x${string}`[];
  console.log(`pool_ids queried=${poolIds.length}`);

  const fromBlockN = await blocksAgo24h(publicClient, head, headBlock.timestamp);
  console.log(`vol24h Swap window ${fromBlockN} -> ${head}`);

  const { stocks, oracles, ethUsd } = await withRetry(() => readOracles(publicClient));
  const stockByHex = new Map(
    stocks.map((s) => [s.contract_hex, { ticker: s.ticker, decimals: s.decimals }]),
  );

  let logsSeen = 0;
  let written = 0;
  for (const batch of chunkArr(poolIds, 20)) {
    const logs = await getLogsRange(publicClient, {
      address: UNI_V4_POOL_MANAGER as Address,
      event: v4Swap,
      args: { id: batch },
      fromBlock: fromBlockN,
      toBlock: head,
    });
    for (const log of logs) {
      logsSeen++;
      const args = log.args as { id?: `0x${string}`; amount0: bigint; amount1: bigint };
      const p = v4ById.get((args.id ?? "").toLowerCase());
      if (!p) continue;
      const a0 = args.amount0 < 0n ? -args.amount0 : args.amount0;
      const a1 = args.amount1 < 0n ? -args.amount1 : args.amount1;
      const usd =
        quoteUsd(p.token0, a0, stockByHex, oracles, ethUsd) ??
        quoteUsd(p.token1, a1, stockByHex, oracles, ethUsd) ??
        0;
      const ok = await insertSwap(
        p.id,
        log.transactionHash ?? "0x",
        log.logIndex ?? 0,
        log.blockNumber,
        blockTime(log.blockNumber, head, headTs),
        usd,
      );
      if (ok) written++;
    }
  }
  console.log(`swap logs seen=${logsSeen} written=${written}`);

  await db().query(`
    UPDATE pool_snapshots s
    SET volume_usd_24h = v.vol
    FROM (
      SELECT pool_id, sum(usd_notional) AS vol
      FROM swaps
      WHERE taken_at > now() - interval '24 hours'
      GROUP BY pool_id
    ) v
    WHERE s.pool_id = v.pool_id
      AND s.block_number = (SELECT max(block_number) FROM pool_snapshots)
  `);

  await setState("volume", head, headTs);
  const volAfter = await lastBlock("volume");
  const lagAfter = volAfter == null ? null : head - volAfter;

  const { rows: top } = await db().query<{
    symbol: string | null;
    meme_address: string | null;
    ticker: string | null;
    dex: string;
    vol24h: string;
    stock_quoted: boolean;
  }>(`
    SELECT t.symbol, p.meme_address, p.stock_ticker AS ticker, p.dex,
           coalesce(sum(s.usd_notional), 0)::text AS vol24h,
           (p.token1 IN (SELECT contract_hex FROM stock_tokens)
            OR p.token0 IN (SELECT contract_hex FROM stock_tokens)) AS stock_quoted
    FROM swaps s
    INNER JOIN pools p ON p.id = s.pool_id
    LEFT JOIN tokens t ON t.address = p.meme_address
    WHERE s.taken_at > now() - interval '24 hours'
    GROUP BY t.symbol, p.meme_address, p.stock_ticker, p.dex, p.token0, p.token1
    ORDER BY coalesce(sum(s.usd_notional), 0) DESC
    LIMIT 10
  `);

  const stockQuotedInTop = top.filter((r) => r.stock_quoted).length;
  let pairCounts: unknown = null;
  if (stockQuotedInTop === 0) {
    const { rows } = await db().query(`
      SELECT
        count(*) FILTER (WHERE p.dex = 'pons_curve') AS token_launched,
        count(*) FILTER (
          WHERE p.dex = 'pons_curve'
            AND p.token1 IN (SELECT contract_hex FROM stock_tokens)
        ) AS pairtoken_in_stock_tokens,
        count(*) FILTER (
          WHERE p.pool_id ~ '^0x[0-9a-fA-F]{64}$'
        ) AS pools_with_pool_id,
        count(*) FILTER (
          WHERE p.dex = 'pons_curve' AND p.pool_id ~ '^0x[0-9a-fA-F]{64}$'
        ) AS pons_with_pool_id
      FROM pools p
    `);
    pairCounts = rows[0];
  }

  console.log(
    JSON.stringify(
      {
        lag_before: lagBefore?.toString() ?? null,
        lag_after: lagAfter?.toString() ?? null,
        pool_ids_queried: poolIds.length,
        swap_logs_written: written,
        swap_logs_seen: logsSeen,
        graduated_missing_pool_id: missing.rows,
        top10: top,
        pair_counts: pairCounts,
      },
      null,
      2,
    ),
  );
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgres://admin@localhost:5432/float";
  }
  const once =
    process.argv.includes("--once") ||
    process.env.INDEXER_ONCE === "1" ||
    process.env.INDEXER_LOOP === "0";
  const catchup = process.argv.includes("--catchup");
  await applySchema();
  const publicClient = await client();
  if (process.argv.includes("--long")) {
    await backfillLong(publicClient);
    return;
  }
  if (process.argv.includes("--vol24h")) {
    await backfillVol24h(publicClient);
    return;
  }
  if (process.argv.includes("--report")) {
    await reportPonsV2(publicClient);
    return;
  }
  if (process.argv.includes("--snapshot")) {
    await withRetry(() => snapshot(publicClient));
    console.log("snapshot done");
    return;
  }
  if (catchup) {
    const deadline = Date.now() + Number(process.env.INDEXER_CATCHUP_DEADLINE_MS ?? String(4 * 60 * 60 * 1000));
    const lookback = BigInt(process.env.INDEXER_LOOKBACK_BLOCKS ?? "40000");
    const history = indexerHistory();
    const sliceMs = Number(process.env.INDEXER_CATCHUP_MS ?? "180000");
    let oracleAt = 0;
    let oracles = new Map<string, number>();
    let ethUsd: number | null = null;
    let stocks: Awaited<ReturnType<typeof readOracles>>["stocks"] = [];
    let lastSnap = 0;
    while (Date.now() < deadline) {
      const head = await publicClient.getBlockNumber();
      if (Date.now() - oracleAt > 10 * 60 * 1000 || stocks.length === 0) {
        const o = await withRetry(() => readOracles(publicClient));
        stocks = o.stocks;
        oracles = o.oracles;
        ethUsd = o.ethUsd;
        oracleAt = Date.now();
      }
      const stockByHex = new Map(
        stocks.map((s) => [s.contract_hex, { ticker: s.ticker, decimals: s.decimals }]),
      );
      const runVolume = (from: bigint, to: bigint) =>
        indexVolume(publicClient, from, to, oracles, ethUsd, stockByHex);
      await onceResetPonsInferredPoolIds();
      const volSaved = await lastBlock("volume");
      if (volSaved != null && head > volSaved && head - volSaved > volumeWindowBlocks()) {
        console.log(
          `skip sequential volume saved=${volSaved} head=${head} lag=${head - volSaved} (use --vol24h)`,
        );
      } else {
        await catchUp("volume", head, lookback, runVolume, sliceMs);
      }
      await catchUp(
        "pons_grad",
        head,
        history,
        async (from, to) => {
          await indexPonsGraduation(publicClient, from, to);
          await setState("pons_grad", to);
        },
        Math.min(sliceMs, 90_000),
      );
      await catchUp(
        "pons_history",
        head,
        history,
        (from, to) => indexPons(publicClient, from, to, "pons_history"),
        Math.min(sliceMs, 90_000),
      );
      const newFront = (await lastBlock("pons_history")) ?? (await lastBlock("pons")) ?? 0n;
      const histAt = await lastBlock("pons_history");
      const volAt = await lastBlock("volume");
      const gradAt = await lastBlock("pons_grad");
      console.log(`catchup cursors history=${histAt} grad=${gradAt} volume=${volAt} head=${head}`);
      if (histAt != null && volAt != null && histAt >= head && volAt >= head) break;
      if (Date.now() - lastSnap > 3 * 60 * 1000) {
        console.log("catchup snapshot");
        await withRetry(() => snapshot(publicClient));
        lastSnap = Date.now();
      }
    }
    await withRetry(() => snapshot(publicClient));
    console.log("catchup done");
    return;
  }
  const registryMs = Number(process.env.REGISTRY_MS ?? 15 * 60 * 1000);
  const snapshotMs = Number(process.env.SNAPSHOT_MS ?? 30_000);
  let lastRegistry = 0;
  let lastRisk = 0;

  do {
    const t0 = Date.now();
    try {
      if (Date.now() - lastRegistry > registryMs) {
        await syncRegistry();
        await setState("registry", 0n);
        lastRegistry = Date.now();
        await discoverSpotPools(publicClient);
      }
      await tick(publicClient);
      if (Date.now() - lastRisk > registryMs) {
        await riskPass(publicClient);
        lastRisk = Date.now();
      }
    } catch (err) {
      console.error("tick failed", err);
      if (once) throw err;
    }
    if (once) break;
    const wait = Math.max(5_000, snapshotMs - (Date.now() - t0));
    console.log(`sleep ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  } while (true);
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
