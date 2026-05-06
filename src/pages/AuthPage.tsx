import { FormEvent, useState } from "react";
import { CalendarCheck2, LogIn, UserPlus } from "lucide-react";

export function AuthPage({
  onLogin,
  onRegister,
  error,
}: {
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { email: string; password: string; nickname?: string }) => Promise<void>;
  error?: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState(error || "");
  const [submitting, setSubmitting] = useState(false);
  const isGitHubPages = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (mode === "login") await onLogin({ email, password });
      else await onRegister({ email, password, nickname });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "인증 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="app-card w-full max-w-md p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-500 text-white">
            <CalendarCheck2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-100">Dark Todo Planner</h1>
            <p className="text-sm text-ink-400">서버 저장형 개인 플래너</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" className={mode === "login" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("login")}>
            <LogIn size={17} />
            로그인
          </button>
          <button type="button" className={mode === "register" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("register")}>
            <UserPlus size={17} />
            회원가입
          </button>
        </div>

        {isGitHubPages ? (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-amber-100">
            GitHub Pages는 정적 미리보기라 로그인과 DB 저장 API가 동작하지 않습니다. 실제 사용은 Express 서버 배포 주소에서 진행하세요.
          </div>
        ) : null}

        {mode === "register" ? (
          <input className="field mt-4" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="닉네임" />
        ) : null}
        <input className="field mt-4" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" />
        <input className="field mt-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 6자 이상" />
        {message ? <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-100">{message}</p> : null}
        <button type="submit" className="btn-primary mt-5 w-full" disabled={submitting}>
          {submitting ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>
    </main>
  );
}
