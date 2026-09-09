import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttons, stockPage } from "@/copy";
import { loadStock } from "@/lib/queries";
import { SITE_ORIGIN, routes } from "@/routes";
import { Chip } from "@/components/Chip";
import { PinButton } from "@/components/PinButton";
import { StockTabs } from "@/components/StockTabs";
import { CopyButton } from "@/components/CopyButton";
import { ShareButton, ShareOnX } from "@/components/ShareButton";
import { Avatar } from "@/components/Avatar";
import { stockLogoUrls } from "@/lib/avatars";
import {
  asOfLabel,
  formatAddress,
  formatAmount,
  formatPct,
  formatPremiumBps,
  formatPressure,
  formatUsd,
} from "@/lib/format";

type Props = { params: Promise<{ ticker: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  return {
    title: upper,
    openGraph: {
      title: `${upper} · cinch`,
      images: [{ url: `/og/stock/${upper}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${upper} · cinch`,
      images: [`/og/stock/${upper}`],
    },
  };
}

export default async function StockPage({ params }: Props) {
  const { ticker } = await params;
  const data = await loadStock(ticker);
  if (!data) notFound();

  const { stock, hero } = data;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar src={stockLogoUrls(stock.ticker)} label={stock.ticker} size="lg" />
          <div>
            <h1 className="font-display text-4xl tracking-tight">{stock.ticker}</h1>
            <h2 className="mt-1 text-sm text-muted">
              {stock.name} · {stockPage.official}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip kind="canonical">{stockPage.canonical}</Chip>
              <span className="font-mono text-xs text-muted">{formatAddress(stock.contract)}</span>
              <CopyButton value={stock.contract} />
              <a
                href={stock.explorer_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-muted hover:text-ink"
              >
                {buttons.explorer}
              </a>
              <PinButton ticker={stock.ticker} />
            </div>
          </div>
        </div>
        <ShareButton href={routes.shareStock(stock.ticker)} />
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={stockPage.floatLocked}
          value={formatPct(hero.float_locked_pct)}
          hint={stockPage.floatLockedHelper}
        />
        <Stat
          label={stockPage.lockedInMemeLps}
          value={formatAmount(hero.locked_in_meme_lps.amount, stock.ticker)}
        />
        <Stat
          label={stockPage.onchainSupply}
          value={formatAmount(hero.onchain_supply.amount, stock.ticker)}
        />
        <Stat label={stockPage.oracle} value={formatUsd(hero.oracle_price_usd)} />
        <Stat label={stockPage.dex} value={formatUsd(hero.dex_price_usd)} />
        <Stat
          label={stockPage.premium}
          value={formatPremiumBps(hero.premium_bps)}
          hint={stockPage.premiumHelper}
        />
        <Stat label={stockPage.memePressure} value={formatPressure(hero.meme_pressure)} />
      </dl>
      <p className="mt-4 font-mono text-[11px] text-muted">{asOfLabel(data.as_of)}</p>

      <StockTabs key={stock.ticker} data={data} />

      <p className="mt-10 max-w-2xl text-sm text-muted">
        {stockPage.extraDisclaimer(stock.ticker)}
      </p>
      <div className="mt-6 flex justify-end">
        <ShareOnX
          text={buttons.shareTweet(stock.ticker, formatPct(hero.float_locked_pct))}
          url={`${SITE_ORIGIN}${routes.stock(stock.ticker)}`}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-well px-4 py-4">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-xl">{value}</dd>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
