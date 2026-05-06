import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Archive,
  Clock3,
  NotebookPen,
  LayoutDashboard,
  ListChecks,
  Settings,
  Target,
  FolderKanban,
} from "lucide-react";

export type AppView =
  | "dashboard"
  | "today"
  | "week"
  | "month"
  | "all"
  | "categories"
  | "timer"
  | "reflection"
  | "goals"
  | "archive"
  | "settings";

type SidebarProps = {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
};

const navItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "today", label: "오늘", icon: CheckSquare },
  { id: "week", label: "주간", icon: CalendarRange },
  { id: "month", label: "월간", icon: CalendarDays },
  { id: "all", label: "전체 Todo", icon: ListChecks },
  { id: "categories", label: "카테고리", icon: FolderKanban },
  { id: "timer", label: "타이머", icon: Clock3 },
  { id: "reflection", label: "회고", icon: NotebookPen },
  { id: "goals", label: "목표", icon: Target },
  { id: "archive", label: "보관함", icon: Archive },
  { id: "settings", label: "설정", icon: Settings },
] satisfies Array<{ id: AppView; label: string; icon: typeof LayoutDashboard }>;

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav className="sticky top-24 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 text-left text-sm font-semibold transition ${
                  active
                    ? "border-accent-500/50 bg-accent-500/20 text-ink-100"
                    : "border-transparent text-ink-400 hover:border-ink-700 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition ${
                  active ? "bg-accent-500 text-white" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                <Icon size={18} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
