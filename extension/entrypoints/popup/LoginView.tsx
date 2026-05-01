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
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Save It 로그인
      </h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          autoFocus
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          required
          style={inputStyle}
        />
        {error && (
          <p style={{ color: "#dc2626", fontSize: 12, margin: 0 }}>{error}</p>
        )}
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p style={{ fontSize: 11, color: "#888", marginTop: 12 }}>
        계정이 없다면 save-it 웹사이트에서 가입 후 이용하세요.
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  fontSize: 13,
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  marginTop: 4,
};
