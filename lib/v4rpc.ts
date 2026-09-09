import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type PublicClient,
} from "viem";
import {
  CHAIN_ID,
  MULTICALL3,
  RPC_URL,
  UNI_V4_STATE_VIEW,
  USDG,
  WETH,
  ZERO,
  CBBTC,
} from "@/lib/chain";
import { PONS_V4_TICK_SPACING, priceToken1PerToken0, sortedPair, v4WantAmount } from "@/lib/v4math";

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
]);

const erc20Abi = parseAbi(["function totalSupply() view returns (uint256)"]);

let client: PublicClient | null = null;

export function rpcClient(): PublicClient | null {
  if (!RPC_URL) return null;
  if (!client) {
    client = createPublicClient({
      chain: {
        id: CHAIN_ID,
        name: "Robinhood Chain",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [RPC_URL] } },
        contracts: {
          multicall3: { address: MULTICALL3 as Address, blockCreated: 1 },
        },
      },
      transport: http(RPC_URL, { timeout: 30_000, retryCount: 2 }),
    });
  }
  return client;
}

export type V4State = { sqrt: bigint; liq: bigint };

async function applyV4Chunk(
  publicClient: PublicClient,
  slice: string[],
  out: Map<string, V4State>,
): Promise<string[]> {
  const retry: string[] = [];
  const result = await publicClient.multicall({
    contracts: slice.flatMap((id) => [
      {
        address: UNI_V4_STATE_VIEW as Address,
        abi: stateViewAbi,
        functionName: "getSlot0" as const,
        args: [id as `0x${string}`],
      },
      {
        address: UNI_V4_STATE_VIEW as Address,
        abi: stateViewAbi,
        functionName: "getLiquidity" as const,
        args: [id as `0x${string}`],
      },
    ]),
    allowFailure: true,
  });
  for (let j = 0; j < slice.length; j++) {
    const slot = result[j * 2];
    const liq = result[j * 2 + 1];
    if (slot.status !== "success") {
      retry.push(slice[j]);
      continue;
    }
    const sqrt = (slot.result as readonly [bigint, number, number, number])[0];
    if (sqrt === 0n) continue;
    const liquidity = liq.status === "success" ? (liq.result as bigint) : 0n;
    out.set(slice[j].toLowerCase(), { sqrt, liq: liquidity });
    if (liq.status !== "success") retry.push(slice[j]);
  }
  return retry;
}

export async function readV4States(
  publicClient: PublicClient,
  poolIds: string[],
): Promise<Map<string, V4State>> {
  const out = new Map<string, V4State>();
  const unique = [...new Set(poolIds.filter((id) => /^0x[0-9a-f]{64}$/i.test(id)).map((id) => id.toLowerCase()))];
  const failed: string[] = [];
  const chunk = 40;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    try {
      failed.push(...(await applyV4Chunk(publicClient, slice, out)));
    } catch {
      failed.push(...slice);
    }
  }
  for (const id of [...new Set(failed)]) {
    if (out.has(id) && out.get(id)!.liq > 0n) continue;
    try {
      await applyV4Chunk(publicClient, [id], out);
    } catch {
      /* leave missing */
    }
  }
  return out;
}

export async function readV4WantAmounts(
  publicClient: PublicClient,
  jobs: {
    poolId: string;
    token0: string;
    token1: string;
    want: string;
    tickSpacing?: number | null;
  }[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  if (!jobs.length) return out;
  const states = await readV4States(publicClient, jobs.map((j) => j.poolId));
  for (const j of jobs) {
    const id = j.poolId.toLowerCase();
    const st = states.get(id);
    if (!st || st.liq === 0n) continue;
    const spacing = j.tickSpacing && j.tickSpacing > 0 ? j.tickSpacing : PONS_V4_TICK_SPACING;
    out.set(id, v4WantAmount(j.token0, j.token1, j.want, st.sqrt, st.liq, spacing));
  }
  return out;
}

export async function readTotalSupplies(
  publicClient: PublicClient,
  addresses: string[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))];
  const chunk = 80;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const result = await publicClient.multicall({
      contracts: slice.map((address) => ({
        address: address as Address,
        abi: erc20Abi,
        functionName: "totalSupply" as const,
      })),
      allowFailure: true,
    });
    slice.forEach((address, j) => {
      const r = result[j];
      if (r.status === "success") out.set(address, r.result as bigint);
    });
  }
  return out;
}

export function tokenDecimals(addr: string, known?: number | null): number {
  const a = addr.toLowerCase();
  if (a === USDG) return 6;
  if (a === CBBTC) return 8;
  if (known != null && Number.isFinite(known) && known > 0) return known;
  return 18;
}

export function memePriceUsdg(opts: {
  token0: string;
  token1: string;
  meme: string;
  sqrt: bigint;
  dec0: number;
  dec1: number;
  quoteUsd: number | null;
}): number | null {
  const t0 = opts.token0.toLowerCase();
  const t1 = opts.token1.toLowerCase();
  const meme = opts.meme.toLowerCase();
  if (opts.sqrt === 0n || opts.quoteUsd == null || opts.quoteUsd <= 0) return null;
  if (meme !== t0 && meme !== t1) return null;
  const [c0] = sortedPair(t0, t1);
  const dec0 = c0 === t0 ? opts.dec0 : opts.dec1;
  const dec1 = c0 === t0 ? opts.dec1 : opts.dec0;
  const t1PerT0 = priceToken1PerToken0(opts.sqrt, dec0, dec1);
  if (!Number.isFinite(t1PerT0) || t1PerT0 <= 0) return null;
  const memeInQuote = meme === c0 ? t1PerT0 : 1 / t1PerT0;
  const px = memeInQuote * opts.quoteUsd;
  return Number.isFinite(px) && px > 0 ? px : null;
}

export function quoteUsdRate(opts: {
  quote: string;
  ethUsd: number | null;
  stockDexUsdg: number | null;
}): number | null {
  const q = opts.quote.toLowerCase();
  if (q === USDG) return 1;
  if (q === WETH || q === ZERO) return opts.ethUsd;
  if (q === CBBTC) return null;
  return opts.stockDexUsdg;
}

export function otherToken(token0: string, token1: string, meme: string): string {
  const m = meme.toLowerCase();
  return token0.toLowerCase() === m ? token1.toLowerCase() : token0.toLowerCase();
}
