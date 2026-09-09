import { isSpotQuote } from "./chain";

export type ClassifyKind =
  | "stock_canonical"
  | "stock_impersonator"
  | "pair_canonical"
  | "pair_fake_underlying"
  | "pair_spot_stock"
  | "pair_stock_stock"
  | "unknown";

export type PoolPairQuality =
  | "pair_canonical"
  | "pair_fake_underlying"
  | "pair_spot_stock"
  | "pair_stock_stock"
  | "unknown";

export type RegistryStock = {
  ticker: string;
  contract_hex: string;
};

export type ClassifyResult = {
  kind: ClassifyKind;
  official: { ticker: string; contract_hex: string } | null;
  impersonator: {
    claimed_ticker: string;
    this_contract: string;
    official: { ticker: string; contract_hex: string };
  } | null;
  token0: string | null;
  token1: string | null;
  copy_line: string;
};

export function normalizeHex(addr: string): string | null {
  const a = addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) return null;
  return a;
}

export function claimedTickerFromSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const t = symbol.replace(/^RH/i, "").trim().toUpperCase();
  return t || null;
}

function registryIndex(registry: Iterable<RegistryStock> | Map<string, string>) {
  const byCa = new Map<string, string>();
  const byTicker = new Map<string, string>();
  if (registry instanceof Map) {
    for (const [hex, ticker] of registry) {
      const h = hex.toLowerCase();
      const t = ticker.toUpperCase();
      byCa.set(h, t);
      byTicker.set(t, h);
    }
  } else {
    for (const r of registry) {
      const h = r.contract_hex.toLowerCase();
      const t = r.ticker.toUpperCase();
      byCa.set(h, t);
      byTicker.set(t, h);
    }
  }
  return { byCa, byTicker };
}

function impersonatorFor(
  hex: string,
  symbol: string | null | undefined,
  byCa: Map<string, string>,
  byTicker: Map<string, string>,
): ClassifyResult["impersonator"] {
  if (byCa.has(hex) || isSpotQuote(hex)) return null;
  const claimed = claimedTickerFromSymbol(symbol);
  if (!claimed) return null;
  const officialCa = byTicker.get(claimed);
  if (!officialCa || officialCa === hex) return null;
  return {
    claimed_ticker: claimed,
    this_contract: hex,
    official: { ticker: claimed, contract_hex: officialCa },
  };
}

function copyLine(r: Omit<ClassifyResult, "copy_line">): string {
  const notBuy = "Not a buy.";
  switch (r.kind) {
    case "stock_canonical":
      return `Official ${r.official?.ticker} Stock Token CA. ${notBuy}`;
    case "stock_impersonator":
      return `Claims ${r.impersonator?.claimed_ticker}. Official CA is ${r.impersonator?.official.contract_hex}. This CA is ${r.impersonator?.this_contract}. ${notBuy}`;
    case "pair_canonical":
      return `Canonical meme/${r.official?.ticker ?? "stock"} pair. ${notBuy}`;
    case "pair_fake_underlying":
      return `Fake ${r.impersonator?.claimed_ticker}. Official CA ${r.impersonator?.official.contract_hex}. This quote CA ${r.impersonator?.this_contract}. ${notBuy}`;
    case "pair_spot_stock":
      return `${r.official?.ticker ?? "Stock"} spot pool (USDG/WETH/cbBTC). Not a meme-stock pair. ${notBuy}`;
    case "pair_stock_stock":
      return `Two official Stock Tokens. Not a meme-stock pair. ${notBuy}`;
    default:
      return `Not in the Robinhood Stock Token registry. ${notBuy}`;
  }
}

function finish(partial: Omit<ClassifyResult, "copy_line">): ClassifyResult {
  return { ...partial, copy_line: copyLine(partial) };
}

function classifyToken(
  hex: string,
  symbol: string | null | undefined,
  byCa: Map<string, string>,
  byTicker: Map<string, string>,
): ClassifyResult {
  const ticker = byCa.get(hex);
  if (ticker) {
    return finish({
      kind: "stock_canonical",
      official: { ticker, contract_hex: hex },
      impersonator: null,
      token0: hex,
      token1: null,
    });
  }
  const impersonator = impersonatorFor(hex, symbol, byCa, byTicker);
  if (impersonator) {
    return finish({
      kind: "stock_impersonator",
      official: impersonator.official,
      impersonator,
      token0: hex,
      token1: null,
    });
  }
  return finish({
    kind: "unknown",
    official: null,
    impersonator: null,
    token0: hex,
    token1: null,
  });
}

