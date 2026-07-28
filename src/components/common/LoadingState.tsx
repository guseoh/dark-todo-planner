export function LoadingState({ message = "데이터를 불러오는 중입니다." }: { message?: string }) {
  return (
    <div className="app-card p-6 text-center text-sm text-ink-400">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
      {message}
    </div>
  );
}

type RetryProps = {
  message: string;
  onRetry?: () => void | Promise<void>;
};

export function ErrorState({ message, onRetry }: RetryProps) {
  return (
    <div className="app-card p-6 text-center" role="alert">
      <p className="text-sm text-red-100">{message}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          재시도
        </button>
      ) : null}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: RetryProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger/45 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-100">최신 상태를 반영하지 못했습니다.</p>
        <p className="mt-1 break-words text-xs text-red-200/80">기존 데이터는 유지됩니다. {message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn-secondary shrink-0" onClick={onRetry}>
          다시 불러오기
        </button>
      ) : null}
    </div>
  );
}
