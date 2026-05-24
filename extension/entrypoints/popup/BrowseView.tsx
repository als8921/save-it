import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Inbox,
  Plus,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { useSyncedState } from "../../lib/useSyncedState";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "../../lib/para";
import type { Folder, Link, ParaCategory } from "../../lib/types";

type ParaFilter = ParaCategory | "unassigned";

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

  async function openLink(link: Link) {
    if (browser?.tabs?.create) browser.tabs.create({ url: link.url, active: true });
    else window.open(link.url, "_blank", "noopener,noreferrer");
    if (!link.is_read) {
      await supabase
        .from("links")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", link.id);
      setLinks((prev) =>
        prev.map((l) =>
          l.id === link.id
            ? { ...l, is_read: true, read_at: new Date().toISOString() }
            : l,
        ),
      );
    }
  }

  function host(url: string) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

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

  const filterChips: { key: ParaFilter; letter: string; label: string; fg: string; bg: string }[] = [
    ...PARA_ORDER.map((cat) => ({
      key: cat as ParaFilter,
      letter: PARA_TOKENS[cat].letter,
      label: PARA_TOKENS[cat].label,
      fg: PARA_TOKENS[cat].fg,
      bg: PARA_TOKENS[cat].bg,
    })),
    {
      key: "unassigned" as ParaFilter,
      letter: "·",
      label: UNASSIGNED_TOKEN.label,
      fg: UNASSIGNED_TOKEN.fg,
      bg: UNASSIGNED_TOKEN.bg,
    },
  ];

  return (
    <div className="space-y-3 px-3 py-3">
      {/* Filter row */}
      <div className="grid grid-cols-5 gap-1.5">
        {filterChips.map((opt) => {
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(active ? null : opt.key)}
              title={opt.label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5 transition-colors cursor-pointer",
                active ? "border-transparent" : "border-border bg-card hover:bg-accent",
              )}
              style={
                active
                  ? { backgroundColor: opt.bg, borderColor: opt.fg }
                  : undefined
              }
            >
              <span
                className="text-[13px] font-bold leading-none"
                style={{ color: active ? opt.fg : "var(--muted-foreground)" }}
              >
                {opt.letter}
              </span>
              <span
                className={cn(
                  "text-[9px] leading-none tracking-tight",
                  active ? "" : "text-muted-foreground",
                )}
                style={active ? { color: opt.fg } : undefined}
              >
                {opt.key === "unassigned" ? "미지정" : opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* New folder shortcut — only when filtering by a category */}
      {filter &&
        (showNewFolder ? (
          <div className="space-y-2 rounded-xl border bg-card/60 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium">새 폴더</span>
              <span className="text-[10px] text-muted-foreground">
                {filter === "unassigned"
                  ? UNASSIGNED_TOKEN.label
                  : PARA_TOKENS[filter].label}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={cancelNewFolder}
                aria-label="취소"
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
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
              <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
                {folderError}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openNewFolder}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed bg-card/40 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <FolderPlus className="h-3 w-3" />
            <span>
              <span className="text-muted-foreground/80">
                {filter === "unassigned"
                  ? UNASSIGNED_TOKEN.label
                  : PARA_TOKENS[filter].label}
              </span>
              <span className="ml-1">폴더 추가</span>
            </span>
          </button>
        ))}

      {loading && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          불러오는 중…
        </p>
      )}

      {error && (
        <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div>
          {visibleFolders.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-muted-foreground">
              폴더가 없어요
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleFolders.map((folder) => {
                const folderLinks = links.filter(
                  (l) => l.folder_id === folder.id,
                );
                const isOpen = expanded.has(folder.id);
                const isUnassigned = folder.para_category === null;
                return (
                  <li
                    key={folder.id}
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <div className="group flex items-stretch">
                      <button
                        type="button"
                        onClick={() => toggleFolder(folder.id)}
                        aria-expanded={isOpen}
                        className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors active:bg-accent cursor-pointer"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {isUnassigned ? (
                          <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-xs font-medium">
                          {folder.name}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {folderLinks.length}
                        </span>
                      </button>
                      {onAddLinkToFolder && (
                        <button
                          type="button"
                          onClick={() => onAddLinkToFolder(folder.id)}
                          aria-label={`${folder.name}에 링크 추가`}
                          title="이 폴더에 링크 추가"
                          className="flex w-8 items-center justify-center border-l text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-foreground active:bg-accent cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="border-t bg-background/40 p-1.5">
                        {folderLinks.length === 0 ? (
                          <p className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
                            비어있음
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {folderLinks.map((link) => (
                              <li key={link.id}>
                                <LinkRow
                                  title={link.title}
                                  host={host(link.url)}
                                  isRead={link.is_read}
                                  priority={link.priority ?? 0}
                                  onClick={() => openLink(link)}
                                />
                              </li>
                            ))}
                          </ul>
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
  title,
  host,
  isRead,
  priority,
  onClick,
}: {
  title: string;
  host: string;
  isRead: boolean;
  priority: number;
  onClick: () => void;
}) {
  const dots = Math.min(2, priority);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors active:bg-accent cursor-pointer",
        isRead && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {dots > 0 && (
            <span className="flex gap-0.5" aria-label={`우선도 ${dots}`}>
              {Array.from({ length: dots }).map((_, i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-foreground" />
              ))}
            </span>
          )}
          {host && (
            <span className="truncate font-mono">{host}</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
