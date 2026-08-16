import { CheckCircle2, Download, MonitorSmartphone } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as NavigatorWithStandalone).standalone === true;
};

export function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("Todo Planner가 앱으로 설치되었습니다.");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setMessage("설치가 시작되었습니다.");
      setInstallPrompt(null);
    } else {
      setMessage("설치를 취소했습니다. 필요할 때 다시 설치할 수 있습니다.");
    }
  };

  return (
    <section className="app-card p-4 sm:p-5" aria-labelledby="pwa-install-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-500/25 bg-accent-500/[0.08] text-accent-200">
            <MonitorSmartphone size={19} />
          </span>
          <div>
            <h3 id="pwa-install-title" className="text-base font-bold text-ink-100">앱으로 설치</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-400">Todo Planner를 PC 또는 모바일 홈 화면에 설치해 브라우저 주소창 없이 독립된 앱 창으로 실행할 수 있습니다. 데이터는 기존 Cloudflare D1을 그대로 사용합니다.</p>
          </div>
        </div>

        {installed ? (
          <span className="inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-lg border border-success/30 bg-success/[0.07] px-3 py-2 text-xs font-semibold text-emerald-100">
            <CheckCircle2 size={14} />설치됨
          </span>
        ) : installPrompt ? (
          <button type="button" className="btn-primary shrink-0 self-start" onClick={() => void install()}>
            <Download size={16} />앱 설치
          </button>
        ) : (
          <span className="inline-flex min-h-9 shrink-0 items-center self-start rounded-lg border border-ink-700/70 bg-ink-950/25 px-3 py-2 text-xs font-semibold text-ink-400">브라우저 설치 메뉴 사용</span>
        )}
      </div>

      {!installed && !installPrompt ? <p className="mt-3 rounded-md border border-ink-800/70 bg-ink-950/25 px-3 py-2 text-xs leading-5 text-ink-500">설치 버튼이 표시되지 않는 브라우저에서는 브라우저 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 사용하세요.</p> : null}
      {message ? <p className="mt-3 text-xs font-semibold text-ink-300" aria-live="polite">{message}</p> : null}
    </section>
  );
}
