import { Bookmark } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { supabase } from "../../lib/supabase";

export function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
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
          />
        </div>

        {error && (
          <p className="border-l-2 border-destructive pl-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "로그인 중…" : "로그인"}
        </Button>
      </form>

      <p className="text-[11px] leading-snug text-muted-foreground">
        계정이 없다면 <span className="text-foreground">save-it</span> 웹사이트에서 가입해 주세요.
      </p>
    </div>
  );
}
