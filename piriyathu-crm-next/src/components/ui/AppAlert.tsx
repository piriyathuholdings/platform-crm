import type { ReactNode } from "react";

type AlertTone = "info" | "success" | "warning" | "error";

type AppAlertProps = {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
  id?: string;
};

const TONE_CLASS: Record<AlertTone, string> = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error"
};

export function AppAlert({ tone = "info", children, className = "", id }: AppAlertProps) {
  const isAssertive = tone === "error" || tone === "warning";
  return (
    <div
      id={id}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      className={`alert ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
