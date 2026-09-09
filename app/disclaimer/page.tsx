import { disclaimer as copy } from "@/copy";

export default function DisclaimerPage() {
  return (
    <article className="max-w-2xl">
      <h1 className="font-display text-3xl tracking-tight">{copy.title}</h1>
      <ul className="mt-6 space-y-3 text-sm leading-relaxed">
        {copy.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}
