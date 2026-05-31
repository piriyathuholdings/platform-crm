"use client";

type LinkedCellProps = {
  value: string;
  href?: string | null;
  ariaLabel?: string;
  stopPropagation?: boolean;
};

export function LinkedCell({ value, href, ariaLabel, stopPropagation = false }: LinkedCellProps) {
  const hasHref = Boolean(href);
  return (
    <div className={`relative ${hasHref ? "pr-5" : ""}`}>
      <span className="block truncate">{value}</span>
      {hasHref ? (
        <a
          href={href || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel || "Open linked record in new tab"}
          className="absolute right-0 top-0 text-xs text-primary hover:text-primary/80"
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
          }}
        >
          ↗
        </a>
      ) : null}
    </div>
  );
}
