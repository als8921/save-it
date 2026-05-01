import { ArrowRight } from "lucide-react";
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
    <div className="px-6 pt-6 pb-7 space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">save · it</span>
          <span className="grow leader-dot h-px" />
          <span className="font-mono text-[10px] text-muted-foreground">N°01</span>
        </div>
        <h1
          className="font-serif text-[26px] leading-[1.05] tracking-tight"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          읽고, 저장하고,
          <br />
          <em
            className="italic"
            style={{ fontVariationSettings: "'opsz' 144" }}
          >
            다시 펼쳐 보세요.
          </em>
        </h1>
      </header>

      <div className="flex items-center gap-2">
        <span className="eyebrow">로그인</span>
        <span className="grow border-t" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <p className="text-xs text-destructive border-l-2 border-destructive pl-2">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full gap-2 group">
          {loading ? "로그인 중…" : "로그인"}
          {!loading && (
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>
      </form>

      <div className="flex items-baseline gap-2 pt-1">
        <span className="font-mono text-[10px] text-muted-foreground">→</span>
        <p className="text-[11px] text-muted-foreground leading-snug">
          계정이 없다면 <span className="text-foreground/85">save-it</span>{" "}
          웹사이트에서 가입해 주세요.
        </p>
      </div>
    </div>
  );
}
