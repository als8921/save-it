"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: 1, label: "하루 1번", hint: "아침" },
  { value: 2, label: "하루 2번", hint: "아침·저녁" },
  { value: 3, label: "하루 3번", hint: "아침·점심·저녁" },
] as const;

export function ReminderFrequency({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [saving, setSaving] = useState(false);

  async function select(value: number) {
    if (value === count || saving) return;
    const prev = count;
    setCount(value);
    setSaving(true);
    try {
      const res = await fetch("/api/reminders/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_count: value }),
      });
      if (!res.ok) setCount(prev);
    } catch {
      setCount(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        알림 횟수
      </h2>
      <div role="radiogroup" aria-label="알림 횟수" className="overflow-hidden rounded-2xl border bg-card">
        {OPTIONS.map((opt, i) => {
          const active = count === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              type="button"
              onClick={() => select(opt.value)}
              disabled={saving}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors active:bg-accent disabled:opacity-60",
                i > 0 && "border-t border-border"
              )}
            >
              <CalendarClock
                className={cn(
                  "h-5 w-5 shrink-0",
                  active
                    ? "text-[color:var(--color-para-project-fg)]"
                    : "text-muted-foreground"
                )}
              />
              <span className="flex-1 text-left font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "text-[color:var(--color-para-project-fg)]"
                    : "opacity-0"
                )}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
