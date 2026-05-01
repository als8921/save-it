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

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div>
      {mode === "browse" ? (
        <header className="flex items-center justify-end gap-1 border-b px-2.5 py-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setMode("add")}
            className="h-8 gap-1 px-3 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="닫기"
              className="h-8 w-8 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </header>
      ) : (
        <header className="flex items-center justify-between gap-2 border-b px-2 py-2">
          <div className="flex items-center gap-1 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMode("browse")}
              aria-label="뒤로"
              className="h-7 w-7 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold truncate">링크 추가</span>
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
              <X className="h-4 w-4" />
            </Button>
          )}
        </header>
      )}

      {mode === "add" ? (
        <SaveView
          userId={userId}
          initialUrl={initialUrl}
          initialTitle={initialTitle}
          onSaved={onSaved}
        />
      ) : (
        <BrowseView />
      )}

      <footer className="flex justify-end border-t px-3 py-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <LogOut className="h-3 w-3" />
          로그아웃
        </button>
      </footer>
    </div>
  );
}
