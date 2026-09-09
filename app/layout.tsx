import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter, Geist_Mono } from "next/font/google";
import { Chrome } from "@/components/Chrome";
import { chrome as chromeCopy } from "@/copy";
import { SITE_ORIGIN } from "@/routes";
import "./globals.css";

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "cinch",
    template: "%s · cinch",
  },
  description: chromeCopy.tagline,
  icons: { icon: "/cinch-icon.webp" },
  openGraph: {
    title: "cinch",
    description: chromeCopy.tagline,
    images: [{ url: "/og/home/snapshot", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "cinch",
    description: chromeCopy.tagline,
    images: ["/og/home/snapshot"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans text-ink antialiased">
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
