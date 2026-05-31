import type { ReactNode } from "react";

type AppPageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AppPageHeader({ title, subtitle, actions, className = "" }: AppPageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-1.5 ${className}`.trim()}>
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-base-content md:text-xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-base-content/60 md:text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
