export default function SettingsLoading() {
  return (
    <div
      className="space-y-6 p-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <div className="space-y-1.5">
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>

      {[0, 1].map((s) => (
        <section key={s} className="space-y-2">
          <div className="ml-1 h-3 w-12 animate-pulse rounded bg-muted" />
          <div className="space-y-3 rounded-2xl border bg-card px-4 py-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
        </section>
      ))}
    </div>
  );
}
