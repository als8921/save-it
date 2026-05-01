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
    <div style={wrapperStyle}>
      {open ? (
        <FloatingPanel onClose={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={fabStyle}
          aria-label="Save It"
          title="Save It"
        >
          +
        </button>
      )}
    </div>
  );
}

function FloatingPanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();

  return (
    <div style={panelStyle}>
      <button
        type="button"
        onClick={onClose}
        style={closeBtnStyle}
        aria-label="닫기"
      >
        ×
      </button>
      {auth.status === "loading" && (
        <div style={{ padding: 16, color: "#666", fontSize: 13 }}>
          불러오는 중...
        </div>
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

const wrapperStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  right: 20,
  zIndex: 2147483647,
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const fabStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#111827",
  color: "white",
  border: "none",
  fontSize: 22,
  fontWeight: 300,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  padding: 0,
};

const panelStyle: React.CSSProperties = {
  width: 360,
  maxHeight: "min(80vh, 600px)",
  overflowY: "auto",
  background: "white",
  borderRadius: 8,
  boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
  border: "1px solid #e5e7eb",
  position: "relative",
  color: "#111827",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  width: 24,
  height: 24,
  border: "none",
  background: "transparent",
  fontSize: 20,
  color: "#9ca3af",
  cursor: "pointer",
  lineHeight: 1,
  padding: 0,
  zIndex: 1,
};
