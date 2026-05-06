import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="app-card flex min-h-44 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-700 bg-ink-950/60 text-ink-400">
        <Inbox size={22} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-100">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-ink-400">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
