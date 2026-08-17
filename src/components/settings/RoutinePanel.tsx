import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarPlus2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, jsonBody } from "../../lib/api/client";
import { todayKey } from "../../lib/date";
import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import { Modal } from "../common/Modal";

type RoutineItem = {
  id?: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  estimateMinutes?: number | null;
  projectId?: string | null;
  categoryId?: string | null;
  order?: number;
};

type Routine = {
  id: string;
  name: string;
  description?: string | null;
  lastRunDate?: string | null;
  items: RoutineItem[];
  createdAt: string;
  updatedAt: string;
};

type DraftItem = {
  key: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  estimateMinutes: string;
  projectId: string;
  categoryId: string;
};

const newItem = (): DraftItem => ({ key: crypto.randomUUID(), title: "", priority: "MEDIUM", estimateMinutes: "", projectId: "", categoryId: "" });
const messageOf = (error: unknown) => error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";

export function RoutinePanel({ categories, projects, onTodosCreated }: { categories: Category[]; projects: Project[]; onTodosCreated: () => unknown | Promise<unknown> }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState("");
  const [message, setMessage] = useState("");

  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const today = todayKey();

  const load = async () => {
    setLoading(true);
    try {
      const result = await api<{ routines: Routine[] }>("/api/routines");
      setRoutines(result.routines);
    } catch (error) { setMessage(messageOf(error)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing("new"); setName(""); setDescription(""); setItems([newItem()]); setMessage("");
  };

  const openEdit = (routine: Routine) => {
    setEditing(routine); setName(routine.name); setDescription(routine.description || "");
    setItems(routine.items.map((item) => ({
      key: item.id || crypto.randomUUID(), title: item.title, priority: item.priority,
      estimateMinutes: item.estimateMinutes ? String(item.estimateMinutes) : "",
      projectId: item.projectId || "", categoryId: item.categoryId || "",
    })));
    setMessage("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const validItems = items.filter((item) => item.title.trim());
    if (!name.trim() || !validItems.length) return;
    setSaving(true); setMessage("");
    const body = {
      name: name.trim(), description: description.trim() || null,
      items: validItems.map((item) => ({
        title: item.title.trim(), priority: item.priority,
        estimateMinutes: item.estimateMinutes ? Number(item.estimateMinutes) : null,
        projectId: item.projectId || null, categoryId: item.categoryId || null,
      })),
    };
    try {
      const path = editing === "new" ? "/api/routines" : `/api/routines/${editing?.id}`;
      const result = await api<{ routines: Routine[] }>(path, { method: editing === "new" ? "POST" : "PUT", ...jsonBody(body) });
      setRoutines(result.routines); setEditing(null); setMessage("루틴을 저장했습니다.");
    } catch (error) { setMessage(messageOf(error)); }
    finally { setSaving(false); }
  };

  const remove = async (routine: Routine) => {
    if (!window.confirm(`“${routine.name}” 루틴을 삭제할까요? 이미 생성한 Todo는 유지됩니다.`)) return;
    setMessage("");
    try { await api(`/api/routines/${routine.id}`, { method: "DELETE" }); setRoutines((current) => current.filter((entry) => entry.id !== routine.id)); }
    catch (error) { setMessage(messageOf(error)); }
  };

  const runToday = async (routine: Routine) => {
    if (routine.lastRunDate === today) {
      setMessage(`“${routine.name}”은 오늘 이미 생성했습니다.`);
      return;
    }
    setRunningId(routine.id); setMessage("");
    try {
      const result = await api<{ todoCount: number; targetDate: string }>(`/api/routines/${routine.id}/run`, { method: "POST", ...jsonBody({ targetDate: today }) });
      setRoutines((current) => current.map((entry) => entry.id === routine.id ? { ...entry, lastRunDate: result.targetDate } : entry));
      await Promise.resolve(onTodosCreated());
      setMessage(`“${routine.name}”에서 오늘 Todo ${result.todoCount}개를 생성했습니다.`);
    } catch (error) { setMessage(messageOf(error)); }
    finally { setRunningId(""); }
  };

  return (
    <section className="app-card p-4 sm:p-5" aria-labelledby="routine-panel-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 id="routine-panel-title" className="text-base font-bold text-ink-100">Routine Bundle</h3><p className="mt-1 text-xs text-ink-400">반복해서 만드는 Todo 묶음을 저장하고 오늘 일정으로 한 번에 생성합니다.</p></div>
        <div className="flex gap-2"><button type="button" className="btn-secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />새로고침</button><button type="button" className="btn-primary" onClick={openCreate}><Plus size={15} />루틴 만들기</button></div>
      </div>
      {message ? <div className="mt-3 rounded-lg border border-ink-700/70 bg-ink-950/35 px-3 py-2 text-xs font-semibold text-ink-300" aria-live="polite">{message}</div> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {routines.map((routine) => {
          const ranToday = routine.lastRunDate === today;
          return (
            <article key={routine.id} className="rounded-xl border border-ink-700/70 bg-ink-950/30 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div><h4 className="text-sm font-bold text-ink-100">{routine.name}</h4>{routine.description ? <p className="mt-1 text-xs leading-5 text-ink-400">{routine.description}</p> : null}</div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {ranToday ? <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/[0.07] px-2 py-0.5 text-[11px] font-semibold text-emerald-100"><CalendarCheck2 size={12} />오늘 생성 완료</span> : null}
                  <span className="rounded-full border border-ink-700 px-2 py-0.5 text-[11px] font-semibold text-ink-400">{routine.items.length}개</span>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-ink-400">{routine.items.slice(0, 5).map((item) => <li key={item.id || item.title} className="flex items-center justify-between gap-2"><span className="truncate">• {item.title}</span><span className="shrink-0 text-ink-500">{item.estimateMinutes ? `${item.estimateMinutes}분` : item.priority}</span></li>)}{routine.items.length > 5 ? <li className="text-ink-500">외 {routine.items.length - 5}개</li> : null}</ul>
              {ranToday ? <p className="mt-3 rounded-lg border border-success/20 bg-success/[0.05] px-3 py-2 text-xs text-emerald-100">오늘 Todo는 이미 생성됐습니다. 내일 다시 생성할 수 있습니다.</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-800 pt-3">
                <button type="button" className={ranToday ? "btn-secondary min-h-9 px-3 py-1.5 text-xs" : "btn-primary min-h-9 px-3 py-1.5 text-xs"} disabled={runningId === routine.id || ranToday} onClick={() => void runToday(routine)}>
                  {ranToday ? <CalendarCheck2 size={14} /> : <CalendarPlus2 size={14} />}
                  {runningId === routine.id ? "생성 중..." : ranToday ? "오늘 생성됨" : "오늘 루틴 생성"}
                </button>
                <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" onClick={() => openEdit(routine)}><Pencil size={14} />수정</button>
                <button type="button" className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-ink-500 hover:bg-red-500/10 hover:text-red-200" onClick={() => void remove(routine)}><Trash2 size={14} />삭제</button>
              </div>
            </article>
          );
        })}
        {!loading && !routines.length ? <div className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-500 lg:col-span-2">아직 저장된 루틴이 없습니다.</div> : null}
      </div>

      {editing ? <Modal title={editing === "new" ? "루틴 만들기" : "루틴 수정"} description="항목별 프로젝트·카테고리·우선순위·예상 시간을 저장할 수 있습니다." onClose={() => setEditing(null)} size="lg">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm text-ink-400">이름<input className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required data-modal-initial-focus /></label><label className="space-y-1 text-sm text-ink-400">설명<input className="field" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="출근 준비, 공부 시작 루틴..." /></label></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm font-bold text-ink-200">Todo 항목</p><button type="button" className="btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => setItems((current) => [...current, newItem()])}><Plus size={13} />항목 추가</button></div>
            {items.map((item, index) => <div key={item.key} className="grid gap-2 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:grid-cols-[minmax(0,1.6fr)_8rem_7rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input className="field" value={item.title} onChange={(event) => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, title: event.target.value } : entry))} placeholder={`항목 ${index + 1} 제목`} maxLength={240} />
              <select className="field" value={item.priority} onChange={(event) => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, priority: event.target.value as DraftItem["priority"] } : entry))}><option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option></select>
              <input className="field" type="number" min="1" max="1440" value={item.estimateMinutes} onChange={(event) => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, estimateMinutes: event.target.value } : entry))} placeholder="분" />
              <select className="field" value={item.projectId} onChange={(event) => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, projectId: event.target.value } : entry))}><option value="">프로젝트 없음</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              <select className="field" value={item.categoryId} onChange={(event) => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, categoryId: event.target.value } : entry))}><option value="">미분류</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-red-500/10 hover:text-red-200" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}><Trash2 size={15} /></button>
            </div>)}
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4"><button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>취소</button><button type="submit" className="btn-primary" disabled={saving || !name.trim() || !items.some((item) => item.title.trim())}>{saving ? "저장 중..." : "저장"}</button></div>
        </form>
      </Modal> : null}
    </section>
  );
}
