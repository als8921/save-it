import { ChevronLeft, LogOut, Plus, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { BrowseView } from "./BrowseView";
import { SaveView } from "./SaveView";

type Mode = "browse" | "add";

interface AppShellProps {
  userId: string;
  initialUrl: string;
  initialTitle: string;
  onSaved: () => void;
  onClose?: () => void;
}

export function AppShell({
  userId,
  initialUrl,
  initialTitle,
  onSaved,
  onClose,
}: AppShellProps) {
  const [mode, setMode] = useState<Mode>("browse");
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);

  function goToAdd(folderId: string | null = null) {
    setPendingFolderId(folderId);
    setMode("add");
  }

  function goToBrowse() {
    setPendingFolderId(null);
    setMode("browse");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex flex-col">
      {mode === "browse" ? (
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <span
            className="font-serif text-[17px] leading-none tracking-tight"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            Save<em className="italic">·</em>It
          </span>
          <span className="eyebrow ml-auto">index</span>
          <Button
            type="button"
            size="xs"
            onClick={() => goToAdd(null)}
            className="h-7 gap-1 px-2.5"
          >
            <Plus className="h-3 w-3" />
            추가
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="닫기"
              className="h-7 w-7 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </header>
      ) : (
        <header className="flex items-center justify-between gap-2 border-b px-2 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToBrowse}
              aria-label="뒤로"
              className="h-7 w-7 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="eyebrow">새 항목</span>
            <span className="font-serif italic text-[15px] leading-none tracking-tight">
              추가
            </span>
          </div>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="닫기"
              className="h-7 w-7 shrink-0 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </header>
      )}

      {mode === "add" ? (
        <SaveView
          userId={userId}
          initialUrl={initialUrl}
          initialTitle={initialTitle}
          initialFolderId={pendingFolderId}
          onSaved={onSaved}
        />
      ) : (
        <BrowseView userId={userId} onAddLinkToFolder={goToAdd} />
      )}

      <footer className="flex items-center gap-2 border-t px-4 py-2">
        <span className="eyebrow">session</span>
        <span className="grow leader-dot h-px" />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          logout
          <LogOut className="h-3 w-3" />
        </button>
      </footer>
    </div>
  );
}
