import { Suspense } from "react";
import { verify as copy } from "@/copy";
import { VerifyForm } from "@/components/VerifyForm";
import { LoadingInline } from "@/components/LoadingScreen";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">{copy.title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{copy.subtitle}</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingInline label="Verify…" />}>
          <VerifyForm />
        </Suspense>
      </div>
    </div>
  );
}
