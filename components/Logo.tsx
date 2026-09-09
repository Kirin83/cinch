export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cinch-mark.webp"
        alt=""
        width={256}
        height={256}
        className={compact ? "h-8 w-8" : "h-9 w-9"}
        decoding="async"
      />
      <span className="display hidden text-[15px] sm:inline">cinch</span>
    </span>
  );
}
