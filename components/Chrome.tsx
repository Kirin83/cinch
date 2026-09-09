import type { ReactNode } from "react";
import Link from "next/link";
import { FOOTER, chrome as chromeCopy } from "@/copy";
import { routes } from "@/routes";
import { SearchBox } from "@/components/SearchBox";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { MobileTabBar } from "@/components/MobileTabBar";

export function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="atmosphere" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-4 md:pb-16">
        <header className="rise relative mb-6 flex items-center justify-between gap-3">
          <Link href={routes.analytics} className="relative z-10 flex shrink-0 items-center" aria-label="cinch home">
            <Logo />
          </Link>
          <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:pointer-events-auto md:flex">
            <div className="seg h-12 pl-1.5 pr-1.5">
              <Nav />
            </div>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <Link
              href={routes.docs}
              className="rounded-[15px] px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink md:hidden"
            >
              {chromeCopy.nav.docs}
            </Link>
            <a
              href={routes.launch}
              target="_blank"
              rel="noreferrer"
              className="rounded-[15px] bg-leaf px-4 py-2.5 text-sm font-semibold text-on-leaf hover:brightness-110 md:px-5"
            >
              {chromeCopy.nav.launch}
            </a>
          </div>
        </header>

        <div className="mb-2">
          <SearchBox />
        </div>

        <main className="rise flex-1 py-8">{children}</main>

        <footer className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-muted">
          <p>{FOOTER}</p>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            <Link href={routes.verify} className="text-spore hover:underline">
              Verify
            </Link>
            <Link href={routes.disclaimer} className="text-spore hover:underline">
              Disclaimer
            </Link>
            <Link href={routes.docs} className="text-spore hover:underline">
              Docs
            </Link>
            <Link href={routes.watch} className="text-spore hover:underline">
              Watch
            </Link>
            <Link href={routes.status} className="text-spore hover:underline">
              Status
            </Link>
          </p>
        </footer>
      </div>
      <MobileTabBar />
    </div>
  );
}
