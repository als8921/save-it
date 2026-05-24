import { Check, FolderPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "../../lib/para";
import type { Folder, ParaCategory } from "../../lib/types";

interface SaveViewProps {
  userId: string;
  initialUrl: string;
  initialTitle: string;
  initialFolderId?: string | null;
  onSaved: () => void;
}

type ParaTab = ParaCategory | "unassigned";

const PRIORITY_OPTIONS = [
  { value: 0, label: "보통", dots: 0 },
  { value: 1, label: "중요", dots: 1 },
  { value: 2, label: "매우", dots: 2 },
];

export function SaveView({
  userId,
  initialUrl,
  initialTitle,
  initialFolderId,
  onSaved,
}: SaveViewProps) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedPara, setSelectedPara] = useState<ParaTab>("project");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          const list = (data ?? []) as Folder[];
          setFolders(list);
          if (initialFolderId) {
            const target = list.find((f) => f.id === initialFolderId);
            if (target) {
              setSelectedFolderId(target.id);
              setSelectedPara(target.para_category ?? "unassigned");
            }
          }
        }
        setFoldersLoading(false);
      });
  }, []);

  const filteredFolders = folders.filter((f) =>
    selectedPara === "unassigned"
      ? f.para_category === null
      : f.para_category === selectedPara,
  );

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    setError("");

    const para = selectedPara === "unassigned" ? null : selectedPara;
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
      setError(
        error.code === "23505"
          ? "이미 같은 이름의 폴더가 있어요"
          : error.message,
      );
      return;
    }
    const created = data as Folder;
    setFolders((prev) => [...prev, created]);
    setSelectedFolderId(created.id);
    setNewFolderName("");
    setShowNewFolder(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFolderId) {
      setError("폴더를 선택하세요");
      return;
    }
    setError("");
    setSaving(true);

    const { error } = await supabase.from("links").insert({
      user_id: userId,
      folder_id: selectedFolderId,
      url,
      title: title || url,
      description: description || null,
      priority,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => onSaved(), 600);
  }

  const paraChips: { key: ParaTab; letter: string; label: string; fg: string; bg: string }[] = [
    ...PARA_ORDER.map((cat) => ({
      key: cat as ParaTab,
      letter: PARA_TOKENS[cat].letter,
      label: PARA_TOKENS[cat].label,
      fg: PARA_TOKENS[cat].fg,
      bg: PARA_TOKENS[cat].bg,
    })),
    {
      key: "unassigned" as ParaTab,
      letter: "·",
      label: UNASSIGNED_TOKEN.label,
      fg: UNASSIGNED_TOKEN.fg,
      bg: UNASSIGNED_TOKEN.bg,
    },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-4 px-3 py-3">
      <Section title="링크">
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="비워두면 URL이 제목"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">메모</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="간단한 설명 (선택)"
          />
        </div>
      </Section>

      <Section title="우선도">
        <div className="flex gap-1.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <PriorityChip
              key={opt.value}
              active={priority === opt.value}
              onClick={() => setPriority(opt.value)}
              dots={opt.dots}
              label={opt.label}
            />
          ))}
        </div>
      </Section>

      <Section title="카테고리">
        <div className="grid grid-cols-5 gap-1.5">
          {paraChips.map((chip) => {
            const active = selectedPara === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  setSelectedPara(chip.key);
                  setSelectedFolderId(null);
                  setShowNewFolder(false);
                }}
                title={chip.label}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5 transition-colors cursor-pointer",
                  active ? "border-transparent" : "border-border bg-card hover:bg-accent",
                )}
                style={
                  active
                    ? { backgroundColor: chip.bg, borderColor: chip.fg }
                    : undefined
                }
              >
                <span
                  className="text-[13px] font-bold leading-none"
                  style={{ color: active ? chip.fg : "var(--muted-foreground)" }}
                >
                  {chip.letter}
                </span>
                <span
                  className={cn(
                    "text-[9px] leading-none tracking-tight",
                    active ? "" : "text-muted-foreground",
                  )}
                  style={active ? { color: chip.fg } : undefined}
                >
                  {chip.key === "unassigned" ? "미지정" : chip.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="폴더">
        {foldersLoading ? (
          <p className="text-xs italic text-muted-foreground">불러오는 중…</p>
        ) : (
          <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-xl border bg-card/40 p-1.5">
            {filteredFolders.length === 0 && !showNewFolder && (
              <p className="px-2 py-2 text-xs italic text-muted-foreground">
                이 카테고리에 폴더가 없습니다
              </p>
            )}
            {filteredFolders.map((folder) => {
              const selected = selectedFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <span className="flex-1 truncate font-medium">{folder.name}</span>
                  {selected && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}

            {showNewFolder ? (
              <div className="flex gap-1 pt-1">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="새 폴더 이름"
                  autoFocus
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder(e);
                    if (e.key === "Escape") {
                      setShowNewFolder(false);
                      setNewFolderName("");
                    }
                  }}
                />
                <Button
                  type="button"
                  size="xs"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                >
                  {creatingFolder ? "…" : "생성"}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewFolder(true)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
              >
                <FolderPlus className="h-3 w-3" />
                <span>새 폴더 만들기</span>
              </button>
            )}
          </div>
        )}
      </Section>

      {error && (
        <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving || !selectedFolderId}
        className="w-full"
      >
        {savedFlash ? (
          <>
            <Check className="mr-1 h-4 w-4" />
            저장됨
          </>
        ) : saving ? (
          "저장 중…"
        ) : (
          "저장"
        )}
      </Button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PriorityChip({
  active,
  onClick,
  dots,
  label,
}: {
  active: boolean;
  onClick: () => void;
  dots: number;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border py-2 transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-accent",
      )}
    >
      <span className="flex gap-0.5">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < dots
                ? active
                  ? "bg-primary-foreground"
                  : "bg-foreground"
                : active
                  ? "bg-primary-foreground/25"
                  : "bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
      <span className="text-[11px] tracking-tight">{label}</span>
    </button>
  );
}
