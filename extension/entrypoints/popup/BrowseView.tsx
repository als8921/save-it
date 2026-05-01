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

const FILTER_OPTIONS: { key: ParaFilter; label: string; short: string }[] = [
  ...PARA_ORDER.map((cat) => ({
    key: cat as ParaFilter,
    label: PARA_LABELS[cat],
    short: PARA_LABELS[cat][0],
  })),
  { key: "unassigned", label: "미지정", short: "미" },
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
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFilter(filter === opt.key ? null : opt.key)}
            title={opt.label}
            className={cn(
              "h-10 w-10 rounded-full border text-sm font-semibold transition-colors cursor-pointer",
              filter === opt.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            {opt.short}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          불러오는 중...
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && !error && (
        <div className="space-y-1">
          {visibleFolders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              폴더가 없어요
            </p>
          ) : (
            visibleFolders.map((folder) => {
              const folderLinks = links.filter(
                (l) => l.folder_id === folder.id
              );
              const isOpen = expanded.has(folder.id);
              return (
                <div key={folder.id}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium">
                        {folder.name}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {folderLinks.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="ml-4 space-y-0.5 mt-0.5 mb-1">
                      {folderLinks.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground px-2 py-1">
                          비어있음
                        </p>
                      ) : (
                        folderLinks.map((link) => (
                          <LinkRow
                            key={link.id}
                            title={link.title}
                            host={host(link.url)}
                            onClick={() => openLink(link.url)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  title,
  host,
  onClick,
}: {
  title: string;
  host: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-accent transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs truncate">{title}</div>
        {host && (
          <div className="text-[10px] text-muted-foreground truncate">
            {host}
          </div>
        )}
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
