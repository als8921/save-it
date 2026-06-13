import { FolderOpen, FolderPlus, Globe, Inbox, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { KebabMenu, type KebabMenuItem } from "../../components/ui/menu";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
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
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const [filter, setFilter] = useSyncedState<ParaFilter | null>(
    "saveit_browse_filter",
    null,
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");

  useEffect(() => {
    setShowNewFolder(false);
    setNewFolderName("");
    setFolderError("");
    setSelectedFolderId(null);
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
    setSelectedFolderId((prev) => (prev === id ? null : id));
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

  async function updateLink(
    id: string,
    patch: { title?: string; description?: string | null; priority?: number; folder_id?: string | null },
  ) {
    const prev = links;
    setLinks((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from("links").update(patch).eq("id", id);
    if (error) {
      setLinks(prev);
      setError(error.message);
    }
  }

  async function deleteLink(id: string) {
    const prev = links;
    setLinks((cur) => cur.filter((l) => l.id !== id));
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) {
      setLinks(prev);
      setError(error.message);
    }
  }

  async function updateFolder(
    id: string,
    patch: { name?: string; para_category?: ParaCategory | null },
  ) {
    const { data, error } = await supabase
      .from("folders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      setError(
        error.code === "23505" ? "이미 같은 이름의 폴더가 있어요" : error.message,
      );
      return false;
    }
    setFolders((cur) => cur.map((f) => (f.id === id ? (data as Folder) : f)));
    return true;
  }

  async function deleteFolder(id: string) {
    const prevFolders = folders;
    const prevLinks = links;
    setFolders((cur) => cur.filter((f) => f.id !== id));
    setLinks((cur) => cur.filter((l) => l.folder_id !== id));
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      setFolders(prevFolders);
      setLinks(prevLinks);
      setError(error.message);
    }
  }

  function folderMenuItems(folder: Folder, linkCount: number): KebabMenuItem[] {
    return [
      { label: "수정", onClick: () => setEditingFolderId(folder.id) },
      {
        label: "삭제",
        destructive: true,
        onClick: () => {
          const msg =
            linkCount === 0
              ? "이 폴더를 삭제할까요?"
              : `이 폴더와 링크 ${linkCount}개가 함께 삭제됩니다. 삭제할까요?`;
          setConfirmState({ message: msg, onConfirm: () => deleteFolder(folder.id) });
        },
      },
    ];
  }

  function linkMenuItems(link: Link): KebabMenuItem[] {
    const items: KebabMenuItem[] = [
      { label: "수정", onClick: () => setEditingLinkId(link.id) },
    ];

    // 폴더 이동: PARA 카테고리별 폴더 + 미지정 영역(폴더 없음). 필터 칩과 같은 순서.
    const moveSubmenu: KebabMenuItem[] = [];
    for (const c of PARA_ORDER) {
      const groupFolders = folders.filter(
        (f) => f.para_category === c && f.id !== link.folder_id,
      );
      if (groupFolders.length === 0) continue;
      moveSubmenu.push({
        label: PARA_TOKENS[c].label,
        submenu: groupFolders.map((f) => ({
          label: f.name,
          onClick: () => updateLink(link.id, { folder_id: f.id }),
        })),
      });
    }
    // 미지정 영역으로 = 폴더에서 빼기 (이미 미지정이 아니면)
    if (link.folder_id !== null) {
      moveSubmenu.push({
        label: UNASSIGNED_TOKEN.label,
        onClick: () => updateLink(link.id, { folder_id: null }),
      });
    }
    if (moveSubmenu.length > 0) {
      items.push({ label: "폴더 이동", submenu: moveSubmenu });
    }

    items.push({
      label: "삭제",
      destructive: true,
      onClick: () => {
        setConfirmState({
          message: "이 링크를 삭제할까요?",
          onConfirm: () => deleteLink(link.id),
        });
      },
    });
    return items;
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
                "flex flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent py-1.5 transition-colors cursor-pointer",
                active ? "" : "bg-muted/50 hover:bg-accent",
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

      {/* New folder shortcut — only when filtering by a real PARA category (not 미지정) */}
      {filter && filter !== "unassigned" &&
        (showNewFolder ? (
          <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium">새 폴더</span>
              <span className="text-[10px] text-muted-foreground">
                {PARA_TOKENS[filter].label}
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
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <FolderPlus className="h-3 w-3" />
            <span>
              <span className="text-muted-foreground/80">
                {PARA_TOKENS[filter].label}
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

      {!loading && !error && filter === "unassigned" && (() => {
        const unassignedLinks = links.filter((l) => l.folder_id === null);
        return (
          <div>
            {unassignedLinks.length === 0 ? (
              <p className="py-6 text-center text-xs italic text-muted-foreground">
                저장된 링크가 없어요
              </p>
            ) : (
              <ul className="space-y-0.5">
                {unassignedLinks.map((link) => (
                  <li key={link.id}>
                    {editingLinkId === link.id ? (
                      <LinkEditForm
                        link={link}
                        onCancel={() => setEditingLinkId(null)}
                        onSave={(patch) => {
                          updateLink(link.id, patch);
                          setEditingLinkId(null);
                        }}
                      />
                    ) : (
                      <LinkRow
                        title={link.title}
                        host={host(link.url)}
                        isRead={link.is_read}
                        priority={link.priority ?? 0}
                        onClick={() => openLink(link)}
                        menu={<KebabMenu items={linkMenuItems(link)} label="링크 메뉴" />}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {!loading && !error && filter !== "unassigned" && (
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
                const isOpen = selectedFolderId === folder.id;
                const isUnassigned = folder.para_category === null;
                return (
                  <li key={folder.id}>
                    {editingFolderId === folder.id ? (
                      <FolderEditForm
                        folder={folder}
                        onCancel={() => setEditingFolderId(null)}
                        onSave={async (patch) => {
                          const ok = await updateFolder(folder.id, patch);
                          if (ok) setEditingFolderId(null);
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "group flex items-stretch rounded-lg transition-colors",
                          isOpen ? "bg-accent" : "hover:bg-accent/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFolder(folder.id)}
                          aria-expanded={isOpen}
                          className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer"
                        >
                          {isUnassigned ? (
                            <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1 truncate text-sm font-medium">
                            {folder.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {folderLinks.length}
                          </span>
                        </button>
                        {onAddLinkToFolder && (
                          <button
                            type="button"
                            onClick={() => onAddLinkToFolder(folder.id)}
                            aria-label={`${folder.name}에 링크 추가`}
                            title="이 폴더에 링크 추가"
                            className="flex w-8 items-center justify-center text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-foreground cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div className="flex items-center px-0.5">
                          <KebabMenu
                            items={folderMenuItems(folder, folderLinks.length)}
                            label="폴더 메뉴"
                          />
                        </div>
                      </div>
                    )}
                    {isOpen && (
                      <div className="mb-1 mt-0.5 pl-3">
                        {folderLinks.length === 0 ? (
                          <p className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
                            비어있음
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {folderLinks.map((link) => (
                              <li key={link.id}>
                                {editingLinkId === link.id ? (
                                  <LinkEditForm
                                    link={link}
                                    onCancel={() => setEditingLinkId(null)}
                                    onSave={(patch) => {
                                      updateLink(link.id, patch);
                                      setEditingLinkId(null);
                                    }}
                                  />
                                ) : (
                                  <LinkRow
                                    title={link.title}
                                    host={host(link.url)}
                                    isRead={link.is_read}
                                    priority={link.priority ?? 0}
                                    onClick={() => openLink(link)}
                                    menu={<KebabMenu items={linkMenuItems(link)} label="링크 메뉴" />}
                                  />
                                )}
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

      <ConfirmDialog
        open={confirmState !== null}
        message={confirmState?.message ?? ""}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
      />
    </div>
  );
}

function LinkRow({
  title,
  host,
  isRead,
  priority,
  onClick,
  menu,
}: {
  title: string;
  host: string;
  isRead: boolean;
  priority: number;
  onClick: () => void;
  menu?: ReactNode;
}) {
  const dots = Math.min(2, priority);
  return (
    <div className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer",
          isRead && "opacity-55",
        )}
      >
        <LinkFavicon host={host} />
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
            {host && <span className="truncate font-mono">{host}</span>}
          </div>
        </div>
      </button>
      {menu}
    </div>
  );
}

function LinkFavicon({ host }: { host: string }) {
  const [error, setError] = useState(false);
  if (!host || error) {
    return <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-4 w-4 shrink-0 rounded-sm"
      onError={() => setError(true)}
    />
  );
}

function LinkEditForm({
  link,
  onSave,
  onCancel,
}: {
  link: Link;
  onSave: (patch: { title: string; description: string | null; priority: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(link.title);
  const [priority, setPriority] = useState(link.priority ?? 0);
  return (
    <div className="space-y-2 rounded-lg border bg-card/60 p-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="h-8 text-xs"
      />
      <div className="flex gap-1">
        {[
          { v: 0, label: "보통" },
          { v: 1, label: "중요" },
          { v: 2, label: "매우" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setPriority(opt.v)}
            className={cn(
              "flex-1 rounded border py-1 text-[10px]",
              priority === opt.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={() =>
            onSave({ title: title.trim() || link.url, description: link.description, priority })
          }
        >
          저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

function FolderEditForm({
  folder,
  onSave,
  onCancel,
}: {
  folder: Folder;
  onSave: (patch: { name: string; para_category: ParaCategory | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [para, setPara] = useState<ParaCategory | "unassigned">(
    folder.para_category ?? "unassigned",
  );
  const options: { value: ParaCategory | "unassigned"; label: string }[] = [
    ...PARA_ORDER.map((c) => ({ value: c, label: PARA_TOKENS[c].label })),
    { value: "unassigned", label: "미지정" },
  ];
  return (
    <div className="space-y-2 p-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="폴더 이름"
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-3 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPara(opt.value)}
            className={cn(
              "rounded border py-1 text-[10px]",
              para === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              para_category: para === "unassigned" ? null : para,
            })
          }
        >
          저장
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
