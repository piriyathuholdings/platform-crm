export type TableColumnOption = {
  key: string;
  label: string;
};

export function normalizeColumnKeys(raw: string[] | null | undefined, allowedKeys: string[], fallbackKeys: string[]): string[] {
  const allowed = new Set(allowedKeys);
  const fallback = fallbackKeys.filter((key) => allowed.has(key));
  const source = Array.isArray(raw) && raw.length ? raw : fallback;

  const normalized: string[] = [];
  for (const key of source) {
    const safe = String(key || "").trim();
    if (!safe || !allowed.has(safe) || normalized.includes(safe)) continue;
    normalized.push(safe);
  }

  return normalized.length ? normalized : fallback;
}

export function parseColumnsFromQuery(rawQueryValue: string | null, allowedKeys: string[], fallbackKeys: string[]): string[] {
  if (!rawQueryValue) {
    return normalizeColumnKeys([], allowedKeys, fallbackKeys);
  }
  const parts = rawQueryValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalizeColumnKeys(parts, allowedKeys, fallbackKeys);
}

export function serializeColumnsForQuery(columns: string[], fallbackKeys: string[]): string | undefined {
  const normalizedColumns = Array.from(
    new Set(
      columns
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    )
  );
  const normalizedFallback = Array.from(
    new Set(
      fallbackKeys
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    )
  );

  if (arraysEqual(normalizedColumns, normalizedFallback)) {
    return undefined;
  }

  return normalizedColumns.join(",");
}

export function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function orderColumnsByVisible<T extends TableColumnOption>(allColumns: T[], visibleKeys: string[]): T[] {
  const byKey = new Map(allColumns.map((column) => [column.key, column]));
  return visibleKeys.map((key) => byKey.get(key)).filter(Boolean) as T[];
}
