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
      .insert({ user_id: userId, name: newFolderName.trim(), para_category: para })
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
    <form onSubmit={handleSave} style={{ padding: 12, fontSize: 13 }}>
      <div style={headerRow}>
        <strong style={{ fontSize: 14 }}>Save It</strong>
        <button type="button" onClick={handleSignOut} style={linkBtn}>
          로그아웃
        </button>
      </div>

      <Field label="URL">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={inputStyle}
        />
      </Field>

      <Field label="제목">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="비워두면 URL이 제목이 됩니다"
          style={inputStyle}
        />
      </Field>

      <Field label="설명 (선택)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="간단한 메모"
          style={inputStyle}
        />
      </Field>

      <Field label="중요도">
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { value: 0, label: "보통" },
            { value: 1, label: "중요" },
            { value: 2, label: "매우" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              style={chip(priority === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="카테고리">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {PARA_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSelectedPara(tab.key);
                setSelectedFolderId(null);
                setShowNewFolder(false);
              }}
              style={chip(selectedPara === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="폴더">
        {foldersLoading ? (
          <p style={hint}>불러오는 중...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredFolders.length === 0 && !showNewFolder && (
              <p style={hint}>이 카테고리에 폴더가 없습니다</p>
            )}
            {filteredFolders.map((folder) => (
              <label key={folder.id} style={folderRow}>
                <input
                  type="radio"
                  name="folder"
                  checked={selectedFolderId === folder.id}
                  onChange={() => setSelectedFolderId(folder.id)}
                />
                {folder.name}
              </label>
            ))}

            {showNewFolder ? (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="새 폴더 이름"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder(e);
                    if (e.key === "Escape") {
                      setShowNewFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !newFolderName.trim()}
                  style={smallBtn}
                >
                  {creatingFolder ? "..." : "생성"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewFolder(true)}
                style={addFolderBtn}
              >
                + 새 폴더
              </button>
            )}
          </div>
        )}
      </Field>

      {error && (
        <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !selectedFolderId}
        style={{ ...primaryBtn, marginTop: 8, opacity: saving ? 0.6 : 1 }}
      >
        {savedFlash ? "저장됨 ✓" : saving ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#666",
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #d4d4d8",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: "4px 8px",
  border: `1px solid ${active ? "#111827" : "#d4d4d8"}`,
  background: active ? "#111827" : "white",
  color: active ? "white" : "#374151",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
});

const folderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  cursor: "pointer",
};

const addFolderBtn: React.CSSProperties = {
  padding: "4px 6px",
  background: "transparent",
  border: "1px dashed #a1a1aa",
  borderRadius: 4,
  color: "#52525b",
  fontSize: 11,
  cursor: "pointer",
  textAlign: "left",
  marginTop: 2,
};

const smallBtn: React.CSSProperties = {
  padding: "0 8px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 4,
  fontSize: 11,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#666",
  fontSize: 11,
  cursor: "pointer",
  padding: 0,
};

const hint: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  margin: "2px 0",
};
