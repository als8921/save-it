import { useAuth } from "../../lib/useAuth";
import { AppShell } from "./AppShell";
import { LoginView } from "./LoginView";

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
    <div className="paper-grain w-[360px] text-foreground animate-fade-up">
      {(auth.status === "loading" || tab === null) && (
        <div className="flex items-center gap-2 p-5">
          <span className="eyebrow">loading</span>
          <span className="grow leader-dot h-px" />
        </div>
      )}
      {auth.status === "anonymous" && tab !== null && <LoginView />}
      {auth.status === "authenticated" && tab !== null && (
        <AppShell
          userId={auth.session.user.id}
          initialUrl={tab.url}
          initialTitle={tab.title}
          onSaved={() => window.close()}
        />
      )}
    </div>
  );
}
