import { MoreVertical } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface KebabMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface KebabMenuProps {
  items: KebabMenuItem[];
  label?: string;
}

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
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
              setOpen(false);
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative flex max-h-[80%] w-full max-w-[300px] flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="shrink-0 border-b px-3 py-2 text-[11px] font-medium text-muted-foreground">
                {label}
              </p>
              <div className="overflow-y-auto p-1.5">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      item.onClick();
                    }}
                    className={cn(
                      "block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer",
                      item.destructive &&
                        "text-destructive hover:bg-destructive/10",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
