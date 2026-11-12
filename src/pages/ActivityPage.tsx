import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileUp, RefreshCw, Trash2 } from "lucide-react";
import { ActivityHeatmap } from "../components/activity/ActivityHeatmap";
import { PageHeader } from "../components/common/PageHeader";
import { api } from "../lib/api/client";
import {
  CODEX_ACTIVITY_KEY, normalizeActivityDays, parseCodexActivity,
  type ActivityDay, type CodexActivity,
} from "../lib/activity";

type GithubResponse = {
  username: string;
  source: "github-public" | "github-graphql";
  days: ActivityDay[];
  total: number | null;
  fetchedAt: string;
  stale?: boolean;
};
const GITHUB_PROFILE = "https://github.com/guseoh";
const CODEX_EXPORT_SCRIPT = "https://github.com/guseoh/dark-todo-planner/blob/main/scripts/export-codex-activity.ps1";

function readCodexLocal(): CodexActivity | null {
  try {
    const stored = localStorage.getItem(CODEX_ACTIVITY_KEY);
    if (!stored) return null;
    const raw: unknown = JSON.parse(stored);
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Partial<CodexActivity>;
    if ((c.metric !== "sessions" && c.metric !== "tokens") ||
      (c.source !== "codex-app-server" && c.source !== "codex-local-sessions") ||
      !Array.isArray(c.days)) return null;
    const days = normalizeActivityDays(c.days);
    if (days.length !== c.days.length || c.days.length > 800) return null;
    return { source: c.source, metric: c.metric, days, importedAt: typeof c.importedAt === "string" ? c.importedAt : "" };
  } catch { return null; }
}

export function ActivityPage() {
  const [github, setGithub] = useState<GithubResponse | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubError, setGithubError] = useState("");
  const [codex, setCodex] = useState<CodexActivity | null>(readCodexLocal);
  const [codexError, setCodexError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadGithub = useCallback(async (signal?: AbortSignal) => {
    setGithubLoading(true);
    setGithubError("");
    try {
      const data = await api<GithubResponse>("/api/activity/github", { signal });
      if (!Array.isArray(data.days) || data.days.length < 200) throw new Error("GitHub 활동 데이터가 불완전합니다.");
      if (!signal?.aborted) setGithub({ ...data, days: normalizeActivityDays(data.days) });
    } catch (err) {
      if (!signal?.aborted) {
        setGithubError(err instanceof Error ? err.message : "GitHub 데이터를 가져오지 못했습니다.");
      }
    } finally { if (!signal?.aborted) setGithubLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadGithub(controller.signal);
    return () => controller.abort();
  }, [loadGithub]);

  const importCodex = async (file: File | undefined) => {
    if (!file) return;
    setCodexError("");
    try {
      if (file.size > 250_000) throw new Error("날짜별 집계 파일만 가져올 수 있습니다 (최대 250KB).");
      const parsed = parseCodexActivity(await file.text());
      localStorage.setItem(CODEX_ACTIVITY_KEY, JSON.stringify(parsed));
      setCodex(parsed);
    } catch (err) {
      setCodexError(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearCodex = () => {
    localStorage.removeItem(CODEX_ACTIVITY_KEY);
    setCodex(null);
    setCodexError("");
  };

  return (
    <div className="page-shell activity-page space-y-5">
      <PageHeader title="개발 활동" />
      <div className="activity-page__panels">
        <ActivityHeatmap title="GitHub 활동" subtitle="공개 기여 달력 · @guseoh"
          palette="github" metric="contributions"
          days={github?.days ?? null} loading={githubLoading} error={githubError}
          sourceLabel={github?.stale ? "마지막으로 가져온 기록 · 현재 갱신 실패" :
            github?.source === "github-graphql" ? "GitHub GraphQL · 최대 1시간 캐시" : "GitHub 공개 기여 달력 · 최대 1시간 캐시"}
          actions={<>
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" className="btn-secondary activity-page__button">
              <ExternalLink size={14} /> 프로필
            </a>
            <button type="button" className="btn-secondary activity-page__button" onClick={() => void loadGithub()} disabled={githubLoading}>
              <RefreshCw size={14} /> 다시 확인
            </button>
          </>}
        />
        <ActivityHeatmap title="Codex 활동" subtitle={codex?.metric === "tokens" ? "일별 토큰 사용량" : "일별 세션 시작 수"}
          palette="codex" metric={codex?.metric ?? "sessions"}
          days={codex?.days ?? null} error={codexError}
          sourceLabel={codex ? "기기 내 저장 · 마지막 가져오기 " + (codex.importedAt.slice(0, 10) || "날짜 미상") : "기록을 가져오기 전에는 잔디를 표시하지 않습니다."}
          actions={<>
            <label className="btn-secondary activity-page__button activity-page__upload">
              <FileUp size={14} /> JSON 가져오기
              <input ref={fileRef} aria-label="Codex 집계 JSON 파일" type="file" accept=".json,application/json"
                onChange={(event) => void importCodex(event.target.files?.[0])} />
            </label>
            {codex ? <button type="button" className="btn-secondary activity-page__button"
              onClick={clearCodex}><Trash2 size={14} /> 지우기</button> : null}
          </>}
        />
      </div>
      <details className="activity-page__help">
        <summary>Codex 활동을 가져오는 방법</summary>
        <div className="space-y-2 pt-3 text-sm leading-6 text-ui-secondary">
          <p>Windows PC에서 <a href={CODEX_EXPORT_SCRIPT} target="_blank" rel="noreferrer">export-codex-activity.ps1</a>을 확인한 후 PowerShell에서 실행합니다. 생성된 <code>codex-activity.json</code>을 위에서 선택하면 됩니다.</p>
          <p>기본 집계는 Codex 세션 파일의 <strong>이름과 날짜만</strong> 읽습니다. 프롬프트·소스 코드·대화 내용은 읽거나 앱 서버에 전송하지 않습니다. 다른 PC와 자동 동기화되지 않습니다.</p>
          <p>공식 Codex App Server <code>account/usage/read</code>의 <code>dailyUsageBuckets</code> JSON 응답도 가져올 수 있으며, 이 경우에는 세션 수가 아닌 토큰 수로 표시됩니다.</p>
          <p>GitHub 공개 기여 달력에 포함되지 않는 비공개 상세 기록은 이 화면에서 별도 접근하지 않습니다.</p>
        </div>
      </details>
    </div>
  );
}
