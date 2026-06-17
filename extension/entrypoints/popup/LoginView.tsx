import { Bookmark } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { supabase } from "../../lib/supabase";

type Mode = "login" | "signup";

export function LoginView() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setLoading(false);
      // 세션이 바로 생기면 onAuthStateChange 가 화면을 전환한다.
      // 이메일 확인이 필요한 설정이면 세션이 없으므로 안내한다.
      if (!data.session) {
        setInfo("확인 메일을 보냈어요. 메일에서 인증한 뒤 로그인해 주세요.");
        setMode("login");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  return (
    <div className="px-5 pt-6 pb-6 space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--color-para-project-fg)" }}
          >
            <Bookmark className="h-4 w-4 text-white" />
          </span>
          <div>
            <div className="text-base font-semibold leading-none">Save It</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              저장한 링크를 다시 보게 만드는 서비스
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={isSignup ? 6 : undefined}
          />
          {isSignup && (
            <p className="text-[11px] text-muted-foreground">
              비밀번호는 6자 이상이어야 해요.
            </p>
          )}
        </div>

        {error && (
          <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {info && (
          <p
            className="border-l-2 pl-2 text-xs text-muted-foreground"
            style={{ borderColor: "var(--color-para-project-fg)" }}
          >
            {info}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? isSignup
              ? "가입 중…"
              : "로그인 중…"
            : isSignup
              ? "회원가입"
              : "로그인"}
        </Button>
      </form>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {isSignup ? (
          <>
            이미 계정이 있나요?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-medium text-foreground underline underline-offset-2 cursor-pointer"
            >
              로그인
            </button>
          </>
        ) : (
          <>
            계정이 없나요?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="font-medium text-foreground underline underline-offset-2 cursor-pointer"
            >
              회원가입
            </button>
          </>
        )}
      </p>
    </div>
  );
}
