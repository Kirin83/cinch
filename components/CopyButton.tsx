"use client";

import { useState } from "react";
import { buttons } from "@/copy";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="font-mono text-xs text-muted hover:text-ink"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? buttons.copied : "Copy"}
    </button>
  );
}
