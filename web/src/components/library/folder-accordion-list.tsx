"use client";

import { useState } from "react";
import { FolderAccordionItem } from "./folder-accordion-item";
import type { Folder, Link as LinkRow } from "@/lib/types";

interface FolderAccordionListProps {
  items: { folder: Folder; links: LinkRow[] }[];
}

export function FolderAccordionList({ items }: FolderAccordionListProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="space-y-1">
      {items.map(({ folder, links }) => (
        <li key={folder.id}>
          <FolderAccordionItem
            folder={folder}
            links={links}
            expanded={openId === folder.id}
            onToggle={() =>
              setOpenId((prev) => (prev === folder.id ? null : folder.id))
            }
          />
        </li>
      ))}
    </ul>
  );
}
