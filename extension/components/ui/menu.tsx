import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreVertical, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface KebabMenuItem {
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  submenu?: KebabMenuItem[];
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  label?: string;
}

interface Level {
  label: string;
  items: KebabMenuItem[];
}

interface Coords {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight: number;
}

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<Level[]>([]);
  const [coords, setCoords] = useState<Coords>({ right: 0, maxHeight: 240 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setStack([]);
  }

  function openMenu() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 메뉴는 fixed지만 transform 조상(패널) 기준으로 위치한다. 패널 경계 안에서 위/아래 플립.
    const boundary = el.closest("[data-menu-boundary]");
    const prect = boundary
      ? boundary.getBoundingClientRect()
      : ({
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        } as DOMRect);
    const margin = 8;
    const spaceBelow = prect.bottom - rect.bottom - margin;
    const spaceAbove = rect.top - prect.top - margin;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const right = Math.max(margin, prect.right - rect.right);
    setCoords(
      openUp
        ? {
            right,
            bottom: prect.bottom - rect.top + 4,
            maxHeight: Math.max(96, spaceAbove),
          }
        : {
            right,
            top: rect.bottom - prect.top + 4,
            maxHeight: Math.max(96, spaceBelow),
          },
    );
    setStack([]);
    setOpen(true);
  }

  const currentLevel = stack[stack.length - 1];
  const current = currentLevel ? currentLevel.items : items;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
          open && "bg-accent text-foreground",
        )}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          {/* 바깥 클릭 감지 (투명, 클릭 통과 방지) */}
          <div
            className="fixed inset-0 z-[140]"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          />
          <div
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              right: coords.right,
              maxHeight: coords.maxHeight,
            }}
            className="z-[150] flex min-w-36 max-w-[260px] flex-col overflow-y-auto rounded-lg border border-border bg-[oklch(0.985_0_0)] py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 border-b border-border/60 px-1 py-0.5">
              {currentLevel ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStack((s) => s.slice(0, -1));
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {currentLevel.label}
                </button>
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                aria-label="닫기"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.06] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {current.length === 0 ? (
              <p className="px-3 py-2 text-xs italic text-muted-foreground">
                폴더가 없어요
              </p>
            ) : (
              current.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.submenu) {
                      setStack((s) => [
                        ...s,
                        { label: item.label, items: item.submenu! },
                      ]);
                    } else {
                      close();
                      item.onClick?.();
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/[0.06] cursor-pointer",
                    item.destructive &&
                      "text-destructive hover:bg-destructive/10",
                  )}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.submenu && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
