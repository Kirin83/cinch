import type { KeyboardEvent, MouseEvent } from "react";

function isControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, textarea, select, label"));
}

export function clickableRow(href: string, router: { push: (href: string) => void }) {
  return {
    role: "link" as const,
    tabIndex: 0,
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (isControl(e.target)) return;
      router.push(href);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (isControl(e.target)) return;
      e.preventDefault();
      router.push(href);
    },
  };
}
