"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Link as LinkRow } from "@/lib/types";
import { LinkActionsMenu } from "./link-actions-menu";
import { LinkFavicon } from "./link-favicon";

interface LinkCardProps {
  link: LinkRow;
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function LinkCard({ link }: LinkCardProps) {
  const router = useRouter();

  function markAsRead() {
    if (link.is_read) return;
    void (async () => {
      const supabase = createClient();
      await supabase
        .from("links")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", link.id);
      router.refresh();
    })();
  }

  const dots = Math.min(2, link.priority ?? 0);

  return (
    <div className="group flex items-center gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markAsRead}
        onAuxClick={markAsRead}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-left",
          link.is_read && "opacity-55"
        )}
      >
        <LinkFavicon host={hostOf(link.url)} />
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
            <span className="truncate font-mono">{hostOf(link.url)}</span>
          </div>
        </div>
      </a>
      <LinkActionsMenu link={link} />
    </div>
  );
}
