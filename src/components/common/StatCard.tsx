import type { ReactNode } from "react";
import { ProgressBar } from "./ProgressBar";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  progress?: number;
};

export function StatCard({ title, value, description, icon, progress }: StatCardProps) {
  return (
    <article className="app-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-400">{title}</p>
          <strong className="mt-2 block text-2xl font-bold tracking-normal text-ink-100">
            {value}
          </strong>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/20 text-accent-400">
            {icon}
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-3 text-sm text-ink-400">{description}</p> : null}
      {typeof progress === "number" ? <div className="mt-4"><ProgressBar value={progress} /></div> : null}
    </article>
  );
}
