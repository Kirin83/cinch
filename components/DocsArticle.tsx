import Link from "next/link";
import { docs as copy } from "@/copy";
import { routes } from "@/routes";

const TOUR_LINKS: Record<string, { href: string; external?: boolean }> = {
  home: { href: routes.analytics },
  markets: { href: routes.home },
  live: { href: routes.live },
  stock: { href: `${routes.home}?tab=stock` },
  token: { href: `${routes.home}?tab=meme` },
  verify: { href: routes.verify },
  launch: { href: routes.launch, external: true },
  watch: { href: routes.watch },
  status: { href: routes.status },
};

export function DocsArticle() {
  return (
    <div>
      <header className="max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{copy.eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl tracking-tight">{copy.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{copy.lede}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={routes.analytics}
            className="shrink-0 rounded-[15px] bg-leaf px-5 py-2.5 text-sm font-semibold text-on-leaf hover:brightness-110"
          >
            {copy.tryHome}
          </Link>
          <Link
            href={routes.home}
            className="shrink-0 rounded-[15px] bg-elev px-5 py-2.5 text-sm font-semibold hover:bg-moss"
          >
            {copy.tryMarkets}
          </Link>
          <Link
            href={routes.verify}
            className="shrink-0 rounded-[15px] bg-elev px-5 py-2.5 text-sm font-semibold hover:bg-moss"
          >
            {copy.tryVerify}
          </Link>
        </div>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {copy.pillars.map((pillar) => (
          <div key={pillar.title} className="card-well px-4 py-4">
            <p className="font-display text-lg tracking-tight">{pillar.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <nav
          aria-label={copy.onThisPage}
          className="mb-10 lg:sticky lg:top-6 lg:mb-0"
        >
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-muted">
            {copy.onThisPage}
          </p>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {copy.toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-[11px] px-2 py-1.5 text-sm text-muted hover:bg-moss hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-2xl space-y-16">
          <section id="why" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.why.title}</h2>
            <div className="mt-4 space-y-4">
              {copy.why.paragraphs.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section id="start" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.start.title}</h2>
            <p className="mt-2 text-sm text-muted">{copy.start.lead}</p>
            <ol className="mt-6 space-y-3">
              {copy.start.steps.map((step) => (
                <li key={step.n} className="card-well flex gap-4 px-4 py-4">
                  <span className="font-mono text-sm text-leaf">{step.n}</span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="tour" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.tour.title}</h2>
            <p className="mt-2 text-sm text-muted">{copy.tour.lead}</p>
            <ul className="mt-6 space-y-3">
              {copy.tour.items.map((item) => {
                const link = TOUR_LINKS[item.id];
                return (
                  <li key={item.id} className="card-well px-4 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{item.title}</h3>
                      {link ? (
                        link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-spore hover:underline"
                          >
                            Open ↗
                          </a>
                        ) : (
                          <Link href={link.href} className="font-mono text-xs text-spore hover:underline">
                            Open
                          </Link>
                        )
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section id="numbers" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.numbers.title}</h2>
            <p className="mt-2 text-sm text-muted">{copy.numbers.lead}</p>
            <dl className="mt-6 space-y-3">
              {copy.numbers.items.map((row) => (
                <div key={row.term} className="card-well px-4 py-4">
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-leaf">{row.term}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{row.def}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="quality" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.quality.title}</h2>
            <p className="mt-2 text-sm text-muted">{copy.quality.lead}</p>
            <dl className="mt-6 space-y-3">
              {copy.quality.items.map((row) => (
                <div key={row.term} className="card-well px-4 py-4">
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-leaf">{row.term}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{row.def}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="stages" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.stages.title}</h2>
            <div className="mt-4 space-y-4">
              {copy.stages.paragraphs.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          </section>

          <section id="risk" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.risk.title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">{copy.risk.body}</p>
          </section>

          <section id="method" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.method.title}</h2>
            <p className="mt-2 text-sm text-muted">{copy.method.lead}</p>
            <ul className="mt-6 list-disc space-y-3 pl-5">
              {copy.method.items.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-muted">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section id="limits" className="scroll-mt-8">
            <h2 className="font-display text-2xl tracking-tight">{copy.limits.title}</h2>
            <ul className="mt-6 list-disc space-y-3 pl-5">
              {copy.limits.items.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-muted">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-6">
              <Link href={routes.disclaimer} className="text-sm text-spore hover:underline">
                {copy.disclaimerCta}
              </Link>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
