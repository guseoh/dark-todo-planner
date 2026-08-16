import {
  Calendar,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FolderKanban,
  Inbox,
  ListTodo,
  StickyNote,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppView = "today" | "inbox" | "planning" | "week" | "month" | "projects" | "all" | "memo" | "trash" | "settings";

type SidebarProps = { activeView: AppView; onChangeView: (view: AppView) => void; };
type NavItem = { id: AppView; label: string; icon: typeof CalendarCheck };

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
    label: "기록 · 관리",
    items: [
      { id: "memo", label: "메모", icon: StickyNote },
      { id: "trash", label: "휴지통", icon: Trash2 },
      { id: "settings", label: "설정", icon: Settings },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);
const SIDEBAR_COLLAPSED_KEY = "dark-todo-planner:sidebar-collapsed";
const readInitialCollapsed = () => typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const activeMobileItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed)); }, [collapsed]);
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
        className={`group relative flex min-h-10 w-full items-center rounded-md border text-sm font-semibold transition ${active ? "border-accent-500/35 bg-accent-500/15 text-ink-100" : "border-transparent text-ink-400 hover:border-ink-700/70 hover:bg-ink-900 hover:text-ink-100"} ${collapsed ? "justify-center px-2" : "gap-3 px-3 text-left"}`}
      >
        <Icon size={17} />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {collapsed ? <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-ink-700/70 bg-ink-950 px-2.5 py-1.5 text-xs font-semibold text-ink-100 shadow-xl group-hover:block group-focus-visible:block">{item.label}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside className={`relative z-20 hidden shrink-0 overflow-visible transition-all duration-200 lg:block ${collapsed ? "w-14" : "w-[13.5rem]"}`}>
        <nav className="sticky top-20 overflow-visible rounded-lg border border-ink-700/45 bg-ink-900/45 p-2 backdrop-blur-xl">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className={`mb-2 flex min-h-9 w-full items-center rounded-md border border-ink-700/55 bg-ink-950/45 text-xs font-semibold text-ink-400 transition hover:border-accent-500/50 hover:bg-ink-800 hover:text-ink-100 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`} aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"} title={collapsed ? "펼치기" : "접기"}>
            {collapsed ? <PanelLeftOpen size={16} /> : <span>메뉴 접기</span>}{!collapsed ? <PanelLeftClose size={16} /> : null}
          </button>

          <div className="space-y-3">
            {navGroups.map((group, index) => (
              <div key={group.label} className={collapsed && index > 0 ? "border-t border-ink-700/45 pt-2" : ""}>
                {!collapsed ? <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-600">{group.label}</p> : null}
                <div className="space-y-1">{group.items.map(renderDesktopItem)}</div>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/60 bg-ink-950/96 px-2 py-1.5 backdrop-blur-xl lg:hidden">
        <div className="relative">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button key={item.id} ref={active ? activeMobileItemRef : null} type="button" onClick={() => onChangeView(item.id)} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold transition ${active ? "bg-accent-500 text-white" : "text-ink-500 hover:bg-ink-800 hover:text-ink-100"}`}>
                  <Icon size={17} /><span className="truncate">{item.label}</span>
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
