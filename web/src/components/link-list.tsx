"use client";

import { ExternalLink, Circle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { Link } from "@/lib/types";

const PRIORITY_LABELS = ["", "중요", "매우 중요"];

interface LinkListProps {
  links: Link[];
}

export function LinkList({ links }: LinkListProps) {
  const router = useRouter();

  async function handleClick(link: Link) {
    if (!link.is_read) {
      const supabase = createClient();
      await supabase
        .from("links")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", link.id);
      router.refresh();
    }
    window.open(link.url, "_blank");
  }

  async function toggleRead(e: React.MouseEvent, link: Link) {
    e.stopPropagation();
    const supabase = createClient();
    await supabase
      .from("links")
      .update({
        is_read: !link.is_read,
        read_at: !link.is_read ? new Date().toISOString() : null,
      })
      .eq("id", link.id);
    router.refresh();
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-muted-foreground">저장된 링크가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <div
          key={link.id}
          onClick={() => handleClick(link)}
          className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent ${
            link.is_read ? "opacity-60" : ""
          }`}
        >
          <button
            onClick={(e) => toggleRead(e, link)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {link.is_read ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={`truncate font-medium ${
                  link.is_read ? "line-through" : ""
                }`}
              >
                {link.title}
              </h3>
              {link.priority > 0 && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {PRIORITY_LABELS[link.priority]}
                </Badge>
              )}
            </div>
            {link.description && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {link.description}
              </p>
            )}
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {link.url}
            </p>
          </div>

          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </div>
      ))}
    </div>
  );
}
