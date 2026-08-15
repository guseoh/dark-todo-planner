import {
  Calendar,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  StickyNote,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AppView =
  | "today"
  | "week"
  | "month"
  | "all"
  | "memo"
  | "settings";

type SidebarProps = {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
};

const navItems = [
  { id: "today", label: "오늘", icon: CalendarCheck },
  { id: "week", label: "주간", icon: CalendarRange },
  { id: "month", label: "월간", icon: Calendar },
  { id: "all", label: "전체 Todo", icon: ClipboardList },
  { id: "memo", label: "메모", icon: StickyNote },
  { id: "settings", label: "앱 정보", icon: Settings },
] satisfies Array<{ id: AppView; label: string; icon: typeof CalendarCheck }>;

const SIDEBAR_COLLAPSED_KEY = "dark-todo-planner:sidebar-collapsed";

const readInitialCollapsed = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
};

export function Sidebar({ activeView, onChangeView }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const activeMobileItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    activeMobileItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeView]);

  return (
    <>
      <aside className={`relative z-50 hidden shrink-0 overflow-visible transition-all duration-200 lg:block ${collapsed ? "w-16" : "w-60"}`}>
        <nav className="sticky top-24 space-y-2 overflow-visible">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`flex min-h-10 w-full items-center rounded-lg border border-ink-700 bg-ink-900/70 text-sm font-semibold text-ink-300 transition hover:border-accent-500/60 hover:bg-ink-800 hover:text-ink-100 ${
              collapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <span>메뉴 접기</span>}
            {!collapsed ? <PanelLeftClose size={18} /> : null}
          </button>
          {navItems.map((item) => {
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
                className={`group relative flex min-h-11 w-full items-center rounded-lg border text-sm font-semibold transition ${
                  active
                    ? "border-accent-500/50 bg-accent-500/20 text-ink-100"
                    : "border-transparent text-ink-400 hover:border-ink-700 hover:bg-ink-800 hover:text-ink-100"
                } ${collapsed ? "justify-center px-2" : "gap-3 px-4 text-left"}`}
              >
                <Icon size={18} />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                {collapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-[70] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs font-semibold text-ink-100 shadow-xl group-hover:block group-focus-visible:block">
                    {item.label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 px-2 py-2 backdrop-blur-xl lg:hidden">
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
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-ink-950 to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-ink-950 to-transparent" />
        </div>
      </nav>
    </>
  );
}
