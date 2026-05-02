import { Check, FolderPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import {
  PARA_LABELS,
  PARA_ORDER,
  type Folder,
  type ParaCategory,
} from "../../lib/types";

interface SaveViewProps {
  userId: string;
  initialUrl: string;
  initialTitle: string;
  initialFolderId?: string | null;
  onSaved: () => void;
}

type ParaTab = ParaCategory | "unassigned";

const PARA_TABS: { key: ParaTab; label: string; letter: string }[] = [
  ...PARA_ORDER.map((cat) => ({
    key: cat as ParaTab,
    label: PARA_LABELS[cat],
    letter: PARA_LABELS[cat][0],
  })),
  { key: "unassigned", label: "미지정", letter: "U" },
];

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
      : f.para_category === selectedPara
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
          : error.message
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

  return (
    <form onSubmit={handleSave} className="px-4 py-4 space-y-5">
      <Section number="01" title="링크">
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
            placeholder="비워두면 URL이 제목이 됩니다"
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

      <Section number="02" title="우선도">
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

      <Section number="03" title="카테고리">
        <div className="flex flex-wrap gap-1.5">
          {PARA_TABS.map((tab) => (
            <Chip
              key={tab.key}
              active={selectedPara === tab.key}
              onClick={() => {
                setSelectedPara(tab.key);
                setSelectedFolderId(null);
                setShowNewFolder(false);
              }}
              letter={tab.key === "unassigned" ? undefined : tab.letter}
            >
              {tab.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section number="04" title="폴더">
        {foldersLoading ? (
          <p className="text-xs text-muted-foreground italic">불러오는 중…</p>
        ) : (
          <div className="rounded-md border border-rule bg-card/60 p-1 space-y-0.5 max-h-[160px] overflow-y-auto">
            {filteredFolders.length === 0 && !showNewFolder && (
              <p className="px-2 py-2 text-xs text-muted-foreground italic">
                이 카테고리에 폴더가 없습니다
              </p>
            )}
            {filteredFolders.map((folder, i) => {
              const selected = selectedFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    "w-full flex items-baseline gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors cursor-pointer",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[10px] tabular-nums",
                      selected ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{folder.name}</span>
                  <span
                    className={cn(
                      "grow leader-dot h-px self-center",
                      selected ? "opacity-30" : ""
                    )}
                  />
                  {selected && <Check className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}

            {showNewFolder ? (
              <div className="flex gap-1 px-1 pt-1">
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
                className="w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                <FolderPlus className="h-3 w-3" />
                <span className="italic">새 폴더 만들기</span>
              </button>
            )}
          </div>
        )}
      </Section>

      {error && (
        <p className="text-xs text-destructive border-l-2 border-destructive pl-2">
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
            <Check className="h-4 w-4 mr-1" />
            저장됨
          </>
        ) : saving ? (
          "저장 중…"
        ) : (
          "색인에 저장"
        )}
      </Button>
    </form>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {number}
        </span>
        <span className="font-serif italic text-[13px] leading-none">
          {title}
        </span>
        <span className="grow border-t" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  letter,
  children,
}: {
  active: boolean;
  onClick: () => void;
  letter?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-full border py-1 transition-colors cursor-pointer",
        letter ? "pl-2.5 pr-3" : "px-3",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-rule bg-card hover:bg-accent"
      )}
    >
      {letter && (
        <span
          className="font-serif text-[13px] font-black leading-none"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          {letter}
        </span>
      )}
      <span
        className={cn(
          "text-[10px] leading-none tracking-tight",
          active ? "text-primary-foreground/85" : "text-muted-foreground"
        )}
      >
        {children}
      </span>
    </button>
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
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-md border py-2 transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-rule bg-card hover:bg-accent"
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
                  : "bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
      <span className="text-[11px] tracking-tight">{label}</span>
    </button>
  );
}
