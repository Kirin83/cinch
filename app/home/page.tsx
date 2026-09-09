import { loadHomeSummary } from "@/lib/queries";
import { HomeDashboard } from "@/components/HomeDashboard";
import { parseMarketStage } from "@/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadHomeSummary({ stage: parseMarketStage(sp.stage) });
  return <HomeDashboard data={data} />;
}
