import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
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
  const [coords, setCoords] = useState<Coords>({ right: 0, maxHeight: 0 });
  const [container, setContainer] = useState<Element | DocumentFragment | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    setStack([]);
  }

  function openMenu() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const root = el.getRootNode();
    // content script는 shadow root, 팝업은 document.body로 포털 (overflow 탈출 + 스타일 유지)
    setContainer(root instanceof ShadowRoot ? root : document.body);
    // 플립 기준은 viewport가 아니라 위젯 패널(경계). 패널 밖으로 흘러내리지 않게.
    const boundary = el.closest("[data-menu-boundary]");
    const brect = boundary
      ? boundary.getBoundingClientRect()
      : ({ top: 0, bottom: window.innerHeight } as DOMRect);
    const margin = 8;
    const spaceBelow = brect.bottom - rect.bottom - margin;
    const spaceAbove = rect.top - brect.top - margin;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    setCoords({
      right: Math.max(margin, window.innerWidth - rect.right),
      ...(openUp
        ? {
            bottom: window.innerHeight - rect.top + 4,
            maxHeight: Math.max(96, spaceAbove),
          }
        : { top: rect.bottom + 4, maxHeight: Math.max(96, spaceBelow) }),
    });
    setStack([]);
    setOpen(true);
  }

  const currentLevel = stack[stack.length - 1];
  const current = currentLevel ? currentLevel.items : items;

  const overlay = (
    <>
      {/* 바깥 클릭 감지 (투명, 클릭 통과 방지) */}
      <div
        className="fixed inset-0 z-[2147483640]"
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
        className="z-[2147483641] flex min-w-36 max-w-[260px] flex-col overflow-y-auto rounded-lg border border-border bg-[oklch(0.985_0_0)] py-1 font-sans text-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {currentLevel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStack((s) => s.slice(0, -1));
            }}
            className="flex items-center gap-1 border-b border-border/60 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {currentLevel.label}
          </button>
        )}
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
                item.destructive && "text-destructive hover:bg-destructive/10",
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
  );

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
      {open && container && createPortal(overlay, container)}
    </div>
  );
}
