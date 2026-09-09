"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { chrome as chromeCopy } from "@/copy";
import { routes } from "@/routes";
import { prefetchLiveBoard } from "@/lib/livePrefetch";

const tabs = [
  { href: routes.analytics, label: chromeCopy.nav.home },
  { href: routes.home, label: chromeCopy.nav.markets },
  { href: routes.live, label: chromeCopy.nav.live },
  { href: routes.verify, label: chromeCopy.nav.verify },
] as const;

function tabActive(path: string, href: string) {
  if (href === routes.home) return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function MobileTabBar() {
  const path = usePathname();

  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map((item) => {
        const on = tabActive(path, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={on ? "true" : undefined}
            className="tabbar-item"
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
