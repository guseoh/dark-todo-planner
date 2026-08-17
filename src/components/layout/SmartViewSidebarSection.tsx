import { AlertTriangle, Clock3, Cloud, Flag, FolderMinus, Inbox, PauseCircle, Sparkles } from "lucide-react";

export type SidebarSmartView = {
  id: string;
  label: string;
  count: number;
};

const icons = {
  inbox: Inbox,
  overdue: AlertTriangle,
  "due-soon": Clock3,
  waiting: PauseCircle,
  someday: Cloud,
  high: Flag,
  "no-project": FolderMinus,
} as const;

export function SmartViewSidebarSection({
  views,
  activeId,
  expanded,
  onOpen,
}: {
  views: SidebarSmartView[];
  activeId?: string | null;
  expanded: boolean;
  onOpen: (id: string) => void;
}) {
  if (!views.length) return null;

  return (
    <section className="border-b border-ink-700/60 pb-3">
      {expanded ? <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-medium text-ink-500"><Sparkles size={12} />Smart View</p> : null}
      <div className="space-y-1">
        {views.map((view) => {
          const Icon = icons[view.id as keyof typeof icons] || Sparkles;
          const active = activeId === view.id;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onOpen(view.id)}
              aria-current={active ? "page" : undefined}
              aria-label={`${view.label} Smart View, ${view.count}개`}
              title={expanded ? undefined : `${view.label} · ${view.count}`}
              className={`relative flex min-h-9 w-full items-center rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${active ? "bg-accent-500/[0.09] text-accent-100" : "text-ink-400 hover:bg-ink-800/75 hover:text-ink-100"} ${expanded ? "gap-2.5 px-3 text-left" : "justify-center px-2"}`}
            >
              {active ? <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent-500" /> : null}
              <Icon size={15} className="shrink-0" />
              {expanded ? <><span className="min-w-0 flex-1 truncate">{view.label}</span><span className="shrink-0 rounded-full bg-ink-950/70 px-1.5 py-0.5 text-[10px] text-ink-500">{view.count}</span></> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
