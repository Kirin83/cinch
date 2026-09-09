"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { chrome as chromeCopy } from "@/copy";
import { routes } from "@/routes";
import { prefetchLiveBoard } from "@/lib/livePrefetch";

const links = [
  { href: routes.analytics, label: chromeCopy.nav.home },
  { href: routes.home, label: chromeCopy.nav.markets },
  { href: routes.live, label: chromeCopy.nav.live },
  { href: routes.verify, label: chromeCopy.nav.verify },
  { href: routes.docs, label: chromeCopy.nav.docs },
];

export function Nav() {
  const path = usePathname();

  return (
    <nav className="flex items-center gap-0.5" aria-label="Primary">
      {links.map((item) => {
        const on =
          item.href === routes.home
            ? path === "/"
            : path === item.href || path.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={on ? "true" : undefined}
            className="seg-item inline-flex items-center"
            onPointerEnter={() => {
              if (item.href === routes.live) prefetchLiveBoard();
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
