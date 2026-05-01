import { Check, FolderPlus, LogOut } from "lucide-react";
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
  onSaved: () => void;
}

type ParaTab = ParaCategory | "unassigned";

const PARA_TABS: { key: ParaTab; label: string }[] = [
  ...PARA_ORDER.map((cat) => ({ key: cat as ParaTab, label: PARA_LABELS[cat] })),
  { key: "unassigned", label: "미지정" },
];

const PRIORITY_OPTIONS = [
  { value: 0, label: "보통" },
  { value: 1, label: "중요" },
  { value: 2, label: "매우" },
];

export function SaveView({
  userId,
  initialUrl,
  initialTitle,
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
        if (error) setError(error.message);
        else setFolders((data ?? []) as Folder[]);
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
      setError(error.message);
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

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">Save It</h1>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleSignOut}
          className="text-muted-foreground"
        >
          <LogOut className="h-3 w-3 mr-1" />
          로그아웃
        </Button>
      </div>

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

      <div className="space-y-1.5">
        <Label>중요도</Label>
        <div className="flex gap-1.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={priority === opt.value}
              onClick={() => setPriority(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>카테고리</Label>
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
            >
              {tab.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>폴더</Label>
        {foldersLoading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : (
          <div className="rounded-md border bg-card p-1 space-y-0.5 max-h-[140px] overflow-y-auto">
            {filteredFolders.length === 0 && !showNewFolder && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                이 카테고리에 폴더가 없습니다
              </p>
            )}
            {filteredFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded px-2 py-1.5 text-xs text-left transition-colors cursor-pointer",
                  selectedFolderId === folder.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="truncate">{folder.name}</span>
                {selectedFolderId === folder.id && (
                  <Check className="h-3 w-3 shrink-0" />
                )}
              </button>
            ))}

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
                  {creatingFolder ? "..." : "생성"}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewFolder(true)}
                className="w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                <FolderPlus className="h-3 w-3" />새 폴더
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

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
          "저장 중..."
        ) : (
          "저장"
        )}
      </Button>
    </form>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}
