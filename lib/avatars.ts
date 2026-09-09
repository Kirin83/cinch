export function stockLogoUrls(ticker: string | null | undefined): string[] {
  const t = (ticker ?? "").toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!t) return [];
  return [
    `https://financialmodelingprep.com/image-stock/${t}.png`,
    `https://storage.googleapis.com/iex/api/logos/${t}.png`,
  ];
}

export function fallbackHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 28% 26%)`;
}
