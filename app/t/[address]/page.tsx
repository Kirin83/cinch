import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { buttons, stockPage, tokenPage } from "@/copy";
import { routes } from "@/routes";
import { explorerAddress } from "@/lib/chain";
import { loadToken } from "@/lib/queries";
import { Chip } from "@/components/Chip";
import { StageChip } from "@/components/StageFilter";
import { CopyButton } from "@/components/CopyButton";
import { Avatar } from "@/components/Avatar";
import { TokenTabs } from "@/components/TokenTabs";
import { asOfLabel, formatAddress, formatAge, formatUsdCompact, formatUsdg, gradeLabel, launchpadLabel, asLaunchpad, qualityLabel } from "@/lib/format";

type Props = { params: Promise<{ address: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const data = await loadToken(address);
  return { title: data?.token.symbol ? `$${data.token.symbol}` : "Token" };
}

export default async function TokenPage({ params }: Props) {
  const { address } = await params;
  const data = await loadToken(address);
  if (!data) notFound();
  if (data.token.redirect_to_stock) {
    redirect(routes.stock(data.token.redirect_to_stock));
  }

  const fake = data.fake_underlying;
  const under = data.underlying;
  const risk = data.risk;
  const symbol = data.token.symbol ?? "???";
  const age = formatAge(
    data.token.created_at
      ? Math.round((Date.now() - new Date(data.token.created_at).getTime()) / 1000)
      : null,
  );
  const pad = launchpadLabel(asLaunchpad(under?.launchpad ?? data.token.launchpad));
  const quote = data.market.quote;

  return (
    <div>
      {fake ? (
        <div className="mb-6 rounded-[20px] border border-danger/40 bg-danger/10 px-4 py-4">
          <p className="font-mono text-sm font-semibold text-danger">{tokenPage.fakeBannerTitle}</p>
          <p className="mt-2 text-sm">{tokenPage.fakeBannerBody(fake.claimed_ticker)}</p>
          <p className="mt-3 font-mono text-xs text-muted">
            {tokenPage.fakeOfficial(fake.official.ticker)} {formatAddress(fake.official.contract)}
          </p>
          <p className="font-mono text-xs text-muted">
            {tokenPage.fakeThisContract} {formatAddress(fake.this_contract)}
          </p>
          <p className="mt-3 text-sm text-danger">{tokenPage.fakeSwapNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar label={symbol} size="lg" />
            <h1 className="font-display text-4xl tracking-tight">${symbol}</h1>
          </div>
          <p className="mt-3 text-sm text-muted">
            {quote
              ? `Quoted in ${quote} · launched ${age} ago on ${pad}`
              : `Launched ${age} ago on ${pad}`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {fake ? (
              <Chip kind="pair_fake_underlying">{qualityLabel("pair_fake_underlying")}</Chip>
            ) : under?.pair_quality === "pair_canonical" ? (
              <Chip kind="pair_canonical">{stockPage.canonical}</Chip>
            ) : under ? (
              <Chip kind={under.pair_quality}>{qualityLabel(under.pair_quality)}</Chip>
            ) : null}
            {data.stage ? <StageChip stage={data.stage} /> : null}
            <span className="font-mono text-xs text-muted">{formatAddress(data.token.address)}</span>
            <CopyButton value={data.token.address} />
            <a
              href={explorerAddress(data.token.address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-muted hover:text-ink"
            >
              {buttons.explorer}
            </a>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {fake ? (
            <p className="max-w-xs text-sm text-danger">
              {buttons.swapDisabled}. {tokenPage.fakeSwapHidden}
            </p>
          ) : data.swap_urls ? (
            <>
              <div className="flex flex-wrap gap-2">
                {data.swap_urls.pons ? (
                  <a
                    href={data.swap_urls.pons}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[15px] bg-leaf px-4 py-2 text-sm font-semibold text-on-leaf hover:brightness-110"
                  >
                    {tokenPage.tradeOnPons}
                  </a>
                ) : null}
                {data.swap_urls.long ? (
                  <a
                    href={data.swap_urls.long}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[15px] bg-leaf px-4 py-2 text-sm font-semibold text-on-leaf hover:brightness-110"
                  >
                    {tokenPage.tradeOnLong}
                  </a>
                ) : null}
                {data.swap_urls.uniswap ? (
                  <a
                    href={data.swap_urls.uniswap}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[15px] bg-moss px-4 py-2 text-sm text-muted hover:text-ink"
                  >
                    {tokenPage.uniswap}
                  </a>
                ) : null}
                {data.swap_urls.dexscreener ? (
                  <a
                    href={data.swap_urls.dexscreener}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[15px] bg-moss px-4 py-2 text-sm text-muted hover:text-ink"
                  >
                    {tokenPage.dexscreener}
                  </a>
                ) : null}
              </div>
              <p className="text-xs text-muted">{tokenPage.noRoute}</p>
            </>
          ) : null}
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tokenPage.price} value={formatUsdg(data.market.price_usdg, 6)} />
        <Stat label={tokenPage.marketcap} value={formatUsdCompact(data.market.marketcap_usdg)} />
        <Stat
          label={tokenPage.vol24h}
          value={formatUsdCompact(data.market.volume_usd_24h)}
          hint={
            data.market.chart_url ? (
              <a href={data.market.chart_url} target="_blank" rel="noreferrer" className="hover:text-ink">
                {stockPage.chart} ↗
              </a>
            ) : null
          }
        />
        <Stat
          label={tokenPage.risk}
          value={risk ? <Chip kind={risk.grade}>{gradeLabel(risk.grade)}</Chip> : "—"}
        />
      </dl>
      <p className="mt-4 font-mono text-[11px] text-muted">{asOfLabel(data.as_of)}</p>

      <TokenTabs data={data} />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="card-well px-4 py-4">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-xl num">{value}</dd>
      {hint ? <div className="mt-2 text-xs leading-relaxed text-muted">{hint}</div> : null}
    </div>
  );
}
