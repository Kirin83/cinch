import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { buttons } from "@/copy";
import { loadStock } from "@/lib/queries";
import { formatPct } from "@/lib/format";
import { SITE_ORIGIN, routes } from "@/routes";
import { ShareOnX } from "@/components/ShareButton";

type Props = { params: Promise<{ ticker: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  return { title: `Share ${ticker.toUpperCase()}` };
}

export default async function ShareStockPage({ params }: Props) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  if (ticker !== upper) redirect(routes.shareStock(upper));

  const data = await loadStock(upper);
  if (!data) notFound();

  const pageUrl = `${SITE_ORIGIN}${routes.stock(upper)}`;
  const text = buttons.shareTweet(upper, formatPct(data.hero.float_locked_pct));

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={routes.og("stock", upper)}
        alt={`${upper} share card`}
        width={1200}
        height={630}
        className="w-full rounded-[20px]"
      />
      <div className="mt-4 flex justify-end">
        <ShareOnX text={text} url={pageUrl} />
      </div>
    </div>
  );
}
