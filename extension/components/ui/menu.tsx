import { useState } from "react";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { createPortal } from "react-dom";
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
  const heading = sub ? sub.label : label;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setSub(null);
          setOpen(true);
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative flex max-h-[80%] w-full max-w-[300px] flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2">
                {sub && (
                  <button
                    type="button"
                    aria-label="뒤로"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSub(null);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <span className="text-[11px] font-medium text-muted-foreground">
                  {heading}
                </span>
              </div>
              <div className="overflow-y-auto p-1.5">
                {current.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs italic text-muted-foreground">
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
                        "block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer",
                        item.destructive &&
                          "text-destructive hover:bg-destructive/10",
                      )}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
