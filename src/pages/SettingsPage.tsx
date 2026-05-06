import { ChangeEvent, useRef, useState } from "react";
import { Download, FileJson, RotateCcw, Trash2, Upload } from "lucide-react";
import { TODO_STORAGE_KEY } from "../lib/storage";
import { todayKey } from "../lib/date";
import type { Todo } from "../types/todo";
import { StatCard } from "../components/common/StatCard";

type SettingsPageProps = {
  todos: Todo[];
  stats: {
    total: number;
    completedTotal: number;
  };
  onImport: (value: unknown) => boolean;
  onClear: () => void;
};

export function SettingsPage({ todos, stats, onImport, onClear }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(todos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dark-todo-planner-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("JSON 파일을 내보냈습니다.");
    setError("");
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const overwrite = window.confirm("현재 Todo 데이터를 가져온 JSON 데이터로 덮어쓸까요?");
        if (!overwrite) return;

        const ok = onImport(parsed);
        if (!ok) {
          setError("Todo 데이터 구조가 올바르지 않습니다.");
          setMessage("");
          return;
        }
        setMessage("JSON 데이터를 가져왔습니다.");
        setError("");
      } catch {
        setError("잘못된 JSON 파일입니다.");
        setMessage("");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (window.confirm("모든 Todo 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
      onClear();
      setMessage("전체 Todo 데이터를 초기화했습니다.");
      setError("");
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">설정</h2>
        <p className="mt-2 text-sm text-ink-400">브라우저 저장소와 JSON 백업을 관리합니다.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="저장된 Todo" value={stats.total} icon={<FileJson size={20} />} />
        <StatCard title="완료한 Todo" value={stats.completedTotal} />
        <StatCard title="저장 방식" value="LocalStorage" description="현재 브라우저에만 저장됩니다." />
        <StatCard title="Storage Key" value={TODO_STORAGE_KEY} description="추후 IndexedDB로 교체하기 쉽게 분리했습니다." />
      </section>

      {(message || error) ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          error ? "border-red-400/40 bg-red-500/10 text-red-100" : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
        }`}>
          {error || message}
        </div>
      ) : null}

      <section className="app-card p-5">
        <h3 className="text-lg font-bold text-ink-100">데이터 관리</h3>
        <p className="mt-2 text-sm leading-6 text-ink-400">
          Todo 데이터는 서버로 전송되지 않고 현재 브라우저의 LocalStorage에 저장됩니다. 같은 컴퓨터라도
          브라우저나 프로필이 바뀌면 별도의 데이터로 취급됩니다.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button type="button" className="btn-secondary" onClick={exportJson}>
            <Download size={18} />
            JSON 내보내기
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            JSON 가져오기
          </button>
          <button type="button" className="btn-danger" onClick={clearAll}>
            <Trash2 size={18} />
            전체 초기화
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </section>

      <section className="app-card p-5">
        <div className="flex items-center gap-2">
          <RotateCcw size={18} className="text-accent-400" />
          <h3 className="text-lg font-bold text-ink-100">저장 안내</h3>
        </div>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-400">
          <li>새로고침해도 Todo 데이터는 유지됩니다.</li>
          <li>브라우저 데이터 삭제 또는 시크릿 모드 종료 시 데이터가 사라질 수 있습니다.</li>
          <li>중요한 계획은 JSON 내보내기로 주기적으로 백업하는 것이 좋습니다.</li>
        </ul>
      </section>
    </div>
  );
}
