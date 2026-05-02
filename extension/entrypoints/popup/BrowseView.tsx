import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderPlus,
  Plus,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { useSyncedState } from "../../lib/useSyncedState";
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

interface BrowseViewProps {
  userId: string;
  onAddLinkToFolder?: (folderId: string) => void;
}

export function BrowseView({ userId, onAddLinkToFolder }: BrowseViewProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useSyncedState<ParaFilter | null>(
    "saveit_browse_filter",
    null,
  );
  const [expandedIds, setExpandedIds] = useSyncedState<string[]>(
    "saveit_expanded_folders",
    [],
  );
  const expanded = useMemo(() => new Set(expandedIds), [expandedIds]);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");

  useEffect(() => {
    setShowNewFolder(false);
    setNewFolderName("");
    setFolderError("");
  }, [filter]);

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
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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

  const activeFilterOption = filter
    ? FILTER_OPTIONS.find((o) => o.key === filter)
    : null;

  function openNewFolder() {
    setNewFolderName("");
    setFolderError("");
    setShowNewFolder(true);
  }

  function cancelNewFolder() {
    setShowNewFolder(false);
    setNewFolderName("");
    setFolderError("");
  }

  async function handleCreateFolder() {
    if (!filter || !newFolderName.trim()) return;
    setCreatingFolder(true);
    setFolderError("");
    const para = filter === "unassigned" ? null : filter;
    const { data, error } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: newFolderName.trim(),
        para_category: para,
      })
      .select("*")
      .single();
    setCreatingFolder(false);
    if (error) {
      setFolderError(
        error.code === "23505"
          ? "이미 같은 이름의 폴더가 있어요"
          : error.message,
      );
      return;
    }
    const created = data as Folder;
    setFolders((prev) => [...prev, created]);
    setNewFolderName("");
    setShowNewFolder(false);
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
                    : "border-rule bg-card hover:bg-accent",
                )}
              >
                {opt.key === "unassigned" ? (
                  <span className="text-[11px] leading-none tracking-tight">
                    {opt.label}
                  </span>
                ) : (
                  <>
                    <span
                      className="font-serif text-[18px] font-black leading-none"
                      style={{ fontVariationSettings: "'opsz' 144" }}
                    >
                      {opt.letter}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] leading-none tracking-tight",
                        active
                          ? "text-primary-foreground/85"
                          : "text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeFilterOption &&
        (showNewFolder ? (
          <div className="rounded-md border border-rule bg-card/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="eyebrow">새 폴더</span>
              <span className="font-serif text-[12px] font-black leading-none">
                {activeFilterOption.letter}
              </span>
              <span className="text-[10px] text-muted-foreground tracking-tight">
                {activeFilterOption.label}
              </span>
              <span className="grow leader-dot h-px" />
              <button
                type="button"
                onClick={cancelNewFolder}
                aria-label="취소"
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex gap-1.5">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") cancelNewFolder();
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
              >
                {creatingFolder ? "…" : "생성"}
              </Button>
            </div>
            {folderError && (
              <p className="text-xs text-destructive border-l-2 border-destructive pl-2">
                {folderError}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openNewFolder}
            className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-rule bg-card/40 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <FolderPlus className="h-3 w-3" />
            <span>
              <span className="text-muted-foreground/80">
                {activeFilterOption.label}
              </span>
              <span className="ml-1">폴더 추가</span>
            </span>
          </button>
        ))}

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
                  (l) => l.folder_id === folder.id,
                );
                const isOpen = expanded.has(folder.id);
                return (
                  <li key={folder.id}>
                    <div className="group flex items-stretch rounded hover:bg-accent transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleFolder(folder.id)}
                        className="flex flex-1 min-w-0 items-baseline gap-2 px-1.5 py-1.5 text-xs text-left cursor-pointer"
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
                      {onAddLinkToFolder && (
                        <button
                          type="button"
                          onClick={() => onAddLinkToFolder(folder.id)}
                          aria-label={`${folder.name}에 링크 추가`}
                          title="이 폴더에 링크 추가"
                          className="flex h-7 w-7 items-center justify-center self-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-card transition-all cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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
