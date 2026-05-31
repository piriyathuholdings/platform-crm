import type { ReactNode } from "react";

type AppFormActionsProps = {
  children: ReactNode;
  className?: string;
};

export function AppFormActions({ children, className = "" }: AppFormActionsProps) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>{children}</div>;
}
