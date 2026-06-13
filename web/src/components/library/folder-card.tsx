import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { FolderActionsMenu } from "./folder-actions-menu";
import type { Folder } from "@/lib/types";

interface FolderCardProps {
  folder: Folder;
  linkCount: number;
}

export function FolderCard({ folder, linkCount }: FolderCardProps) {
  return (
    <div className="group flex items-stretch overflow-hidden rounded-xl border bg-card">
      <Link
        href={`/folder/${folder.id}`}
        className="flex flex-1 items-center gap-3 px-4 py-3 transition-colors active:bg-accent"
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {linkCount}
        </span>
      </Link>
      <div className="flex items-center pr-1">
        <FolderActionsMenu folder={folder} linkCount={linkCount} />
      </div>
    </div>
  );
}
