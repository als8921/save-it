"use client";

import useSWR from "swr";
import type { RemindCandidate } from "@/lib/remind/picker";
import { RemindCard } from "./remind-card";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  return res.json() as Promise<{ items: RemindCandidate[] }>;
};

export function TodayReminderSection() {
  const { data, error, isLoading } = useSWR(
    "/api/reminders/today",
    fetcher
  );

  return (
    <section className="space-y-2">
      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          리마인드 목록을 불러오지 못했어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          오늘 다시 볼 링크가 없어요.
        </div>
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((c) => (
            <li key={c.link.id}>
              <RemindCard candidate={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
