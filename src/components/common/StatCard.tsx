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
    <article className="app-card py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-400">{title}</p>
          <strong className="mt-1 block text-xl font-semibold tracking-normal text-ui-text">
            {value}
          </strong>
        </div>
        {icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-400">
            {icon}
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-1.5 text-xs text-ink-400">{description}</p> : null}
      {typeof progress === "number" ? <div className="mt-2"><ProgressBar value={progress} /></div> : null}
    </article>
  );
}
