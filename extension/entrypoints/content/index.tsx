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
          className="group flex h-10 items-center gap-1.5 rounded-full border border-rule bg-card pl-2.5 pr-3 text-foreground transition-all hover:bg-accent cursor-pointer"
          style={{
            boxShadow:
              "0 12px 28px rgba(60, 30, 20, 0.12), 0 2px 6px rgba(60, 30, 20, 0.05)",
          }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bookmark className="h-2.5 w-2.5" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
            save
          </span>
        </button>
      )}
    </div>
  );
}

function FloatingPanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();

  return (
    <div
      className="paper-grain w-[360px] rounded-xl text-foreground animate-fade-up overflow-hidden"
      style={{
        border: "1px solid oklch(0.84 0.012 85)",
        boxShadow:
          "0 24px 60px rgba(60, 30, 20, 0.16), 0 6px 18px rgba(60, 30, 20, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      }}
    >
      {auth.status === "loading" && (
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <span
            className="font-serif text-[15px] leading-none tracking-tight"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            Save<em className="italic">·</em>It
          </span>
          <span className="grow leader-dot h-px" />
          <span className="eyebrow">loading</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
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
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
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
