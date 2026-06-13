export default function TodayLoading() {
  return (
    <div
      className="space-y-5 p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <div className="space-y-1.5">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <ul className="border-y border-border">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex h-16 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="h-5 w-5 animate-pulse rounded-full bg-muted" />
            </span>
            <div
              className={
                "flex h-full flex-1 flex-col justify-center gap-1.5" +
                (i < 2 ? " border-b border-border" : "")
              }
            >
              <span className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
              <span className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
