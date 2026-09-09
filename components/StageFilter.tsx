"use client";

import { markets } from "@/copy";
import type { MarketStage, PairStage } from "@/types";
import { Chip } from "@/components/Chip";

const STAGES: MarketStage[] = ["all", "curve", "graduated"];

export function StageChip({ stage }: { stage: PairStage }) {
  return <Chip kind={stage}>{markets.stageChip[stage]}</Chip>;
}

export function StageFilter({
  value,
  busy,
  onChange,
}: {
  value: MarketStage;
  busy?: boolean;
  onChange: (stage: MarketStage) => void;
}) {
  return (
    <div className="seg w-fit font-mono text-sm">
      {STAGES.map((id) => (
        <button
          key={id}
          type="button"
          className="seg-item"
          data-active={value === id}
          disabled={busy}
          onClick={() => onChange(id)}
        >
          {markets.stage[id]}
        </button>
      ))}
    </div>
  );
}
