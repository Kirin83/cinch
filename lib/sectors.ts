import type { Sector } from "@/types";

const MEGA = new Set([
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "BRK", "JPM", "V", "UNH", "SPY", "QQQ",
]);
const MEME = new Set(["GME", "AMC", "HIMS", "BB", "NOK", "KOSS", "DWAC", "PHUN", "BBBY"]);
const AI = new Set([
  "NVDA", "AMD", "PLTR", "SMCI", "MSFT", "GOOGL", "META", "ARM", "AVGO", "INTC", "MU", "TSM", "ASML", "IONQ", "NBIS",
]);
const ETF = new Set([
  "SPY", "QQQ", "IWM", "SOXX", "USO", "SLV", "TLT", "SGOV", "EWY", "GLD", "SPCX",
]);
const COMMODITY = new Set(["USO", "SLV", "GLD"]);

export function classifyAsset(ticker: string, name: string): {
  asset_type: "equity" | "etf" | "commodity";
  sectors: Sector[];
} {
  const t = ticker.toUpperCase();
  const n = name.toUpperCase();
  const etf = ETF.has(t) || n.includes("ETF") || n.includes("TRUST");
  const commodity = COMMODITY.has(t);
  const sectors: Sector[] = [];
  if (MEGA.has(t)) sectors.push("mega");
  if (MEME.has(t)) sectors.push("meme_stocks");
  if (AI.has(t)) sectors.push("ai");
  return {
    asset_type: commodity ? "commodity" : etf ? "etf" : "equity",
    sectors,
  };
}
