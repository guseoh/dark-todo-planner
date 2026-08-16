import { FormEvent, useEffect, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { todayKey } from "../../lib/date";
import type { ProjectDecision, ProjectDecisionInput } from "../../types/project";

type ProjectDecisionLogProps = {
  projectId: string;
  archived: boolean;
  decisions: ProjectDecision[];
  onAdd: (input: ProjectDecisionInput) => Promise<ProjectDecision | undefined> | ProjectDecision | undefined;
  onDelete: (id: string) => Promise<boolean> | boolean;
};

export function ProjectDecisionLog({ projectId, archived, decisions, onAdd, onDelete }: ProjectDecisionLogProps) {
  const [title, setTitle] = useState("");
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [decidedAt, setDecidedAt] = useState(todayKey());

  useEffect(() => {
    setTitle("");
    setDecision("");
    setRationale("");
    setDecidedAt(todayKey());
  }, [projectId]);

  const createDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !decision.trim()) return;

    const created = await onAdd({
      projectId,
      title: title.trim(),
      decision: decision.trim(),
      rationale: rationale.trim() || undefined,
      decidedAt,
    });
    if (!created) return;

    setTitle("");
    setDecision("");
    setRationale("");
    setDecidedAt(todayKey());
  };

  return (
    <section className="app-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch size={17} className="text-accent-300" />
        <h3 className="font-bold text-ink-100">Decision Log</h3>
      </div>

      {!archived ? (
        <form className="mb-4 grid gap-2 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_9rem_auto]" onSubmit={createDecision}>
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="결정 제목" />
          <input className="field" value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="무엇을 결정했나" />
          <input className="field" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="이유 / 트레이드오프" />
          <input className="field" type="date" value={decidedAt} onChange={(event) => setDecidedAt(event.target.value)} />
          <button className="btn-secondary" type="submit" disabled={!title.trim() || !decision.trim()}><Plus size={15} />기록</button>
        </form>
      ) : null}

      <div className="space-y-2">
        {decisions.length ? decisions.map((item) => (
          <article key={item.id} className="rounded-lg border border-ink-800/80 bg-ink-950/25 p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-ink-100">{item.title}</h4>
                  <span className="text-[11px] text-ink-500">{item.decidedAt}</span>
                </div>
                <p className="mt-2 text-sm text-ink-200">{item.decision}</p>
                {item.rationale ? <p className="mt-2 text-xs text-ink-500">근거: {item.rationale}</p> : null}
              </div>
              <button type="button" className="icon-btn h-9 w-9 rounded-md hover:text-red-200" onClick={() => window.confirm("이 의사결정 기록을 삭제할까요?") && void onDelete(item.id)} aria-label="의사결정 기록 삭제">
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        )) : <p className="py-4 text-center text-sm text-ink-500">아직 남긴 의사결정 기록이 없습니다.</p>}
      </div>
    </section>
  );
}
