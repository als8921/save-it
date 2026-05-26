"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RemindCandidate } from "@/lib/remind/picker";

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function recordOpen(linkId: string) {
  fetch("/api/reminders/opened", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId }),
  }).catch(() => {});
}

interface RemindCardProps {
  candidate: RemindCandidate;
}

export function RemindCard({ candidate }: RemindCardProps) {
  const { link, folder } = candidate;
  const dots = Math.min(2, link.priority ?? 0);
  const host = hostOf(link.url);

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => recordOpen(link.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors active:bg-accent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{link.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {dots > 0 && (
            <span className="flex gap-0.5" aria-label={`우선도 ${dots}`}>
              {Array.from({ length: dots }).map((_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground" />
              ))}
            </span>
          )}
          <span className="truncate">{folder.name}</span>
          {host && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate font-mono">{host}</span>
            </>
          )}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}
