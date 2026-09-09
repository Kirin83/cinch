import { live as copy } from "@/copy";
import { LiveFeed } from "@/components/LiveFeed";

export const dynamic = "force-dynamic";

export default function LivePage() {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">{copy.title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{copy.subtitle}</p>
      <div className="mt-8">
        <LiveFeed />
      </div>
    </div>
  );
}
