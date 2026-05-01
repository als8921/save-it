import "../../lib/styles/globals.css";
import { Bookmark, X } from "lucide-react";
import ReactDOM from "react-dom/client";
import { useAuth } from "../../lib/useAuth";
import { LoginView } from "../popup/LoginView";
import { SaveView } from "../popup/SaveView";

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
    <div className="w-[360px] max-h-[min(85vh,640px)] overflow-y-auto rounded-xl border bg-card text-card-foreground shadow-2xl relative">
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
      {auth.status === "loading" && (
        <div className="p-5 text-sm text-muted-foreground">불러오는 중...</div>
      )}
      {auth.status === "anonymous" && <LoginView />}
      {auth.status === "authenticated" && (
        <SaveView
          userId={auth.session.user.id}
          initialUrl={location.href}
          initialTitle={document.title}
          onSaved={onClose}
        />
      )}
    </div>
  );
}
