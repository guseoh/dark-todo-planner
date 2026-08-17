import { useEffect, useMemo, useState } from "react";
import { BellRing, Clock3, X } from "lucide-react";
import { api, jsonBody } from "../../lib/api/client";

type TodoReminder = {
  id: string;
  todoId: string;
  remindAt: string;
  channel: "DISCORD";
  status: "PENDING" | "SENT" | "CANCELLED";
  sentAt?: string | null;
};

type Preset = "10m" | "30m" | "1h" | "tomorrow";

const formatKst = (value?: string | null) => value ? new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value)) : "";

const presetDate = (preset: Preset) => {
  const now = new Date();
  if (preset === "10m") return new Date(now.getTime() + 10 * 60 * 1000);
  if (preset === "30m") return new Date(now.getTime() + 30 * 60 * 1000);
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000);
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate() + 1, 0, 0, 0));
};

export function TodoReminderEditor({ todoId }: { todoId: string }) {
  const [reminder, setReminder] = useState<TodoReminder | null>(null);
  const [customTime, setCustomTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<{ reminder: TodoReminder | null }>(`/api/todos/${todoId}/reminder`)
      .then((result) => { if (active) setReminder(result.reminder); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "알림을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [todoId]);

  const active = reminder?.status === "PENDING";
  const stateText = useMemo(() => {
    if (!reminder || reminder.status === "CANCELLED") return "예약 없음";
    if (reminder.status === "SENT") return `전송 완료 · ${formatKst(reminder.sentAt)}`;
    return `예약 · ${formatKst(reminder.remindAt)}`;
  }, [reminder]);

  const scheduleAt = async (date: Date) => {
    setSaving(true); setMessage("");
    try {
      const result = await api<{ reminder: TodoReminder }>(`/api/todos/${todoId}/reminder`, {
        method: "PUT",
        ...jsonBody({ remindAt: date.toISOString(), channel: "DISCORD" }),
      });
      setReminder(result.reminder);
      setMessage("Discord 알림을 예약했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "알림을 예약하지 못했습니다.");
    } finally { setSaving(false); }
  };

  const applyPreset = async (preset: Preset) => {
    if (!reminder || reminder.status === "CANCELLED") return scheduleAt(presetDate(preset));
    setSaving(true); setMessage("");
    try {
      const result = await api<{ reminder: TodoReminder }>(`/api/todos/${todoId}/reminder/snooze`, {
        method: "POST",
        ...jsonBody({ preset }),
      });
      setReminder(result.reminder);
      setMessage(reminder.status === "SENT" ? "알림을 다시 예약했습니다." : "알림 시각을 변경했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "알림 시각을 변경하지 못했습니다.");
    } finally { setSaving(false); }
  };

  const cancel = async () => {
    setSaving(true); setMessage("");
    try {
      const result = await api<{ reminder: TodoReminder | null }>(`/api/todos/${todoId}/reminder`, { method: "DELETE" });
      setReminder(result.reminder);
      setMessage("알림 예약을 취소했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "알림을 취소하지 못했습니다.");
    } finally { setSaving(false); }
  };

  return (
    <section className="space-y-3 rounded-lg border border-ink-700/60 bg-ink-950/30 p-3 md:col-span-2" aria-label="Todo 알림">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><BellRing size={15} className="text-accent-300" /><p className="text-sm font-semibold text-ink-200">Todo 리마인더</p></div>
          <p className="mt-1 text-xs text-ink-500">Discord로 전송됩니다. 이 영역의 변경은 Todo 저장과 별개로 즉시 반영됩니다.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? "border-accent-500/30 text-accent-100" : "border-ink-700 text-ink-400"}`}>{loading ? "확인 중" : stateText}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={saving || loading} onClick={() => void applyPreset("10m")}>10분 후</button>
        <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={saving || loading} onClick={() => void applyPreset("30m")}>30분 후</button>
        <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={saving || loading} onClick={() => void applyPreset("1h")}>1시간 후</button>
        <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={saving || loading} onClick={() => void applyPreset("tomorrow")}>내일 오전 9시</button>
        {active ? <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs text-red-200" disabled={saving} onClick={() => void cancel()}><X size={13} />취소</button> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="space-y-1 text-xs font-semibold text-ink-400"><span className="inline-flex items-center gap-1"><Clock3 size={12} />직접 지정</span><input className="field" type="datetime-local" value={customTime} onChange={(event) => setCustomTime(event.target.value)} /></label>
        <button type="button" className="btn-secondary self-end" disabled={!customTime || saving} onClick={() => { const date = new Date(customTime); if (!Number.isNaN(date.getTime())) void scheduleAt(date); }}>이 시각으로 예약</button>
      </div>
      {message ? <p className="text-xs font-semibold text-ink-300" aria-live="polite">{message}</p> : null}
    </section>
  );
}
