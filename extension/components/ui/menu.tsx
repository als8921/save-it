import { useState } from "react";
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

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<Level[]>([]);

  function close() {
    setOpen(false);
    setStack([]);
  }

  const currentLevel = stack[stack.length - 1];
  const current = currentLevel ? currentLevel.items : items;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setStack([]);
          setOpen((v) => !v);
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
            className="absolute right-0 top-full z-[150] mt-1 flex max-h-60 min-w-36 flex-col overflow-y-auto rounded-lg border border-border bg-muted py-1 shadow-lg"
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
