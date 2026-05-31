import type { ReactNode } from "react";

import { AppEmptyState } from "./AppEmptyState";
import { AppTable } from "./AppTable";

type AppDataTableProps = {
  headers: ReactNode;
  rows: ReactNode;
  colSpan: number;
  loading?: boolean;
  loadingLabel?: string;
  skeletonRows?: number;
  isEmpty?: boolean;
  emptyDescription?: string;
  className?: string;
  wrapperClassName?: string;
  zebra?: boolean;
};

export function AppDataTable({
  headers,
  rows,
  colSpan,
  loading = false,
  loadingLabel = "Loading data...",
  isEmpty = false,
  emptyDescription = "No records found.",
  className = "",
  wrapperClassName = "max-h-[60vh]",
  zebra = true,
  skeletonRows = 6
}: AppDataTableProps) {
  const safeColSpan = Math.max(1, colSpan);
  const loadingSkeletonRows = Array.from({ length: Math.max(1, skeletonRows) });

  return (
    <AppTable className={className} wrapperClassName={wrapperClassName} zebra={zebra}>
      <thead>{headers}</thead>
      <tbody>
        {loading
          ? loadingSkeletonRows.map((_, idx) => (
              <tr key={`skeleton-${idx}`} className="hover:!bg-transparent">
                <td className="py-3" colSpan={safeColSpan}>
                  <div className="px-2">
                    {idx === 0 ? <p className="mb-2 text-xs font-medium text-text-muted">{loadingLabel}</p> : null}
                    <div className="h-5 w-full animate-pulse rounded bg-base-200" />
                  </div>
                </td>
              </tr>
            ))
          : rows}
        {!loading && isEmpty ? (
          <tr>
            <td className="py-10" colSpan={safeColSpan}>
              <AppEmptyState description={emptyDescription} />
            </td>
          </tr>
        ) : null}
      </tbody>
    </AppTable>
  );
}
