import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-28 flex-col items-start justify-center border-t border-ui-divider px-1 py-8 text-left">
      <Inbox size={19} className="text-ink-600" aria-hidden="true" />
      <h3 className="mt-2.5 text-sm font-semibold text-ink-100">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
