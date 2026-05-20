"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: typeof LibraryBig; match: (p: string) => boolean };

const TABS: Tab[] = [
  {
    href: "/",
    label: "라이브러리",
    icon: LibraryBig,
    match: (p) => p === "/" || p.startsWith("/category") || p.startsWith("/folder"),
  },
  { href: "/search", label: "검색", icon: Search, match: (p) => p.startsWith("/search") },
  { href: "/settings", label: "설정", icon: Settings, match: (p) => p.startsWith("/settings") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="메인 탭"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                  active
                    ? "text-[var(--color-para-project-fg)] font-semibold"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
