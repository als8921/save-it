"use client";

import { PARA_TOKENS, UNASSIGNED_TOKEN } from "@/lib/para";
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
  const para = folder.para_category;
  const token = para ? PARA_TOKENS[para] : UNASSIGNED_TOKEN;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => recordOpen(link.id)}
      style={{ backgroundColor: token.bg }}
      className="relative block rounded-2xl px-4 py-4 transition-transform active:scale-[0.98]"
    >
      {dots > 0 && (
        <span
          className="absolute right-3 top-3 flex gap-0.5"
          aria-label={`우선도 ${dots}`}
        >
          {Array.from({ length: dots }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground" />
          ))}
        </span>
      )}

      <div className="pr-10 text-sm font-semibold text-foreground line-clamp-2">
        {link.title}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {folder.name}
        {host && (
          <>
            {" · "}
            <span className="font-mono">{host}</span>
          </>
        )}
      </div>
    </a>
  );
}
