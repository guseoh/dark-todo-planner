import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Pause, Play, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import { todayKey } from "../../lib/date";
import type { Todo } from "../../types/todo";
import type { FocusSession, FocusSessionInput, TimeBlock, TimeBlockInput, TimerSettings, TimerSettingsInput } from "../../types/time";

const formatClock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function TimePlanningPanel({
  todos,
  focusSessions,
  timeBlocks,
  timerSettings,
  onAddFocusSession,
  onSaveTimerSettings,
  onAddTimeBlock,
  onUpdateTimeBlock,
  onDeleteTimeBlock,
}: {
  todos: Todo[];
  focusSessions: FocusSession[];
  timeBlocks: TimeBlock[];
  timerSettings: TimerSettings;
  onAddFocusSession: (input: FocusSessionInput) => Promise<FocusSession | undefined>;
  onSaveTimerSettings: (input: TimerSettingsInput) => Promise<TimerSettings | undefined>;
  onAddTimeBlock: (input: TimeBlockInput) => Promise<TimeBlock | undefined>;
  onUpdateTimeBlock: (id: string, input: TimeBlockInput) => Promise<TimeBlock | undefined>;
  onDeleteTimeBlock: (id: string) => Promise<boolean>;
}) {
  const today = todayKey();
  const activeTodos = useMemo(() => todos.filter((todo) => !todo.archived && !todo.completed), [todos]);
  const todayFocusSessions = useMemo(() => focusSessions
    .filter((session) => session.plannerDate === today && session.mode === "FOCUS" && session.completed)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt)), [focusSessions, today]);
  const [message, setMessage] = useState("");
  const [selectedTodoId, setSelectedTodoId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(timerSettings.focusMinutes || 25);
  const [remainingSeconds, setRemainingSeconds] = useState((timerSettings.focusMinutes || 25) * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (running || startedAt) return;
    const minutes = timerSettings.focusMinutes || 25;
    setDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
  }, [running, startedAt, timerSettings.focusMinutes]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setRemainingSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const resetTimer = useCallback((minutes = durationMinutes) => {
    setRunning(false);
    setStartedAt(null);
    setRemainingSeconds(minutes * 60);
  }, [durationMinutes]);

  const recordFocus = useCallback(async (minutes: number) => {
    if (recording) return;
    setRecording(true);
    const endedAt = new Date().toISOString();
    const session = await onAddFocusSession({
      todoId: selectedTodoId || undefined,
      mode: "FOCUS",
      durationMinutes: Math.max(1, minutes),
      plannerDate: today,
      startedAt: startedAt || endedAt,
      endedAt,
      completed: true,
    });
    setRecording(false);
    if (session) {
      setMessage(`집중 ${session.durationMinutes}분을 기록했습니다.`);
      resetTimer(durationMinutes);
    } else {
      setMessage("집중 기록을 저장하지 못했습니다.");
    }
  }, [durationMinutes, onAddFocusSession, recording, resetTimer, selectedTodoId, startedAt, today]);

  useEffect(() => {
    if (!running || remainingSeconds !== 0 || recording) return;
    setRunning(false);
    void recordFocus(durationMinutes);
  }, [durationMinutes, recordFocus, recording, remainingSeconds, running]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const startTimer = () => {
    if (!startedAt) setStartedAt(new Date().toISOString());
    setRunning(true);
  };

  const finishEarly = async () => {
    const elapsedSeconds = durationMinutes * 60 - remainingSeconds;
    if (elapsedSeconds <= 0) return;
    setRunning(false);
    await recordFocus(Math.max(1, Math.ceil(elapsedSeconds / 60)));
  };

  const changeDuration = (value: number) => {
    const next = Math.min(180, Math.max(1, value || 1));
    setDurationMinutes(next);
    if (!startedAt) setRemainingSeconds(next * 60);
  };

  const saveFocusDefault = async () => {
    const saved = await onSaveTimerSettings({
      focusMinutes: durationMinutes,
      shortBreakMinutes: timerSettings.shortBreakMinutes || 5,
      longBreakMinutes: timerSettings.longBreakMinutes || 15,
      sessionsBeforeLongBreak: timerSettings.sessionsBeforeLongBreak || 4,
      soundEnabled: timerSettings.soundEnabled ?? true,
      notificationEnabled: timerSettings.notificationEnabled ?? false,
    });
    setMessage(saved ? "기본 집중 시간을 저장했습니다." : "타이머 설정을 저장하지 못했습니다.");
  };

  const [blockTitle, setBlockTitle] = useState("");
  const [blockTodoId, setBlockTodoId] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");

  const createBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!blockTitle.trim()) return;
    const created = await onAddTimeBlock({ todoId: blockTodoId || undefined, title: blockTitle.trim(), date: today, startTime: blockStart, endTime: blockEnd });
    if (created) {
      setBlockTitle("");
      setBlockTodoId("");
      setMessage("오늘 시간 블록을 추가했습니다.");
    }
  };

  const toggleBlock = async (block: TimeBlock) => {
    await onUpdateTimeBlock(block.id, {
      todoId: block.todoId,
      title: block.title,
      date: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      completed: !block.completed,
    });
  };

  const plannedToday = timeBlocks.filter((block) => block.date === today).reduce((sum, block) => sum + block.plannedMinutes, 0);
  const actualToday = todayFocusSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const todayBlocks = timeBlocks.filter((block) => block.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-lg border border-accent-500/35 bg-accent-500/10 px-3 py-2 text-sm font-semibold text-accent-200" aria-live="polite">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="app-card p-4">
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-accent-300" /><h3 className="font-bold text-ink-100">Focus Timer</h3></div>
          <p className="mt-1 text-xs text-ink-500">집중이 끝나면 실제 집중 시간을 기록해 계획 시간과 비교합니다.</p>

          <div className="mt-5 rounded-xl border border-ink-800 bg-ink-950/45 p-5 text-center">
            <p className="font-mono text-5xl font-bold tracking-tight text-ink-100">{formatClock(remainingSeconds)}</p>
            <p className="mt-2 text-xs text-ink-500">{selectedTodoId ? activeTodos.find((todo) => todo.id === selectedTodoId)?.title || "선택 Todo" : "Todo 연결 없음"}</p>
          </div>

          <div className="mt-4 space-y-3">
            <select className="field" value={selectedTodoId} onChange={(event) => setSelectedTodoId(event.target.value)} disabled={Boolean(startedAt)}>
              <option value="">Todo 연결 없음</option>
              {activeTodos.map((todo) => <option key={todo.id} value={todo.id}>{todo.title}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="field" type="number" min="1" max="180" value={durationMinutes} onChange={(event) => changeDuration(Number(event.target.value))} disabled={Boolean(startedAt)} aria-label="집중 시간(분)" />
              <button type="button" className="btn-secondary shrink-0" onClick={() => void saveFocusDefault()} disabled={Boolean(startedAt)}><Save size={15} />기본값</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" className="btn-primary justify-center" onClick={startTimer} disabled={running || recording}><Play size={15} />{startedAt ? "계속" : "시작"}</button>
              <button type="button" className="btn-secondary justify-center" onClick={() => setRunning(false)} disabled={!running}><Pause size={15} />일시정지</button>
              <button type="button" className="btn-secondary justify-center" onClick={() => resetTimer()} disabled={recording}><RotateCcw size={15} />초기화</button>
              <button type="button" className="btn-secondary justify-center" onClick={() => void finishEarly()} disabled={!startedAt || recording}><Square size={15} />기록 종료</button>
            </div>
          </div>
        </section>

        <section className="app-card p-4">
          <h3 className="font-bold text-ink-100">오늘 계획 vs 실제</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-ink-950/45 p-3"><p className="text-xs text-ink-500">Time Block</p><p className="mt-1 text-xl font-bold text-ink-100">{plannedToday}분</p></div>
            <div className="rounded-lg bg-ink-950/45 p-3"><p className="text-xs text-ink-500">집중 기록</p><p className="mt-1 text-xl font-bold text-ink-100">{actualToday}분</p></div>
            <div className="rounded-lg bg-ink-950/45 p-3"><p className="text-xs text-ink-500">차이</p><p className="mt-1 text-xl font-bold text-ink-100">{actualToday - plannedToday > 0 ? "+" : ""}{actualToday - plannedToday}분</p></div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-ink-200">오늘 집중 기록</p>
            <div className="mt-2 space-y-2">
              {todayFocusSessions.slice(0, 8).map((session) => <div key={session.id} className="flex items-center justify-between rounded-lg bg-ink-950/35 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink-200">{session.todoTitle || "자유 집중"}</p><p className="mt-0.5 text-xs text-ink-500">{new Date(session.endedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p></div><span className="text-sm font-bold text-accent-200">{session.durationMinutes}분</span></div>)}
              {!todayFocusSessions.length ? <p className="py-4 text-center text-sm text-ink-500">오늘 집중 기록이 없습니다.</p> : null}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <form className="app-card space-y-3 p-4" onSubmit={createBlock}>
          <h3 className="font-bold text-ink-100">Time Blocking</h3>
          <input className="field" value={blockTitle} onChange={(event) => setBlockTitle(event.target.value)} placeholder="시간 블록 이름" />
          <select className="field" value={blockTodoId} onChange={(event) => setBlockTodoId(event.target.value)}><option value="">Todo 연결 없음</option>{activeTodos.map((todo) => <option key={todo.id} value={todo.id}>{todo.title}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input className="field" type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} /><input className="field" type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} /></div>
          <button type="submit" className="btn-primary w-full justify-center">시간 블록 추가</button>
        </form>

        <section className="app-card p-4">
          <h3 className="font-bold text-ink-100">오늘 시간표</h3>
          <div className="mt-3 space-y-2">
            {todayBlocks.map((block) => <div key={block.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${block.completed ? "border-emerald-500/25 bg-emerald-500/5" : "border-ink-800 bg-ink-950/35"}`}>
              <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void toggleBlock(block)} aria-label={block.completed ? "시간 블록 완료 취소" : "시간 블록 완료"}>{block.completed ? <CheckCircle2 size={15} className="text-emerald-300" /> : <Clock3 size={15} />}</button>
              <div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${block.completed ? "text-ink-400 line-through" : "text-ink-100"}`}>{block.title}</p><p className="mt-1 text-xs text-ink-500">{block.startTime}–{block.endTime} · {block.plannedMinutes}분{block.todoId ? ` · ${todos.find((todo) => todo.id === block.todoId)?.title || "Todo"}` : ""}</p></div>
              <button type="button" className="icon-btn h-9 w-9 rounded-md" onClick={() => void onDeleteTimeBlock(block.id)} aria-label={`${block.title} 삭제`}><Trash2 size={14} /></button>
            </div>)}
            {!todayBlocks.length ? <p className="py-8 text-center text-sm text-ink-500">오늘 등록한 시간 블록이 없습니다.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
