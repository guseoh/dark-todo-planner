import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
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
          <h2 className="text-[23px] font-semibold tracking-tight text-ink-100">{title}</h2>
          {meta ? <span className="page-meta">{meta}</span> : null}
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-400">{description}</p>
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  );
}
