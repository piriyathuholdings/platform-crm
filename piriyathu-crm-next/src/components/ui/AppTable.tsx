import type { ReactNode } from "react";

type AppTableProps = {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  zebra?: boolean;
};

export function AppTable({ children, className = "", wrapperClassName = "", zebra = true }: AppTableProps) {
  return (
    <div className={`overflow-x-auto overflow-y-auto rounded-lg bg-base-100 ${wrapperClassName}`.trim()}>
      <table
        className={`table min-w-full w-max ${zebra ? "table-zebra" : ""} [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:border-b [&_thead_th]:border-base-200 [&_thead_th]:bg-base-100/95 [&_thead_th]:py-2.5 [&_thead_th]:text-left [&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-[0.08em] [&_thead_th]:text-text-muted [&_tbody_tr]:border-b [&_tbody_tr]:border-base-200 [&_tbody_tr:last-child]:border-b-0 [&_tbody_td]:max-w-[20rem] [&_tbody_td]:truncate [&_tbody_td]:py-3 [&_tbody_td]:text-sm [&_tbody_td]:align-middle [&_tbody_td]:text-text-default [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr:hover]:bg-base-200 ${className}`.trim()}
      >
        {children}
      </table>
    </div>
  );
}
