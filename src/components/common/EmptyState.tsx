import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="app-card flex min-h-36 flex-col items-center justify-center px-5 py-7 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-700 bg-ink-950/60 text-ink-400">
        <Inbox size={20} />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-ink-100 sm:text-base">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-ink-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
