type AppEmptyStateProps = {
  title?: string;
  description: string;
  className?: string;
};

export function AppEmptyState({ title = "Nothing here yet", description, className = "" }: AppEmptyStateProps) {
  return (
    <div className={`rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-center ${className}`.trim()}>
      {title ? <p className="font-medium">{title}</p> : null}
      <p className={`${title ? "mt-1" : ""} text-sm text-base-content/70`}>{description}</p>
    </div>
  );
}
