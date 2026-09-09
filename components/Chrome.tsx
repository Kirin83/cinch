import type { ReactNode } from "react";
import Link from "next/link";
import { FOOTER, chrome as chromeCopy } from "@/copy";
import { routes } from "@/routes";
import { SearchBox } from "@/components/SearchBox";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";

const mobileNav = [
  { href: routes.analytics, label: chromeCopy.nav.home, external: false },
  { href: routes.home, label: chromeCopy.nav.markets, external: false },
  { href: routes.live, label: chromeCopy.nav.live, external: false },
  { href: routes.verify, label: chromeCopy.nav.verify, external: false },
  { href: routes.launch, label: chromeCopy.nav.launch, external: true },
  { href: routes.docs, label: chromeCopy.nav.docs, external: false },
];

export function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="atmosphere" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-16 pt-4">
        <header className="rise relative mb-6 flex items-center justify-between gap-3">
          <Link href={routes.analytics} className="relative z-10 flex shrink-0 items-center" aria-label="cinch home">
            <Logo />
          </Link>
          <div className="seg pointer-events-none absolute left-1/2 hidden h-12 -translate-x-1/2 pl-1.5 pr-1.5 md:pointer-events-auto md:flex">
            <Nav />
          </div>
          <a
            href={routes.launch}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 rounded-[15px] bg-leaf px-5 py-2.5 text-sm font-semibold text-on-leaf hover:brightness-110"
          >
            {chromeCopy.nav.launch}
          </a>
        </header>

        <nav className="mb-4 flex gap-3 px-1 text-sm text-muted md:hidden" aria-label="Mobile">
          {mobileNav.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ),
          )}
        </nav>

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
    </div>
  );
}
