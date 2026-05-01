import { useAuth } from "../../lib/useAuth";
import { LoginView } from "./LoginView";
import { SaveView } from "./SaveView";

export default function Popup() {
  const auth = useAuth();
  const [tab, setTab] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const t = tabs[0];
      setTab({ url: t?.url ?? "", title: t?.title ?? "" });
    });
  }, []);

  return (
    <div
      style={{ width: 360, fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {(auth.status === "loading" || tab === null) && (
        <div style={{ padding: 16, color: "#666", fontSize: 13 }}>
          불러오는 중...
        </div>
      )}
      {auth.status === "anonymous" && tab !== null && <LoginView />}
      {auth.status === "authenticated" && tab !== null && (
        <SaveView
          userId={auth.session.user.id}
          initialUrl={tab.url}
          initialTitle={tab.title}
          onSaved={() => window.close()}
        />
      )}
    </div>
  );
}
