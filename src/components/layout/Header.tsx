import { AlertCircle, CalendarCheck2, LogOut, Plus, Search } from "lucide-react";

type HeaderProps = {
  storageStatus?: "server" | "offline";
  onLogout: () => Promise<void>;
  onQuickAdd?: () => void;
  onSearch?: () => void;
};

export function Header({ storageStatus = "server", onLogout, onQuickAdd, onSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/55 bg-ink-950/94 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-5 lg:justify-end lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-500 text-white">
            <CalendarCheck2 size={18} />
          </div>
          <h1 className="truncate text-base font-bold text-ink-100">Todo Planner</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {storageStatus === "offline" ? (
            <div className="hidden items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 md:flex">
              <AlertCircle size={14} />
              <span>서버 연결 오류</span>
            </div>
          ) : null}
          {onSearch ? (
            <button type="button" onClick={onSearch} className="btn-secondary px-2.5 lg:hidden" title="검색 및 명령 (Ctrl+K)">
              <Search size={15} />
              <span className="hidden sm:inline">검색</span>
            </button>
          ) : null}
          {onQuickAdd ? (
            <button type="button" onClick={onQuickAdd} className="btn-primary px-2.5" title="빠른 Todo 추가 (Ctrl+Shift+K)">
              <Plus size={15} />
              <span className="hidden sm:inline">빠른 추가</span>
            </button>
          ) : null}
          <button type="button" onClick={() => void onLogout()} className="btn-secondary px-2.5" title="로그아웃">
            <LogOut size={15} />
            <span className="hidden xl:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </header>
  );
}
