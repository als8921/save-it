import "../../lib/styles/globals.css";
import { Bookmark, X } from "lucide-react";
import ReactDOM from "react-dom/client";
import { useAuth } from "../../lib/useAuth";
import { AppShell } from "../popup/AppShell";
import { LoginView } from "../popup/LoginView";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "save-it-floating",
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<FloatingWidget />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});

function FloatingWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-5 right-5 font-sans" style={{ zIndex: 2147483647 }}>
      {open ? (
        <FloatingPanel onClose={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Save It"
          title="Save It"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 cursor-pointer"
        >
          <Bookmark className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function FloatingPanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();

  return (
    <div className="w-[360px] rounded-xl border bg-card text-card-foreground shadow-2xl">
      {auth.status === "loading" && (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold">Save It</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {auth.status === "anonymous" && (
        <div>
          <div className="flex justify-end border-b px-2 py-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <LoginView />
        </div>
      )}
      {auth.status === "authenticated" && (
        <AppShell
          userId={auth.session.user.id}
          initialUrl={location.href}
          initialTitle={document.title}
          onSaved={onClose}
          onClose={onClose}
        />
      )}
    </div>
  );
}
