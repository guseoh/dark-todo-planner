export function LoadingState({ message = "데이터를 불러오는 중입니다." }: { message?: string }) {
  return (
    <div className="app-card p-6 text-center text-sm text-ink-400">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
      {message}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="app-card p-6 text-center">
      <p className="text-sm text-red-100">{message}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          재시도
        </button>
      ) : null}
    </div>
  );
}
