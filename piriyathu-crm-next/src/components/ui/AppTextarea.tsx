import type { TextareaHTMLAttributes } from "react";

type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function AppTextarea({ label, error, helperText, className = "", id, ...props }: AppTextareaProps) {
  const textareaId = id || props.name;
  return (
    <label className="form-control w-full gap-1">
      {label ? <span className="label-text text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span> : null}
      <textarea
        id={textareaId}
        className={`textarea min-h-[5.25rem] w-full rounded-md border border-border-subtle bg-base-100 px-3 py-2 text-sm text-text-default shadow-none transition-[box-shadow,border-color] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ${error ? "border-error focus:border-error focus:ring-error/25" : ""} ${className}`.trim()}
        {...props}
      />
      {error ? <span className="label-text-alt text-error">{error}</span> : null}
      {!error && helperText ? <span className="label-text-alt text-text-muted">{helperText}</span> : null}
    </label>
  );
}
