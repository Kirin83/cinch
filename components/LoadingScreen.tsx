export function LoadingScreen({
  label = "Reading Hood…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex min-h-[52vh] flex-col items-center justify-center py-16"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="load-ring" aria-hidden />
      <p className="font-display mt-6 text-2xl tracking-tight">cinch</p>
      <p className="mt-2 font-mono text-xs text-muted">
        <span className="load-dot">●</span> {label}
      </p>
      <div className="mt-8 w-full max-w-md">
        <div className="load-scan mb-4 rounded-full" />
        <div className="space-y-2">
          <div className="load-skel" style={{ animationDelay: "0ms" }} />
          <div className="load-skel w-[86%]" style={{ animationDelay: "120ms" }} />
          <div className="load-skel w-[72%]" style={{ animationDelay: "240ms" }} />
        </div>
      </div>
    </div>
  );
}

export function LoadingInline({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="mt-8 flex items-center gap-2 font-mono text-sm text-muted" role="status">
      <span className="load-ring !h-4 !w-4 !border-[1.5px]" aria-hidden />
      {label}
    </p>
  );
}
