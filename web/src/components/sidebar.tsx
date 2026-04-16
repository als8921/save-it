"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus, Inbox, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Folder, ParaCategory } from "@/lib/types";
import { PARA_LABELS, PARA_ORDER } from "@/lib/types";

interface SidebarProps {
  folders: Folder[];
  userEmail: string;
}

export function Sidebar({ folders, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const unassignedFolders = folders.filter((f) => f.para_category === null);
  const groupedFolders = PARA_ORDER.map((category) => ({
    category,
    label: PARA_LABELS[category],
    folders: folders.filter((f) => f.para_category === category),
  }));

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between p-4">
        <Link href="/" className="text-lg font-bold">
          Save It
        </Link>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* 미지정 */}
          {unassignedFolders.map((folder) => (
            <Link
              key={folder.id}
              href={`/folder/${folder.id}`}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                pathname === `/folder/${folder.id}`
                  ? "bg-accent font-medium"
                  : "text-muted-foreground"
              }`}
            >
              <Inbox className="h-4 w-4" />
              {folder.name}
            </Link>
          ))}

          {/* PARA categories */}
          {groupedFolders.map(({ category, label, folders: catFolders }) => (
            <div key={category} className="mt-4">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <Link href={`/folder/new?category=${category}`}>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </Link>
              </div>
              {catFolders.length === 0 ? (
                <p className="px-3 py-1 text-xs text-muted-foreground">
                  폴더 없음
                </p>
              ) : (
                catFolders.map((folder) => (
                  <Link
                    key={folder.id}
                    href={`/folder/${folder.id}`}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                      pathname === `/folder/${folder.id}`
                        ? "bg-accent font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {folder.name}
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3">
        <p className="truncate px-3 py-1 text-xs text-muted-foreground">
          {userEmail}
        </p>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
