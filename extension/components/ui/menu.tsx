import { useState } from "react";
import { ChevronLeft, MoreVertical } from "lucide-react";
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

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<{ label: string; items: KebabMenuItem[] } | null>(
    null,
  );

  function close() {
    setOpen(false);
    setSub(null);
  }

  const current = sub ? sub.items : items;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setSub(null);
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
            className="absolute right-0 top-full z-[150] mt-1 max-h-60 min-w-32 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {sub && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSub(null);
                }}
                className="flex w-full items-center gap-1 px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                <ChevronLeft className="h-3 w-3" />
                {sub.label}
              </button>
            )}
            {current.length === 0 ? (
              <p className="px-3 py-2 text-xs italic text-muted-foreground">
                이동할 폴더가 없어요
              </p>
            ) : (
              current.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.submenu) {
                      setSub({ label: item.label, items: item.submenu });
                    } else {
                      close();
                      item.onClick?.();
                    }
                  }}
                  className={cn(
                    "block w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-accent cursor-pointer",
                    item.destructive &&
                      "text-destructive hover:bg-destructive/10",
                  )}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
