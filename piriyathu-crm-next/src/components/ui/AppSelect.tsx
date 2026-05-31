import type { SelectHTMLAttributes } from "react";

type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function AppSelect({ label, error, helperText, className = "", id, children, ...props }: AppSelectProps) {
  const selectId = id || props.name;
  return (
    <label className="form-control w-full gap-1">
      {label ? <span className="label-text text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span> : null}
      <select
        id={selectId}
        className={`select h-9 w-full rounded-md border border-border-subtle bg-base-100 pl-3 pr-9 text-sm text-text-default shadow-none transition-[box-shadow,border-color] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${error ? "border-error focus:border-error focus:ring-error/25" : ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="label-text-alt text-error">{error}</span> : null}
      {!error && helperText ? <span className="label-text-alt text-text-muted">{helperText}</span> : null}
    </label>
  );
}
