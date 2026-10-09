type ProgressBarProps = {
  value: number;
  label?: string;
  empty?: boolean;
  emptyLabel?: string;
};

export function ProgressBar({ value, label, empty = false, emptyLabel = "등록된 Todo 없음" }: ProgressBarProps) {
  const normalized = Math.min(100, Math.max(0, value));

  if (empty) {
    return (
      <div className="space-y-1.5" aria-label={`${label || "완료율"} 계산 대상 없음`}>
        <div className="flex items-center justify-between text-xs text-ink-400">
          {label ? <span>{label}</span> : <span />}
          <span>{emptyLabel}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-950" aria-hidden="true">
          <div className="h-full w-full rounded-full bg-ink-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <div className="flex items-center justify-between text-xs text-ink-400">
          <span>{label}</span>
          <span>{normalized}%</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full transition-all ${normalized === 100 ? "bg-success" : "bg-accent-300"}`}
          style={{ width: `${normalized}%` }}
          role="progressbar"
          aria-label={label || "완료율"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalized}
        />
      </div>
    </div>
  );
}
