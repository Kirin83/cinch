"use client";

import { useState } from "react";
import { fallbackHue } from "@/lib/avatars";

const sizes = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-7 w-7 text-[9px]",
  md: "h-10 w-10 text-[11px]",
  lg: "h-14 w-14 text-sm",
} as const;

export function Avatar({
  src,
  label,
  size = "md",
  rounded = "lg",
  className = "",
}: {
  src?: string | string[] | null;
  label: string;
  size?: keyof typeof sizes;
  rounded?: "lg" | "full";
  className?: string;
}) {
  const list = (Array.isArray(src) ? src : src ? [src] : []).filter(Boolean);
  const [index, setIndex] = useState(0);
  const current = list[index];
  const initials = (label || "?").replace(/^\$/, "").slice(0, 3).toUpperCase();
  const showImg = Boolean(current);
  const radius = rounded === "full" ? "rounded-full" : "rounded-lg";

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden bg-moss font-semibold text-ink ${sizes[size]} ${radius} ${className}`}
      style={showImg ? undefined : { background: fallbackHue(label) }}
      title={label}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt=""
          className="h-full w-full object-cover"
          onError={() => {
            if (index + 1 < list.length) setIndex(index + 1);
            else setIndex(list.length);
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

export function PairNames({
  tokenSrc,
  tokenLabel,
  stockSrc,
  stockLabel,
  size = "sm",
}: {
  tokenSrc?: string | string[] | null;
  tokenLabel: string;
  stockSrc?: string | string[] | null;
  stockLabel?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar src={tokenSrc} label={tokenLabel} size={size} />
      <span className="truncate font-semibold">{tokenLabel}</span>
      {stockLabel ? (
        <>
          <span className="text-muted">/</span>
          <Avatar src={stockSrc} label={stockLabel} size={size} />
          <span className="truncate font-semibold">{stockLabel}</span>
        </>
      ) : null}
    </span>
  );
}
