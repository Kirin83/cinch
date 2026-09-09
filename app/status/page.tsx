import { statusPage as copy } from "@/copy";
import { loadStatus } from "@/lib/queries";
import { ago, formatBlock } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const data = await loadStatus();
  const rows = [
    { label: copy.head, state: data.head },
    { label: copy.pons, state: data.pons },
    { label: copy.long, state: data.long },
    { label: copy.uniswapV4, state: data.uniswap_v4 },
  ];
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Status</h1>
      <dl className="mt-8 max-w-xl space-y-4 font-mono text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between border-b border-line pb-3">
            <dt className="text-muted">{row.label}</dt>
            <dd>
              {formatBlock(row.state.last_block)}
              {row.state.lag_seconds != null
                ? ` · ${row.state.lag_seconds}s ago`
                : ` · ${ago(row.state.last_ok_at)}`}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-b border-line pb-3">
          <dt className="text-muted">{copy.registry}</dt>
          <dd>
            synced {ago(data.registry.synced_at)} · {data.registry.asset_count} assets
          </dd>
        </div>
      </dl>
    </div>
  );
}
