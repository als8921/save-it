import { Bookmark, ChevronLeft, LogOut, Plus, Settings, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { BrowseView } from "./BrowseView";
import { SaveView } from "./SaveView";
import { SettingsView } from "./SettingsView";

type Mode = "browse" | "add" | "settings";

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

  function goToSettings() {
    setPendingFolderId(null);
    setMode("settings");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex flex-col">
      {mode === "browse" ? (
        <header className="flex items-center gap-2 border-b px-3 py-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--color-para-project-fg)" }}
            aria-hidden
          >
            <Bookmark className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-sm font-semibold">Save It</span>
          <span className="flex-1" />
          <Button
            type="button"
            size="xs"
            onClick={() => goToAdd(null)}
            className="h-7 gap-1 px-2.5"
          >
            <Plus className="h-3 w-3" />
            추가
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goToSettings}
            aria-label="설정"
            className="h-7 w-7 text-muted-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
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
        <header className="flex items-center gap-2 border-b px-2 py-2.5">
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
          <span className="text-sm font-semibold">
            {mode === "settings" ? "설정" : "새 링크 추가"}
          </span>
          <span className="flex-1" />
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
      ) : mode === "settings" ? (
        <SettingsView />
      ) : (
        <BrowseView userId={userId} onAddLinkToFolder={goToAdd} />
      )}

      <footer className="flex items-center justify-end border-t px-4 py-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          로그아웃
          <LogOut className="h-3 w-3" />
        </button>
      </footer>
    </div>
  );
}
