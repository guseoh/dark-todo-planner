import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

/** Shared heading rhythm for the core planner screens. */
export function PageHeader({ title, description, meta, icon, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="page-header-icon" aria-hidden="true">{icon}</span> : null}
          <h1 className="text-[23px] font-semibold tracking-tight text-ui-text">{title}</h1>
          {description ? <span className="hidden xl:inline-flex text-ui-muted" tabIndex={0} title={description} aria-label={description}><CircleHelp size={14} /></span> : null}
          {meta ? <span className="page-meta">{meta}</span> : null}
        </div>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-400 xl:hidden">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  );
}
