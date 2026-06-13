"use client";

import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkCard } from "./link-card";
import { FolderActionsMenu } from "./folder-actions-menu";
import type { Folder, Link as LinkRow } from "@/lib/types";

interface FolderAccordionItemProps {
  folder: Folder;
  links: LinkRow[];
  expanded: boolean;
  onToggle: () => void;
}

export function FolderAccordionItem({
  folder,
  links,
  expanded,
  onToggle,
}: FolderAccordionItemProps) {
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
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`folder-${id}-content`}
          className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">{name}</span>
        </button>
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
