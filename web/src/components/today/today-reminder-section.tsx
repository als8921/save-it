"use client";

import useSWR from "swr";
import type { RemindCandidate } from "@/lib/remind/picker";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  return res.json() as Promise<{ items: RemindCandidate[] }>;
};

function recordOpen(linkId: string) {
  fetch("/api/reminders/opened", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId }),
  }).catch(() => {});
}

export function TodayReminderSection() {
  const { data, error, isLoading } = useSWR(
    "/api/reminders/today",
    fetcher
  );

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
        오늘 다시 볼 링크
      </h2>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-md border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          리마인드 목록을 불러오지 못했어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          오늘 다시 볼 링크가 없어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li
              key={c.link.id}
              className="rounded-md border border-border bg-card p-3"
            >
              <a
                href={c.link.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => recordOpen(c.link.id)}
                className="block"
              >
                <div className="text-sm font-medium line-clamp-1">
                  {c.link.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {c.folder.name} · {c.link.url}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
