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
  Search,
  Settings,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppView = "today" | "inbox" | "planning" | "week" | "month" | "projects" | "all" | "memo" | "trash" | "settings";

type SidebarProps = {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  onSearch: () => void;
};
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
    ],
  },
];

const settingsItem: NavItem = { id: "settings", label: "설정", icon: Settings };
const navItems = [...navGroups.flatMap((group) => group.items), settingsItem];
const SIDEBAR_MODE_KEY = "dark-todo-planner:sidebar-mode";
const LEGACY_SIDEBAR_COLLAPSED_KEY = "dark-todo-planner:sidebar-collapsed";
const HOVER_OPEN_DELAY_MS = 110;
const HOVER_CLOSE_DELAY_MS = 140;

const readInitialMode = (): SidebarMode => {
  if (typeof window === "undefined") return "expanded";
  const storedMode = localStorage.getItem(SIDEBAR_MODE_KEY);
  if (storedMode === "expanded" || storedMode === "collapsed") return storedMode;
  return localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) === "true" ? "collapsed" : "expanded";
};

export function Sidebar({ activeView, onChangeView, onSearch }: SidebarProps) {
  const [mode, setMode] = useState<SidebarMode>(readInitialMode);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const activeMobileItemRef = useRef<HTMLButtonElement | null>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const collapsed = mode === "collapsed";
  const showExpandedContent = !collapsed || hoverExpanded;

  const clearHoverTimers = () => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const openHoverPanel = () => {
    if (!collapsed) return;
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    if (hoverExpanded || hoverOpenTimerRef.current !== null) return;
    hoverOpenTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(true);
      hoverOpenTimerRef.current = null;
    }, HOVER_OPEN_DELAY_MS);
  };

  const closeHoverPanel = () => {
    if (!collapsed) return;
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (!hoverExpanded || hoverCloseTimerRef.current !== null) return;
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(false);
      hoverCloseTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    localStorage.setItem(SIDEBAR_MODE_KEY, mode);
    if (mode === "expanded") setHoverExpanded(false);
  }, [mode]);

  useEffect(() => () => clearHoverTimers(), []);

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
        title={collapsed && !hoverExpanded ? item.label : undefined}
        className={`relative flex min-h-10 w-full items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
          active
            ? "bg-ink-800 text-ink-100"
            : "text-ink-400 hover:bg-ink-800/75 hover:text-ink-100"
        } ${showExpandedContent ? "gap-3 px-3 text-left" : "justify-center px-2"}`}
      >
        {active ? <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent-500" /> : null}
        <Icon size={17} className="shrink-0" />
        {showExpandedContent ? <span className="truncate">{item.label}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside
        className={`sticky top-14 z-20 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start transition-[width] duration-150 ease-out lg:block ${
          showExpandedContent ? "w-[16.25rem]" : "w-[4.25rem]"
        }`}
        data-sidebar-mode={mode}
        data-sidebar-hover-expanded={hoverExpanded ? "true" : "false"}
      >
        <nav
          className="flex h-full min-h-0 w-full flex-col border-r border-ink-700/65 bg-ink-900 px-2 py-2.5"
          onMouseEnter={openHoverPanel}
          onMouseLeave={closeHoverPanel}
          onFocusCapture={openHoverPanel}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeHoverPanel();
          }}
        >
          <button
            type="button"
            onClick={() => onChangeView("today")}
            aria-label="Todo Planner 홈"
            title={collapsed && !hoverExpanded ? "Todo Planner" : undefined}
            className={`mb-2 flex min-h-10 shrink-0 items-center rounded-lg text-left transition-colors hover:bg-ink-800/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
              showExpandedContent ? "gap-2.5 px-2.5" : "justify-center px-2"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-500 text-white">
              <CalendarCheck size={18} />
            </span>
            {showExpandedContent ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink-100">Todo Planner</span>
                <span className="block truncate text-[10px] text-ink-500">개인 작업 관리</span>
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onSearch}
            aria-label="빠른 검색 및 명령"
            title={collapsed && !hoverExpanded ? "빠른 검색 (Ctrl+K)" : undefined}
            className={`mb-3 flex min-h-10 shrink-0 w-full items-center rounded-lg border border-ink-700/80 bg-ink-950/75 text-sm text-ink-400 transition-colors hover:border-ink-600 hover:bg-ink-800/80 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
              showExpandedContent ? "gap-2.5 px-3 text-left" : "justify-center px-2"
            }`}
          >
            <Search size={17} className="shrink-0" />
            {showExpandedContent ? (
              <>
                <span className="min-w-0 flex-1 truncate">빠른 검색...</span>
                <kbd className="shrink-0 rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-ink-500">
                  Ctrl K
                </kbd>
              </>
            ) : null}
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
            <div className="space-y-3">
              {navGroups.map((group, index) => (
                <section key={group.label} className={!showExpandedContent && index > 0 ? "border-t border-ink-700/60 pt-3" : ""}>
                  {showExpandedContent ? (
                    <p className="mb-1.5 px-3 text-[11px] font-medium text-ink-500">{group.label}</p>
                  ) : null}
                  <div className="space-y-1">{group.items.map(renderDesktopItem)}</div>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-2 shrink-0 border-t border-ink-700/70 pt-2">
            <div className="space-y-1">
              {renderDesktopItem(settingsItem)}
              <button
                type="button"
                onClick={() => {
                  clearHoverTimers();
                  setHoverExpanded(false);
                  setMode((current) => current === "expanded" ? "collapsed" : "expanded");
                }}
                className={`flex min-h-10 w-full items-center rounded-lg text-sm font-semibold text-ink-400 transition-colors hover:bg-ink-800/75 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${
                  showExpandedContent ? "justify-between gap-3 px-3 text-left" : "justify-center px-2"
                }`}
                aria-label={collapsed ? "사이드바 펼쳐서 고정" : "사이드바 축소"}
                aria-pressed={!collapsed}
                title={collapsed && !hoverExpanded ? "사이드바 펼쳐서 고정" : undefined}
              >
                {collapsed && !hoverExpanded ? (
                  <PanelLeftOpen size={17} />
                ) : collapsed ? (
                  <>
                    <span>사이드바 펼쳐서 고정</span>
                    <PanelLeftOpen size={17} className="shrink-0" />
                  </>
                ) : (
                  <>
                    <span>사이드바 축소</span>
                    <PanelLeftClose size={17} className="shrink-0" />
                  </>
                )}
              </button>
            </div>
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
