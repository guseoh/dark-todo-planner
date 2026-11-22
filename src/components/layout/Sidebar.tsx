import { Calendar, CalendarCheck, ClipboardList, FileText, FolderKanban, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const appViewIds = ["today", "all", "projects", "calendar", "memo", "scratchpad", "settings", "trash"] as const;
export type AppView = (typeof appViewIds)[number];

type SidebarProps = {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  onSearch: () => void;
};
type NavItem = { id: AppView; label: string; icon: typeof CalendarCheck };
type SidebarMode = "expanded" | "collapsed";

export const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "작업", items: [
    { id: "today", label: "오늘", icon: CalendarCheck },
    { id: "all", label: "전체 Todo", icon: ClipboardList },
    { id: "projects", label: "프로젝트", icon: FolderKanban },
    { id: "calendar", label: "캘린더", icon: Calendar },
  ] },
  { label: "기록", items: [
    { id: "memo", label: "메모", icon: StickyNote },
    { id: "scratchpad", label: "낙서장", icon: FileText },
  ] },
];

export const settingsItem: NavItem = { id: "settings", label: "설정", icon: Settings };
export const trashItem: NavItem = { id: "trash", label: "휴지통", icon: Trash2 };
const mobilePrimaryItems = navGroups[0].items;
const mobileMoreItems = [...navGroups[1].items, settingsItem, trashItem];
const SIDEBAR_MODE_KEY = "dark-todo-planner:sidebar-mode";
const LEGACY_SIDEBAR_COLLAPSED_KEY = "dark-todo-planner:sidebar-collapsed";

const readInitialMode = (): SidebarMode => {
  if (typeof window === "undefined") return "expanded";
  const storedMode = localStorage.getItem(SIDEBAR_MODE_KEY);
  if (storedMode === "expanded" || storedMode === "collapsed") return storedMode;
  return localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) === "true" ? "collapsed" : "expanded";
};

