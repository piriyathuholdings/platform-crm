"use client";

import { useMemo, useRef, useState } from "react";

import { AppButton } from "./AppButton";

type ColumnOption = {
  key: string;
  label: string;
};

type AppColumnManagerProps = {
  columns: ColumnOption[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

function uniqueKeys(input: string[]): string[] {
  return Array.from(new Set(input.map((entry) => String(entry || "").trim()).filter(Boolean)));
}

function moveItem(list: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return list;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return list;
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

export function AppColumnManager({ columns, value, onChange, className = "" }: AppColumnManagerProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const visibleKeys = useMemo(() => uniqueKeys(value), [value]);
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const visible = useMemo(() => visibleKeys.map((key) => byKey.get(key)).filter(Boolean) as ColumnOption[], [byKey, visibleKeys]);
  const hidden = useMemo(() => columns.filter((column) => !visibleKeys.includes(column.key)), [columns, visibleKeys]);

  function removeColumn(key: string) {
    const next = visibleKeys.filter((entry) => entry !== key);
    if (!next.length) return;
    onChange(next);
  }

  function addColumn(key: string) {
    if (visibleKeys.includes(key)) return;
    onChange([...visibleKeys, key]);
  }

  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const fromIndex = visibleKeys.indexOf(dragKey);
    const toIndex = visibleKeys.indexOf(targetKey);
    if (fromIndex < 0 || toIndex < 0) return;
    onChange(moveItem(visibleKeys, fromIndex, toIndex));
  }

  function closeDropdown() {
    if (dropdownRef.current) {
      dropdownRef.current.open = false;
    }
  }

  return (
    <details
      ref={dropdownRef}
      className={`dropdown dropdown-end ${className}`.trim()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDropdown();
        }
      }}
    >
      <summary className="btn btn-outline btn-sm m-0 inline-flex h-9 list-none items-center justify-center gap-1.5 rounded-md border border-primary/45 px-3 text-sm font-semibold leading-none normal-case tracking-normal text-primary shadow-none hover:border-primary hover:bg-primary/10 [&::-webkit-details-marker]:hidden">
        Columns
      </summary>
      <div className="dropdown-content z-[30] mt-2 w-80 rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Visible Columns</p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {visible.map((column) => (
            <div
              key={column.key}
              className="flex items-center gap-2 rounded-md border border-base-300 bg-base-100 px-2 py-1.5"
              draggable
              onDragStart={() => setDragKey(column.key)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(column.key);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
            >
              <span className="cursor-grab text-sm text-text-muted" aria-label="Drag to reorder" title="Drag to reorder">
                ☰
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-default">{column.label}</span>
              <AppButton
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => removeColumn(column.key)}
                aria-label={`Remove ${column.label}`}
                title={`Remove ${column.label}`}
              >
                x
              </AppButton>
            </div>
          ))}
          {!visible.length ? <p className="text-xs text-text-muted">No visible columns selected.</p> : null}
        </div>

        <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Available Columns</p>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {hidden.map((column) => (
            <div key={column.key} className="flex items-center justify-between rounded-md border border-base-300 bg-base-100 px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-text-default">{column.label}</span>
              <AppButton type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => addColumn(column.key)}>
                +
              </AppButton>
            </div>
          ))}
          {!hidden.length ? <p className="text-xs text-text-muted">All available columns are visible.</p> : null}
        </div>
      </div>
    </details>
  );
}
