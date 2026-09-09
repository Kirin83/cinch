import type { AsOf, ClassifyKind, Launchpad, RiskGrade, PairQuality } from "@/types";

export function formatPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null) return "—";
  const pct = ratio * 100;
  if (!Number.isFinite(pct)) return "—";
  if (pct !== 0 && Math.abs(pct) < 0.1) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(digits)}%`;
}

export function formatPp(delta: number | null | undefined): string {
  if (delta == null) return "—";
  const pp = delta * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(1)}pp`;
}

export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatUsdCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return formatUsd(value, 0);
  if (abs >= 0.01) return formatUsd(value, 2);
  return formatUsd(value, 4);
}

export function formatUsdg(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000) {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDG`;
  }
  let d = digits;
  if (abs > 0 && abs < 10 ** -digits) {
    d = Math.min(12, Math.ceil(-Math.log10(abs)) + 2);
  }
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(d, digits),
    maximumFractionDigits: d,
  });
  return `${n} USDG`;
}

export function formatPremiumBps(bps: number | null | undefined): string {
  if (bps == null) return "—";
  const pct = bps / 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatPressure(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 10) return `${value.toFixed(0)}×`;
  if (value >= 1) return `${value.toFixed(1)}×`;
  if (value >= 0.1) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

export function formatAmount(amount: string, symbol?: string): string {
  const n = Number(amount);
  const body = Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : amount;
  return symbol ? `${body} ${symbol}` : body;
}

export function formatAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatBlock(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function ago(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${formatAge(seconds)} ago`;
}

export function asOfLabel(asOf: AsOf): string {
  return `Block ${formatBlock(asOf.block_number)} · ${formatAge(asOf.lag_seconds)} ago`;
}

export function gradeLabel(grade: RiskGrade): string {
  return grade.toUpperCase();
}

export function qualityLabel(quality: PairQuality | ClassifyKind | string): string {
  if (quality === "pair_canonical" || quality === "canonical") return "CANONICAL";
  if (quality === "pair_fake_underlying" || quality === "fake_underlying") return "FAKE UNDERLYING";
  if (quality === "stock_canonical") return "REGISTRY CA";
  if (quality === "stock_impersonator") return "IMPERSONATOR";
  if (quality === "pair_spot_stock") return "SPOT";
  if (quality === "pair_stock_stock") return "STOCK/STOCK";
  if (quality === "unknown") return "UNKNOWN";
  return quality.toUpperCase();
}

export function launchpadLabel(value: string): string {
  if (value === "pons" || value === "pons_curve") return "Pons";
  if (value === "long") return "Long";
  if (value === "uniswap" || value.startsWith("uniswap")) return "Uniswap";
  return value;
}

export function asLaunchpad(value: string | null | undefined): Launchpad {
  if (value === "pons" || value === "uniswap" || value === "long" || value === "other") return value;
  if (value === "pons_curve") return "pons";
  return "other";
}
