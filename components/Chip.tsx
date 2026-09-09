import type { ReactNode } from "react";
import type { ClassifyKind, PairQuality, RiskGrade } from "@/types";

const tone: Record<string, string> = {
  canonical: "bg-leaf/14 text-leaf",
  pair_canonical: "bg-leaf/14 text-leaf",
  stock_canonical: "bg-leaf/14 text-leaf",
  fake_underlying: "bg-danger/15 text-danger",
  pair_fake_underlying: "bg-danger/15 text-danger",
  stock_impersonator: "bg-danger/15 text-danger",
  pair_spot_stock: "bg-moss text-muted",
  pair_stock_stock: "bg-moss text-muted",
  unknown: "bg-moss text-muted",
  caution: "bg-caution/15 text-caution",
  danger: "bg-danger/15 text-danger",
  clear: "bg-moss text-muted",
  curve: "bg-caution/15 text-caution",
  graduated: "bg-leaf/14 text-leaf",
};

export function Chip({
  children,
  kind,
}: {
  children: ReactNode;
  kind: ClassifyKind | PairQuality | RiskGrade | "canonical" | "fake_underlying" | "curve" | "graduated";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${tone[kind] ?? tone.clear}`}
    >
      {children}
    </span>
  );
}
