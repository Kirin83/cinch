"use client";

import { useEffect, useState } from "react";
import { buttons } from "@/copy";
import { readWatchlist, togglePin } from "@/lib/watchlist";

export function PinButton({ ticker }: { ticker: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readWatchlist().includes(ticker));
  }, [ticker]);

  return (
    <button
      type="button"
      onClick={() => setOn(togglePin(ticker).includes(ticker))}
      className="rounded-[15px] bg-moss px-2.5 py-1 font-mono text-xs font-semibold text-muted hover:text-ink"
    >
      {on ? buttons.pinned : buttons.pin}
    </button>
  );
}
