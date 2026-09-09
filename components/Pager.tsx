"use client";

import { pager as copy } from "@/copy";

export function Pager({
  page,
  pageSize,
  total,
  hasMore,
  busy,
  onPage,
}: {
  page: number;
  pageSize: number;
  total?: number;
  hasMore?: boolean;
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  const unknown = total == null;
  if (unknown) {
    if (!hasMore && page <= 1) return null;
  } else if (total <= pageSize) {
    return null;
  }
  const pages = unknown ? 0 : Math.max(1, Math.ceil(total / pageSize));
  const from = unknown || total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = unknown ? page * pageSize : Math.min(page * pageSize, total);
  const nextOff = unknown ? !hasMore : page >= pages;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
      {unknown ? <span /> : <span>{copy.of(from, to, total)}</span>}
      <div className="flex gap-2">
        <button
          type="button"
          className="seg-item"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {copy.prev}
        </button>
        <button
          type="button"
          className="seg-item"
          disabled={busy || nextOff}
          onClick={() => onPage(page + 1)}
        >
          {copy.next}
        </button>
      </div>
    </div>
  );
}