export function Sidebar({ activeView, onChangeView, onSearch }: SidebarProps) {
  const [mode, setMode] = useState<SidebarMode>(readInitialMode);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [compactWindow, setCompactWindow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1099px)").matches,
  );
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const inlineExpanded = compactWindow ? compactExpanded : mode === "expanded";
  const toggleSidebar = () => {
    if (compactWindow) {
      setCompactExpanded((current) => !current);
    } else {
      setMode((current) => current === "expanded" ? "collapsed" : "expanded");
    }
  };
  useEffect(() => { localStorage.setItem(SIDEBAR_MODE_KEY, mode); }, [mode]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const sync = () => setCompactWindow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => { setMobileMenuOpen(false); }, [activeView]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeIfOutside = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) setMobileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const renderDesktopItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = activeView === item.id;
    return (
      <button key={item.id} type="button" onClick={() => onChangeView(item.id)} aria-label={item.label} aria-current={active ? "page" : undefined} title={!inlineExpanded ? item.label : undefined}
        className={`app-nav-button relative flex min-h-10 w-full items-center rounded-[6px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${active ? "bg-ui-selected font-semibold text-ui-text" : "text-ui-secondary hover:bg-ui-hover hover:text-ui-text"} ${inlineExpanded ? "gap-3 px-3 text-left" : "justify-center px-2"}`}>
        {active ? <span aria-hidden="true" className="app-nav-indicator absolute bottom-2 left-0 top-2 w-0.5 bg-ui-focus" /> : null}
        <Icon size={17} className="shrink-0" />
        {inlineExpanded ? <span className="truncate">{item.label}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside className={`sticky top-14 z-30 hidden h-[calc(100vh-3.5rem)] shrink-0 self-start transition-[width] duration-150 ease-out sm:block ${inlineExpanded ? (compactWindow ? "w-48" : "w-[16.25rem]") : "w-[4.25rem]"}`} data-sidebar-mode={mode} data-compact-window={compactWindow ? "true" : "false"}>
        <nav className="flex h-full min-h-0 w-full flex-col border-r border-ui-divider bg-[var(--sidebar-bg)] px-2 py-2.5">
          <button type="button" onClick={() => onChangeView("today")} aria-label="Todo Planner 홈" title={!inlineExpanded ? "Todo Planner" : undefined}
            className={`mb-2 flex min-h-10 shrink-0 items-center rounded-lg text-left transition-colors hover:bg-ink-800/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${inlineExpanded ? "gap-2.5 px-2.5" : "justify-center px-2"}`}>
            <span className="sidebar-brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-ui-divider bg-ui-surface text-ui-text"><CalendarCheck size={18} /></span>
            {inlineExpanded ? <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink-100">Todo Planner</span><span className="block truncate text-xs text-ink-500">개인 작업 관리</span></span> : null}
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
            <div className="space-y-3">
              {navGroups.map((group, index) => (
                <section key={group.label} className={!inlineExpanded && index > 0 ? "border-t border-ink-700/60 pt-3" : ""}>
                  {inlineExpanded ? <p className="mb-1.5 px-3 text-xs font-medium text-ink-500">{group.label}</p> : null}
                  <div className="space-y-1">{group.items.map(renderDesktopItem)}</div>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-2 shrink-0 border-t border-ink-700/70 pt-2">
            <div className="space-y-1">
              {renderDesktopItem(settingsItem)}
              {renderDesktopItem(trashItem)}
              <button type="button" onClick={toggleSidebar}
                className={`flex min-h-10 w-full items-center rounded-lg text-sm font-semibold text-ink-400 transition-colors hover:bg-ink-800/75 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/45 ${inlineExpanded ? "justify-between gap-3 px-3 text-left" : "justify-center px-2"}`}
                aria-label={inlineExpanded ? "사이드바 축소" : "사이드바 펼치기"} aria-expanded={inlineExpanded} title={!inlineExpanded ? "사이드바 펼치기" : undefined}>
                {inlineExpanded ? <><span>사이드바 축소</span><PanelLeftClose size={17} className="shrink-0" /></> : <PanelLeftOpen size={17} />}
              </button>
            </div>
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/70 bg-ink-950/96 px-2 py-1.5 backdrop-blur-md sm:hidden" aria-label="모바일 탐색">
        <div className="relative" ref={mobileMenuRef}>
          {mobileMenuOpen ? (
            <div id="mobile-more-menu" className="absolute bottom-full right-0 mb-3 w-[min(21rem,calc(100vw-1rem))] rounded-[4px] border border-ink-700 bg-ink-900 p-2">
              <div className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-2 pb-2">
                <span className="text-xs font-bold text-ink-300">다른 화면</span>
                <button type="button" className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-ink-800" onClick={() => setMobileMenuOpen(false)}>닫기</button>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-2">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeView;
                  return <button key={item.id} type="button" aria-current={active ? "page" : undefined}
                    onClick={() => { setMobileMenuOpen(false); onChangeView(item.id); }}
                    className={`app-nav-button flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition ${active ? "bg-info/10 text-info" : "text-ink-300 hover:bg-ink-800"}`}>
                    <Icon size={17} className="shrink-0" /><span className="truncate">{item.label}</span>
                  </button>;
                })}
              </div>
              <button type="button" className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border-t border-ink-700/70 px-3 text-xs font-semibold text-ink-300 hover:bg-ink-800" onClick={() => { setMobileMenuOpen(false); onSearch(); }}>
                <Search size={17} />검색 및 명령 (Ctrl+K)
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-5 gap-1">
            {mobilePrimaryItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return <button key={item.id} type="button" onClick={() => { setMobileMenuOpen(false); onChangeView(item.id); }} aria-current={active ? "page" : undefined}
                className={`app-nav-button relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[6px] px-1 text-xs font-medium transition ${active ? "bg-info/10 text-info" : "text-ui-secondary hover:bg-ui-hover hover:text-ui-text"}`}>
                {active ? <span aria-hidden="true" className="app-nav-indicator absolute inset-x-3 top-0 h-0.5 bg-info" /> : null}<Icon size={18} /><span className="max-w-full truncate">{item.label}</span>
              </button>;
            })}
            <button type="button" aria-expanded={mobileMenuOpen} aria-controls="mobile-more-menu" onClick={() => setMobileMenuOpen((v) => !v)}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold transition ${mobileMenuOpen || mobileMoreItems.some((item) => item.id === activeView) ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:bg-ink-800 hover:text-ink-100"}`}>
              <Menu size={18} /><span>더보기</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
