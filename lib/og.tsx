import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { stockLogoUrls } from "@/lib/avatars";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const C = {
  bg: "#181818",
  moss: "#2b2b2b",
  leaf: "#46ff04",
  ink: "#f5f5f5",
  muted: "#939393",
  onLeaf: "#181818",
};

let logoData: string | null = null;
let fontsData: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] | null = null;

export async function ogLogoSrc(): Promise<string> {
  if (logoData) return logoData;
  const buf = await readFile(join(process.cwd(), "public/cinch-mark-og.png"));
  logoData = `data:image/png;base64,${buf.toString("base64")}`;
  return logoData;
}

export async function ogFonts() {
  if (fontsData) return fontsData;
  const [regular, bold] = await Promise.all([400, 700].map((weight) => loadInter(weight as 400 | 700)));
  fontsData = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
  ];
  return fontsData;
}

async function loadInter(weight: 400 | 700): Promise<ArrayBuffer> {
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-${weight}-normal.ttf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Inter ${weight} ${res.status}`);
  return res.arrayBuffer();
}

export async function ogStockAvatar(ticker: string): Promise<string | null> {
  for (const url of stockLogoUrls(ticker)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "image/png";
      if (!ct.startsWith("image/")) continue;
      return `data:${ct};base64,${buf.toString("base64")}`;
    } catch {
      /* next source */
    }
  }
  return null;
}

export function OgShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: C.bg,
        color: C.ink,
        fontFamily: "Inter",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "48px 56px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function OgHeader({ logo, right }: { logo: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src={logo} width={56} height={56} />
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>cinch</div>
      </div>
      {right}
    </div>
  );
}

export function OgChip({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "rgba(70,255,4,0.14)",
        color: C.leaf,
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 1.4,
      }}
    >
      {children}
    </div>
  );
}

export function OgStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: C.moss,
        borderRadius: 20,
        padding: "22px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1.6,
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", marginTop: 8, fontSize: 40, fontWeight: 700, letterSpacing: -0.8 }}>
        {value}
      </div>
    </div>
  );
}

export function OgFooter({ url }: { url: string }) {
  return (
    <div style={{ display: "flex", fontSize: 20, color: C.muted }}>
      {url.replace(/^https:\/\//, "")}
    </div>
  );
}
