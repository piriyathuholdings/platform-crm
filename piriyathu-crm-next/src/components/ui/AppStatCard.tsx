import { AppCard } from "./AppCard";

type AppStatCardProps = {
  label: string;
  value: string | number;
  helperText?: string;
  className?: string;
};

export function AppStatCard({ label, value, helperText, className = "" }: AppStatCardProps) {
  return (
    <AppCard className={className}>
      <div className="text-sm text-base-content/70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {helperText ? <div className="mt-1 text-xs text-base-content/60">{helperText}</div> : null}
    </AppCard>
  );
}
