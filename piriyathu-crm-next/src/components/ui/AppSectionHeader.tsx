import type { ReactNode } from "react";

type AppSectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function AppSectionHeader({ title, subtitle, actions, className = "" }: AppSectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-2 ${className}`.trim()}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-base-content/70">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
