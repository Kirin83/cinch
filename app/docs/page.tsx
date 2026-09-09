import type { Metadata } from "next";
import { docs as copy } from "@/copy";
import { DocsArticle } from "@/components/DocsArticle";

export const metadata: Metadata = {
  title: "Docs",
  description: copy.lede,
  openGraph: {
    title: "Docs · cinch",
    description: copy.lede,
  },
};

export default function DocsPage() {
  return <DocsArticle />;
}
