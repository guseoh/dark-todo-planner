import {
  Calendar,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FolderKanban,
  Inbox,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppView = "today" | "inbox" | "planning" | "week" | "month" | "projects" | "all" | "memo" | "trash" | "settings";

type SidebarProps = { activeView: AppView; onChangeView: (view: AppView) => void };
type NavItem = { id: AppView; label: string; icon: typeof CalendarCheck };
type SidebarMode = "expanded" | "collapsed";

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "실행",
    items: [
      { id: "today", label: "오늘", icon: CalendarCheck },
      { id: "inbox", label: "Inbox", icon: Inbox },
      { id: "planning", label: "계획", icon: ListTodo },
    ],
  },
  {
    label: "보기",
    items: [
      { id: "week", label: "주간", icon: CalendarRange },
      { id: "month", label: "월간", icon: Calendar },
      { id: "projects", label: "프로젝트", icon: FolderKanban },
      { id: "all", label: "전체 Todo", icon: ClipboardList },
    ],
  },
  {
    label: "관리",
    items: [
      { id: "memo", label: "메모", icon: StickyNote },
      { id: "trash", label: "휴지통", icon: Trash2 },
      { id: "settings", label: "설정", icon: Settings },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);
const SIDEBAR_MODE_KEY = "dark-todo-planner:sidebar-mode";
const LEGACY_SIDEBAR_COLLAPSED_KEY = "dark-todo-planner:sidebar-collapsed";

const readInitialMode = (): SidebarMode => {
  if (typeof window === "undefined") return "expanded";
  const storedMode = localStorage.getItem(SIDEBAR_MODE_KEY);
  if (storedMode === "expanded" || storedMode === "collapsed") return storedMode;
  return localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) === "true" ? "collapsed" : "expanded";
};

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  const [mode, setMode] = useState<SidebarMode>(readInitialMode);
  const activeMobileItemRef = useRef<HTMLButtonElement | null>(null);
  const collapsed = mode === "collapsed";

  useEffect(() => {
    localStorage.setItem(SIDEBAR_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    activeMobileItemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeView]);

  const renderDesktopItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeView === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onChangeView(item.id)}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`group relative flex min-h-10 w-full items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
          active
            ? "bg-ink-800 text-ink-100"
            : "text-ink-400 hover:bg-ink-800/75 hover:text-ink-100"
        } ${collapsed ? "justify-center px-2" : "gap-3 px-3 text-left"}`}
      >
        {active ? <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent-500" /> : null}
        <Icon size={17} className="shrink-0" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {collapsed ? (
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-ink-100 shadow-xl group-hover:block group-focus-visible:block">
            {item.label}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      <aside
        className={`relative z-20 hidden shrink-0 transition-[width] duration-200 ease-out lg:block ${
          collapsed ? "w-[4.25rem]" : "w-[16.25rem]"
        }`}
        data-sidebar-mode={mode}
      >
        <nav className="sticky top-[4.75rem] flex h-[calc(100vh-5.75rem)] min-h-[30rem] flex-col overflow-visible rounded-xl border border-ink-700/70 bg-ink-900 px-2 py-2.5">
          <div className="min-h-0 flex-1 overflow-visible">
            <div className="space-y-4">
              {navGroups.map((group, index) => (
                <section key={group.label} className={collapsed && index > 0 ? "border-t border-ink-700/60 pt-3" : ""}>
                  {!collapsed ? (
                    <p className="mb-1.5 px-3 text-[11px] font-medium text-ink-500">{group.label}</p>
                  ) : null}
                  <div className="space-y-1">{group.items.map(renderDesktopItem)}</div>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-ink-700/70 pt-2.5">
            <button
              type="button"
              onClick={() => setMode((current) => current === "expanded" ? "collapsed" : "expanded")}
              className={`group relative flex min-h-10 w-full items-center rounded-lg text-sm font-semibold text-ink-400 transition-colors hover:bg-ink-800/75 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
                collapsed ? "justify-center px-2" : "justify-between gap-3 px-3 text-left"
              }`}
              aria-label={collapsed ? "사이드바 펼쳐서 고정" : "사이드바 축소"}
              aria-pressed={!collapsed}
              title={collapsed ? "사이드바 펼쳐서 고정" : "사이드바 축소"}
            >
              {collapsed ? (
                <PanelLeftOpen size={17} />
              ) : (
                <>
                  <span>사이드바 축소</span>
                  <PanelLeftClose size={17} className="shrink-0" />
                </>
              )}
              {collapsed ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-ink-100 shadow-xl group-hover:block group-focus-visible:block">
                  사이드바 펼쳐서 고정
                </span>
              ) : null}
            </button>
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/70 bg-ink-950/96 px-2 py-1.5 backdrop-blur-xl lg:hidden">
        <div className="relative">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  ref={active ? activeMobileItemRef : null}
                  type="button"
                  onClick={() => onChangeView(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold transition ${
                    active ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:bg-ink-800 hover:text-ink-100"
                  }`}
                >
                  <Icon size={17} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-ink-950 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-ink-950 to-transparent" />
        </div>
      </nav>
    </>
  );
}
