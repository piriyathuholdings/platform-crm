import type { ReactNode } from "react";

type BadgeTone = "neutral" | "primary" | "secondary" | "success" | "warning" | "error";

type AppBadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  primary: "badge-primary",
  secondary: "badge-secondary",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error"
};

export function AppBadge({ tone = "neutral", children, className = "" }: AppBadgeProps) {
  return <span className={`badge rounded-full border text-[12px] font-semibold ${TONE_CLASS[tone]} ${className}`.trim()}>{children}</span>;
}
