import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary border border-primary/70 text-primary-content hover:border-primary",
  secondary: "btn-secondary border border-secondary/65 hover:border-secondary",
  outline: "btn-outline border border-primary/45 text-primary hover:border-primary hover:bg-primary/10",
  ghost: "btn-ghost border border-base-300 hover:border-base-300 hover:bg-base-200",
  danger: "border border-error/70 bg-error/12 text-error hover:border-error hover:bg-error/18"
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm h-9 px-3 text-sm",
  md: "h-9 px-3 text-sm",
  lg: "h-10 px-4 text-sm"
};

export function AppButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  leftIcon,
  children,
  ...props
}: AppButtonProps) {
  const resolvedDisabled = disabled || loading;

  return (
    <button
      className={`btn gap-1.5 rounded-md normal-case font-semibold tracking-normal shadow-none ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`.trim()}
      disabled={resolvedDisabled}
      {...props}
    >
      {loading ? <span className="loading loading-spinner loading-sm" /> : leftIcon}
      {children}
    </button>
  );
}
