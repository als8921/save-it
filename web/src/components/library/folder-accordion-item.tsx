"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkCard } from "./link-card";
import { FolderActionsMenu } from "./folder-actions-menu";
import type { Folder, Link as LinkRow } from "@/lib/types";

interface FolderAccordionItemProps {
  folder: Folder;
  links: LinkRow[];
}

export function FolderAccordionItem({ folder, links }: FolderAccordionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { id, name } = folder;

  return (
    <div>
      <div
        className={cn(
          "group flex items-stretch rounded-lg transition-colors",
          expanded ? "bg-accent" : "hover:bg-accent/60"
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`folder-${id}-content`}
          className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">{name}</span>
        </button>
        <Link
          href={`/folder/${id}`}
          aria-label={`${name} 폴더 페이지 열기`}
          title="폴더 페이지에서 관리"
          className="flex w-9 items-center justify-center text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-foreground"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <div className="flex items-center pr-0.5">
          <FolderActionsMenu folder={folder} linkCount={links.length} />
        </div>
      </div>
      {expanded && (
        <div id={`folder-${id}-content`} className="mb-1 mt-0.5 pl-3">
          {links.length === 0 ? (
            <p className="px-2 py-2 text-xs italic text-muted-foreground">
              비어있음
            </p>
          ) : (
            <ul className="space-y-0.5">
              {links.map((l) => (
                <li key={l.id}>
                  <LinkCard link={l} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
