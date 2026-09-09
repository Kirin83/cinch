"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { verify as copy } from "@/copy";
import type { GetVerifyResponse } from "@/types";
import { Chip } from "@/components/Chip";
import { CopyButton } from "@/components/CopyButton";
import { formatAddress, qualityLabel } from "@/lib/format";

export function VerifyForm() {
  const params = useSearchParams();
  const initial = params.get("address")?.trim() ?? "";
  const [value, setValue] = useState(initial);
  const [data, setData] = useState<GetVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  async function lookup(address: string) {
    setBusy(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/verify?address=${encodeURIComponent(address)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? copy.badAddress);
        return;
      }
      setData(body as GetVerifyResponse);
    } catch {
      setError(copy.badAddress);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (ran.current) return;
    if (!initial) return;
    ran.current = true;
    void lookup(initial);
  }, [initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await lookup(value.trim());
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-wrap gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.placeholder}
          className="min-w-[20rem] flex-1 rounded-[15px] bg-elev px-4 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-[15px] bg-leaf px-5 py-2.5 text-sm font-semibold text-on-leaf hover:brightness-110 disabled:opacity-60"
        >
          {copy.submit}
        </button>
      </form>

      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}

      {data ? (
        <div className="card-well mt-8 space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip kind={data.kind}>{qualityLabel(data.kind)}</Chip>
          </div>
          <p className="text-sm leading-relaxed">{data.copy_line}</p>
          {data.impersonator ? (
            <div className="space-y-2 font-mono text-xs text-muted">
              <p>
                {copy.officialCa} {formatAddress(data.impersonator.official.contract_hex)}{" "}
                <CopyButton value={data.impersonator.official.contract_hex} />
              </p>
              <p>
                {copy.thisCa} {formatAddress(data.impersonator.this_contract_hex)}{" "}
                <CopyButton value={data.impersonator.this_contract_hex} />
              </p>
            </div>
          ) : data.official ? (
            <p className="font-mono text-xs text-muted">
              {copy.officialCa} {formatAddress(data.official.contract_hex)}{" "}
              <CopyButton value={data.official.contract_hex} />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
