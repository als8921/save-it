"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Sparkles } from "lucide-react";
import type { RemindCandidate } from "@/lib/remind/picker";
import type { ParaCategory } from "@/lib/types";
import { BRAND_COLOR, PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "@/lib/para";
import { ParaBadge } from "@/components/primitives/para-badge";
import { RemindCard } from "./remind-card";

interface ParaGroup {
  key: string;
  cat: ParaCategory | null;
  label: string;
  items: RemindCandidate[];
}

function groupByPara(items: RemindCandidate[]): ParaGroup[] {
  const buckets = new Map<string, RemindCandidate[]>();
  for (const c of items) {
    const key = c.folder.para_category ?? "unassigned";
    const arr = buckets.get(key);
    if (arr) arr.push(c);
    else buckets.set(key, [c]);
  }
  const order = [...PARA_ORDER, "unassigned"];
  return order
    .filter((k) => buckets.has(k))
    .map((k) => ({
      key: k,
      cat: k === "unassigned" ? null : (k as ParaCategory),
      label: k === "unassigned" ? UNASSIGNED_TOKEN.label : PARA_TOKENS[k as ParaCategory].label,
      items: buckets.get(k)!,
    }));
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  return res.json() as Promise<{ items: RemindCandidate[] }>;
};

function formatToday() {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

export function TodayReminderSection() {
  const { data, error, isLoading } = useSWR("/api/reminders/today", fetcher);
  const count = data?.items.length ?? 0;

  // Compute the date on the client only to avoid SSR/timezone hydration drift.
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    setDateLabel(formatToday());
  }, []);

  return (
    <section className="space-y-5">
      <header className="space-y-1.5">
        <p className="h-4 text-xs font-medium tracking-wide text-muted-foreground">
          {dateLabel}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          {isLoading ? (
            "오늘의 링크를 고르는 중"
          ) : error ? (
            "잠시 문제가 생겼어요"
          ) : count > 0 ? (
            <>
              다시 볼 링크{" "}
              <span style={{ color: BRAND_COLOR }}>{count}개</span>
            </>
          ) : (
            "오늘은 다 비웠어요"
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          저장해 둔 링크를 잊지 않도록 매일 골라 드려요.
        </p>
      </header>

      {isLoading && (
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
      )}

      {error && !isLoading && (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          리마인드 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {!isLoading && !error && count === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-foreground">
            다시 볼 링크가 없어요
          </p>
          <p className="text-xs text-muted-foreground">
            새 링크를 저장하면 여기에서 다시 만나요.
          </p>
        </div>
      )}

      {!isLoading && !error && data && count > 0 && (
        <div className="border-y border-border">
          {groupByPara(data.items).map((g, gi) => (
            <section key={g.key}>
              <div
                className={
                  "flex items-center gap-1.5 pb-1.5 pt-3" +
                  (gi > 0 ? " mt-1 border-t border-border" : "")
                }
              >
                <ParaBadge category={g.cat} size="sm" className="opacity-70" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </span>
              </div>
              <ul>
                {g.items.map((c) => (
                  <li key={c.link.id} className="group">
                    <RemindCard candidate={c} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
