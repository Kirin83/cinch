export default function Loading() {
  return (
    <ul className="mt-6 space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="card-well px-4 py-3">
          <div className="load-skel h-6 w-full" style={{ animationDelay: `${i * 60}ms` }} />
        </li>
      ))}
    </ul>
  );
}
