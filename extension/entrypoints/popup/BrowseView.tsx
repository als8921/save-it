import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import {
  PARA_LABELS,
  PARA_ORDER,
  type Folder,
  type Link,
  type ParaCategory,
} from "../../lib/types";

type ParaFilter = ParaCategory | "unassigned";

const FILTER_OPTIONS: { key: ParaFilter; label: string; letter: string }[] = [
  ...PARA_ORDER.map((cat) => ({
    key: cat as ParaFilter,
    label: PARA_LABELS[cat],
    letter: PARA_LABELS[cat][0],
  })),
  { key: "unassigned", label: "미지정", letter: "U" },
];

export function BrowseView() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<ParaFilter | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      supabase
        .from("folders")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("links")
        .select("*")
        .order("created_at", { ascending: false }),
    ]).then(([f, l]) => {
      if (f.error) setError(f.error.message);
      else setFolders((f.data ?? []) as Folder[]);
      if (l.error) setError(l.error.message);
      else setLinks((l.data ?? []) as Link[]);
      setLoading(false);
    });
  }, []);

  const visibleFolders = folders.filter((f) => {
    if (filter === null) return true;
    if (filter === "unassigned") return f.para_category === null;
    return f.para_category === filter;
  });

  function toggleFolder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openLink(url: string) {
    if (browser?.tabs?.create) browser.tabs.create({ url, active: true });
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  function host(url: string) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow">filter</span>
          <span className="grow leader-dot h-px" />
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {visibleFolders.length} / {folders.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(active ? null : opt.key)}
                title={opt.label}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 transition-colors cursor-pointer",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-rule bg-card hover:bg-accent"
                )}
              >
                <span
                  className="font-serif text-[18px] font-bold leading-none"
                  style={{ fontVariationSettings: "'opsz' 144" }}
                >
                  {opt.letter}
                </span>
                <span
                  className={cn(
                    "text-[9px] leading-none tracking-tight",
                    active ? "text-primary-foreground/85" : "text-muted-foreground"
                  )}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <span className="eyebrow">loading</span>
          <span className="grow leader-dot h-px" />
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive border-l-2 border-destructive pl-2">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div>
          {visibleFolders.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              폴더가 없어요
            </p>
          ) : (
            <ul className="space-y-px">
              {visibleFolders.map((folder, idx) => {
                const folderLinks = links.filter(
                  (l) => l.folder_id === folder.id
                );
                const isOpen = expanded.has(folder.id);
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.id)}
                      className="group w-full flex items-baseline gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground self-center" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground self-center" />
                      )}
                      <span className="truncate font-medium">
                        {folder.name}
                      </span>
                      <span className="grow leader-dot h-px self-center" />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {folderLinks.length}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="ml-7 mr-1 mb-1 space-y-px">
                        {folderLinks.length === 0 ? (
                          <p className="text-[11px] italic text-muted-foreground px-2 py-1">
                            비어있음
                          </p>
                        ) : (
                          folderLinks.map((link, i) => (
                            <LinkRow
                              key={link.id}
                              index={i + 1}
                              title={link.title}
                              host={host(link.url)}
                              onClick={() => openLink(link.url)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  index,
  title,
  host,
  onClick,
}: {
  index: number;
  title: string;
  host: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-baseline gap-2 rounded px-2 py-1.5 text-left hover:bg-accent transition-colors cursor-pointer"
    >
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0 self-center">
        {String(index).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs truncate">{title}</div>
        {host && (
          <div className="font-mono text-[10px] text-muted-foreground truncate">
            {host}
          </div>
        )}
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
    </button>
  );
}
