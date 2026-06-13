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

interface Coords {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight: number;
}

export function KebabMenu({ items, label = "메뉴" }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ right: 0, maxHeight: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        menuRef.current &&
        !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const margin = 8;
            const spaceBelow = window.innerHeight - rect.bottom - margin;
            const spaceAbove = rect.top - margin;
            // 아래 공간이 좁고 위가 더 넓으면 버튼 위로 펼친다
            const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
            setCoords({
              right: window.innerWidth - rect.right,
              ...(openUp
                ? {
                    bottom: window.innerHeight - rect.top + 4,
                    maxHeight: spaceAbove,
                  }
                : { top: rect.bottom + 4, maxHeight: spaceBelow }),
            });
          }
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              right: coords.right,
              maxHeight: coords.maxHeight,
            }}
            className="z-[100] min-w-28 max-w-56 overflow-y-auto rounded-lg border bg-card p-1 text-xs shadow-md"
          >
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
                  "block w-full truncate rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent cursor-pointer",
                  item.destructive && "text-destructive hover:bg-destructive/10",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
