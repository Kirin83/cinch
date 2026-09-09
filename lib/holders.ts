import { formatUnits } from "viem";
import { CHAIN_ID, PONS_V2_LOCKER, UNI_V4_POOL_MANAGER } from "@/lib/chain";
import type { HolderRow, TokenAmount } from "@/types";

const BLOCKSCOUT = "https://api.blockscout.com";
const CACHE_MS = 120_000;
const FAIL_CACHE_MS = 15_000;
const cache = new Map<string, { at: number; rows: HolderRow[] | null; ttl: number }>();

type HolderItem = {
  value?: string | null;
  address?: { hash?: string };
};

function apiKey(): string | null {
  return process.env.BLOCKSCOUT_API_KEY ?? null;
}

function tokenAmount(raw: string, decimals: number, symbol: string): TokenAmount {
  const rawStr = raw.split(".")[0] || "0";
  let formatted = "0";
  try {
    formatted = formatUnits(BigInt(rawStr), decimals);
  } catch {
    formatted = "0";
  }
  return { raw: rawStr, amount: formatted, decimals, symbol };
}

export async function fetchTokenHolders(opts: {
  token: string;
  symbol: string;
  decimals: number;
  poolAddresses?: string[];
}): Promise<HolderRow[] | null> {
  const key = apiKey();
  if (!key) return null;
  const token = opts.token.toLowerCase();
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.rows;

  const pools = new Set(
    [...(opts.poolAddresses ?? []), UNI_V4_POOL_MANAGER, PONS_V2_LOCKER].map((a) =>
      a.toLowerCase(),
    ),
  );

  try {
    const url = `${BLOCKSCOUT}/${CHAIN_ID}/api/v2/tokens/${token}/holders?items_count=50`;
    const metaUrl = `${BLOCKSCOUT}/${CHAIN_ID}/api/v2/tokens/${token}`;
    const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      cache.set(token, { at: Date.now(), rows: null, ttl: FAIL_CACHE_MS });
      return null;
    }
    const body = (await res.json()) as { items?: HolderItem[] };
    let rows: HolderRow[] = (body.items ?? []).map((it) => {
      const hex = (it.address?.hash ?? "").toLowerCase();
      return {
        address: hex,
        balance: tokenAmount(it.value ?? "0", opts.decimals, opts.symbol),
        pct_of_supply: 0,
        is_pool: pools.has(hex),
      };
    });
    try {
      const metaRes = await fetch(metaUrl, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { total_supply?: string | null };
        const raw = (meta.total_supply ?? "0").split(".")[0] || "0";
        const supplyAmt = Number(formatUnits(BigInt(raw), opts.decimals));
        rows = withPctOfSupply(rows, supplyAmt);
      }
    } catch {
      /* keep pct 0 */
    }
    rows.sort((a, b) => {
      const pa = a.pct_of_supply || 0;
      const pb = b.pct_of_supply || 0;
      if (pb !== pa) return pb - pa;
      try {
        const ba = BigInt(a.balance.raw || "0");
        const bb = BigInt(b.balance.raw || "0");
        if (bb > ba) return 1;
        if (bb < ba) return -1;
      } catch {
        /* ignore */
      }
      return 0;
    });
    cache.set(token, { at: Date.now(), rows, ttl: CACHE_MS });
    return rows;
  } catch {
    return null;
  }
}

export function withPctOfSupply(rows: HolderRow[], totalSupplyAmount: number): HolderRow[] {
  if (!(totalSupplyAmount > 0)) return rows;
  return rows.map((h) => ({
    ...h,
    pct_of_supply: (Number(h.balance.amount) || 0) / totalSupplyAmount,
  }));
}
