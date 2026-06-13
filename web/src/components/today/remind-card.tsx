"use client";

import { LinkFavicon } from "@/components/library/link-favicon";
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
      className="flex h-16 items-center gap-3 transition active:bg-accent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <LinkFavicon host={host} />
      </span>

      <div className="flex h-full min-w-0 flex-1 items-center gap-2 border-b border-border group-last:border-b-0">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug text-foreground line-clamp-1">
            {link.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{folder.name}</span>
            {host && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="truncate font-mono">{host}</span>
              </>
            )}
          </div>
        </div>

        {dots > 0 && (
          <span
            className="flex shrink-0 gap-0.5"
            aria-label={`우선도 ${dots}`}
          >
            {Array.from({ length: dots }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground" />
            ))}
          </span>
        )}
      </div>
    </a>
  );
}
