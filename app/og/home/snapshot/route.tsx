import { ImageResponse } from "next/og";
import { loadOgHome } from "@/lib/queries";
import { formatUsdCompact } from "@/lib/format";
import { OgFooter, OgHeader, OgShell, OG_SIZE, ogFonts, ogLogoSrc } from "@/lib/og";

export const runtime = "nodejs";

export async function GET() {
  const og = await loadOgHome();
  if (og.type !== "home") return new Response("Not found", { status: 404 });

  const [logo, fonts] = await Promise.all([ogLogoSrc(), ogFonts()]);

  return new ImageResponse(
    (
      <OgShell>
        <OgHeader logo={logo} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1.2 }}>
            Canonical meme-stock pairs on Hood
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#939393" }}>
            Ranked by volume. Fake tickers hidden.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {og.lines.map((line) => (
            <div
              key={line.ticker}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#2b2b2b",
                borderRadius: 16,
                padding: "18px 24px",
              }}
            >
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700, width: 180 }}>{line.ticker}</div>
              <div style={{ display: "flex", fontSize: 28, fontWeight: 700, width: 280, justifyContent: "flex-end" }}>
                {formatUsdCompact(line.meme_vol_24h_usd)}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#939393", flex: 1, justifyContent: "flex-end" }}>
                24h vol
              </div>
            </div>
          ))}
        </div>
        <OgFooter url={og.url} />
      </OgShell>
    ),
    { ...OG_SIZE, fonts },
  );
}
