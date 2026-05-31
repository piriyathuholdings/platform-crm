import type { ReactNode } from "react";

type AppCardProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppCard({ title, subtitle, actions, children, className = "" }: AppCardProps) {
  return (
    <section className={`rounded-md border border-base-300 bg-base-100 shadow-none ${className}`.trim()}>
      <div className="space-y-2.5 p-2.5 md:p-3">
        {title || subtitle || actions ? (
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-base-300 pb-2">
            <div>
              {title ? <h2 className="text-[15px] font-semibold text-text-strong">{title}</h2> : null}
              {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}
