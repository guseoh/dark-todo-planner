type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const normalized = Math.min(100, Math.max(0, value));

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between text-xs text-ink-400">
          <span>{label}</span>
          <span>{normalized}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-ink-950">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
