import { AlertCircle, CalendarCheck2, Github, LogOut, Plus, Search, UserRound } from "lucide-react";
import { Button } from "../ui/Button";

const REPOSITORY_URL = "https://github.com/guseoh/dark-todo-planner";

type HeaderProps = {
  storageStatus?: "server" | "offline";
  onLogout: () => Promise<void>;
  onQuickAdd?: () => void;
  onSearch?: () => void;
};

export function Header({ storageStatus = "server", onLogout, onQuickAdd, onSearch }: HeaderProps) {
  return (
    <header className="app-topbar sticky top-0 z-40 border-b border-ui-divider bg-ui-canvas">
      <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-ui-selected text-ui-text">
              <CalendarCheck2 size={18} />
            </div>
            <h1 className="hidden truncate text-base font-bold text-ink-100 sm:block">Todo Planner</h1>
          </div>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-2 rounded-[4px] px-2 text-xs font-medium text-ui-secondary transition-colors hover:bg-ui-hover hover:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
            title="GitHub 저장소 열기"
          >
            <Github size={15} />
            <span className="hidden md:inline">guseoh/dark-todo-planner</span>
          </a>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {storageStatus === "offline" ? (
            <div className="hidden items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger md:flex">
              <AlertCircle size={14} />
              <span>서버 연결 오류</span>
            </div>
          ) : null}
          {onSearch ? (
            <Button variant="secondary" onClick={onSearch} className="app-search-button" title="검색 및 명령 (Ctrl+K)" aria-label="검색 및 명령">
              <Search size={16} aria-hidden="true" />
              <span className="hidden sm:inline">검색</span>
              <kbd className="hidden xl:inline">Ctrl K</kbd>
            </Button>
          ) : null}
          {onQuickAdd ? (
            <Button variant="primary" onClick={onQuickAdd} title="빠른 Todo 추가 (Ctrl+Shift+K)" aria-label="빠른 추가">
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">빠른 추가</span>
            </Button>
          ) : null}
          <details className="relative">
            <summary className="ui-icon-button ui-icon-button--neutral h-9 w-9 list-none cursor-pointer" aria-label="계정 메뉴" title="계정 메뉴"><UserRound size={17} /></summary>
            <div className="absolute right-0 top-full z-50 mt-2 min-w-40 rounded-md border border-ui-divider bg-ui-elevated p-1.5 shadow-lg">
              <button type="button" onClick={() => void onLogout()} className="ui-button ui-button--ghost w-full justify-start px-3 text-left">
                <LogOut size={15} />로그아웃
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
