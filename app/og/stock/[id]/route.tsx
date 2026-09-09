import { ImageResponse } from "next/og";
import { loadOgStock } from "@/lib/queries";
import { formatAmount, formatPct, formatPremiumBps, formatUsdCompact } from "@/lib/format";
import {
  OgChip,
  OgFooter,
  OgHeader,
  OgShell,
  OgStat,
  OG_SIZE,
  ogFonts,
  ogLogoSrc,
  ogStockAvatar,
} from "@/lib/og";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const og = await loadOgStock(id);
  if (!og || og.type !== "stock") return new Response("Not found", { status: 404 });

  const [logo, fonts, avatar] = await Promise.all([ogLogoSrc(), ogFonts(), ogStockAvatar(og.ticker)]);
  const locked = formatPct(og.float_locked_pct, 1);
  const hold =
    og.top_meme_symbol && og.top_meme_stock_in_lp
      ? `${og.top_meme_symbol} holds ${formatAmount(og.top_meme_stock_in_lp.amount)} ${og.ticker} in LP`
      : `On-chain supply ${formatAmount(og.onchain_supply.amount, og.ticker)}`;

  return new ImageResponse(
    (
      <OgShell>
        <OgHeader logo={logo} right={<OgChip>CANONICAL</OgChip>} />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {avatar ? (
            <img
              src={avatar}
              width={96}
              height={96}
              style={{ borderRadius: 18, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 96,
                height: 96,
                borderRadius: 18,
                background: "#2b2b2b",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {og.ticker.slice(0, 3)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{og.ticker}</div>
            <div style={{ display: "flex", marginTop: 4, fontSize: 24, color: "#939393" }}>
              {og.name ? `${og.name} · Official Stock Token` : "Official Stock Token"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <OgStat label="Float locked" value={locked} />
          <OgStat label="Premium" value={formatPremiumBps(og.premium_bps)} />
          <OgStat label="Meme vol 24h" value={formatUsdCompact(og.meme_vol_24h_usd)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#939393" }}>{hold}</div>
          <OgFooter url={og.url} />
        </div>
      </OgShell>
    ),
    { ...OG_SIZE, fonts },
  );
}
