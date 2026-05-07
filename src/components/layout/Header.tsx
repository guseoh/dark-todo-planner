import { AlertCircle, CalendarCheck2 } from "lucide-react";
import { formatKoreanDate } from "../../lib/date";

type HeaderProps = {
  storageStatus?: "server" | "offline";
};

export function Header({ storageStatus = "server" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white">
            <CalendarCheck2 size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink-100 sm:text-xl">Dark Todo Planner</h1>
            <p className="truncate text-xs text-ink-400 sm:text-sm">{formatKoreanDate(new Date(), "yyyy년 M월 d일 EEEE")}</p>
          </div>
        </div>
        {storageStatus === "offline" ? (
          <div className="hidden items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-red-100 sm:flex">
            <AlertCircle size={16} />
            <span>서버 연결 오류</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
