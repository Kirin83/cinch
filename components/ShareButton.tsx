"use client";

import { buttons } from "@/copy";

export function ShareButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="rounded-[15px] bg-moss px-3 py-1.5 font-mono text-xs font-semibold text-muted hover:text-ink"
    >
      {buttons.shareCard}
    </a>
  );
}

export function ShareOnX({ text, url }: { text: string; url: string }) {
  const href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-[15px] bg-moss px-3 py-1.5 font-mono text-xs font-semibold text-muted hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {buttons.shareOnX}
    </a>
  );
}