function classifyPair(
  a: string,
  b: string,
  symbols: Record<string, string | null | undefined>,
  byCa: Map<string, string>,
  byTicker: Map<string, string>,
): ClassifyResult {
  const hitA = byCa.has(a);
  const hitB = byCa.has(b);
  const spotA = isSpotQuote(a);
  const spotB = isSpotQuote(b);

  if (hitA && hitB) {
    return finish({
      kind: "pair_stock_stock",
      official: { ticker: byCa.get(a)!, contract_hex: a },
      impersonator: null,
      token0: a,
      token1: b,
    });
  }

  if ((hitA && spotB) || (hitB && spotA)) {
    const stockHex = hitA ? a : b;
    return finish({
      kind: "pair_spot_stock",
      official: { ticker: byCa.get(stockHex)!, contract_hex: stockHex },
      impersonator: null,
      token0: a,
      token1: b,
    });
  }

  if (hitA && !spotB && !hitB) {
    return finish({
      kind: "pair_canonical",
      official: { ticker: byCa.get(a)!, contract_hex: a },
      impersonator: null,
      token0: a,
      token1: b,
    });
  }
  if (hitB && !spotA && !hitA) {
    return finish({
      kind: "pair_canonical",
      official: { ticker: byCa.get(b)!, contract_hex: b },
      impersonator: null,
      token0: a,
      token1: b,
    });
  }

  const impA = impersonatorFor(a, symbols[a], byCa, byTicker);
  const impB = impersonatorFor(b, symbols[b], byCa, byTicker);
  if (impA && !spotB) {
    return finish({
      kind: "pair_fake_underlying",
      official: impA.official,
      impersonator: impA,
      token0: a,
      token1: b,
    });
  }
  if (impB && !spotA) {
    return finish({
      kind: "pair_fake_underlying",
      official: impB.official,
      impersonator: impB,
      token0: a,
      token1: b,
    });
  }

  return finish({
    kind: "unknown",
    official: null,
    impersonator: null,
    token0: a,
    token1: b,
  });
}

export function classify(input: {
  address?: string;
  token0?: string;
  token1?: string;
  symbols?: Record<string, string | null | undefined>;
  registry: Iterable<RegistryStock> | Map<string, string>;
}): ClassifyResult {
  const { byCa, byTicker } = registryIndex(input.registry);
  const empty = finish({
    kind: "unknown",
    official: null,
    impersonator: null,
    token0: null,
    token1: null,
  });

  if (input.token0 && input.token1) {
    const a = normalizeHex(input.token0);
    const b = normalizeHex(input.token1);
    if (!a || !b) return empty;
    return classifyPair(a, b, input.symbols ?? {}, byCa, byTicker);
  }

  const one = input.address ?? input.token0;
  if (!one) return empty;
  const hex = normalizeHex(one);
  if (!hex) return empty;
  const symbol = input.symbols?.[hex] ?? input.symbols?.[one];
  return classifyToken(hex, symbol, byCa, byTicker);
}

export function poolPairQuality(kind: ClassifyKind): PoolPairQuality {
  if (
    kind === "pair_canonical" ||
    kind === "pair_fake_underlying" ||
    kind === "pair_spot_stock" ||
    kind === "pair_stock_stock"
  ) {
    return kind;
  }
  return "unknown";
}

export function isMemeCanonical(q: string | null | undefined): boolean {
  return q === "pair_canonical" || q === "canonical";
}

export function isFakeUnderlying(q: string | null | undefined): boolean {
  return q === "pair_fake_underlying" || q === "fake_underlying";
}

export function isSpotStockPair(q: string | null | undefined): boolean {
  return q === "pair_spot_stock";
}

export function stockTickerFromClassify(result: ClassifyResult): string | null {
  if (result.kind === "pair_fake_underlying") return result.impersonator?.claimed_ticker ?? null;
  return result.official?.ticker ?? null;
}
