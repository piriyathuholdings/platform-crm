"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppAlert, AppButton, AppColumnManager, AppDataTable, AppEmptyState, AppFormActions, AppInput, AppSelect, LinkedCell } from "@/components/ui";
import { getEntityApiEndpoint, getEntityConfig, isSupportedEntity } from "@/features/entities/config";
import { buildCrmRecordHrefFromDoctype } from "@/features/entities/link-routes";
import { EntityFieldControl } from "@/features/entities/FieldControl";
import {
  applyDealDerivedValues,
  buildSubmitPayload,
  fetchDealDerivedValues,
  fetchEntityMeta,
  resolveEntityFields,
  resolveLockedDerivedFields,
  toInputValue,
  type ResolvedEntityField,
  type RuntimeEntityFieldMeta
} from "@/features/entities/meta";
import { apiFetch } from "@/lib/api-client";
import { parseColumnsFromQuery, serializeColumnsForQuery } from "@/lib/table-columns";

type ListResponse = {
  label: string;
  columns: { fieldname: string; label: string }[];
  rows: Record<string, unknown>[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
};

type FilterOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "like" | "in" | "not in";
type FilterRow = { field: string; operator: FilterOperator; value: string };

const FILTER_OPERATOR_OPTIONS: { value: FilterOperator; label: string }[] = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not equals" },
  { value: ">", label: "Greater than" },
  { value: ">=", label: "Greater than or equal" },
  { value: "<", label: "Less than" },
  { value: "<=", label: "Less than or equal" },
  { value: "like", label: "Like" },
  { value: "in", label: "In (comma separated)" },
  { value: "not in", label: "Not in (comma separated)" }
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function parsePageSize(raw: string | null): number {
  const parsed = Number(raw || "20");
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 20;
}

const RESTRICTED_CREATE_ROUTES: Record<string, string> = {
  products: "/crm/admin/products",
  "user-product-access": "/crm/admin/user-product-access"
};
const AMOUNT_FIELDS = new Set(["deal_value", "total_payments_received", "to_collect", "amount"]);
const CREATE_FORM_EXCLUDED_FIELDS = new Set(["creation", "owner", "modified", "modified_by"]);
const COLUMN_PREFS_KEY_PREFIX = "crm:list:columns:";

export default function EntityListPage() {
  const params = useParams<{ entity: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entity = params.entity;
  const entityConfig = useMemo(() => getEntityConfig(entity), [entity]);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortField, setSortField] = useState(searchParams.get("sort_field") || "modified");
  const [sortOrder, setSortOrder] = useState(searchParams.get("sort_order") || "desc");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || "1")));
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get("page_size")));
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [toolbarSearch, setToolbarSearch] = useState(searchParams.get("search") || "");
  const [showToolbarSearch, setShowToolbarSearch] = useState(Boolean(searchParams.get("search")));
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftSortField, setDraftSortField] = useState("");
  const [draftSortOrder, setDraftSortOrder] = useState("desc");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [draftFilters, setDraftFilters] = useState<FilterRow[]>([]);
  const [createFields, setCreateFields] = useState<ResolvedEntityField[]>([]);
  const [runtimeMetaFields, setRuntimeMetaFields] = useState<RuntimeEntityFieldMeta[]>([]);
  const [createPayload, setCreatePayload] = useState<Record<string, string>>({});
  const [productLabelsById, setProductLabelsById] = useState<Record<string, string>>({});
  const [createLoading, setCreateLoading] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLockedDerivedFields, setCreateLockedDerivedFields] = useState<Set<string>>(new Set());
  const unavailableCreateSelectLabels = useMemo(
    () => createFields.filter((field) => field.fieldtype === "Select" && field.isRuntimeFieldtype && field.options.length === 0).map((field) => field.label),
    [createFields]
  );

  const updateQuery = useCallback(
    (next: Record<string, string | number | undefined>) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === undefined || v === "") nextParams.delete(k);
        else nextParams.set(k, String(v));
      });
      const query = nextParams.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`);
    },
    [pathname, router, searchParams]
  );

  const columnPrefsStorageKey = `${COLUMN_PREFS_KEY_PREFIX}${entity}`;

  useEffect(() => {
    if (!isSupportedEntity(entity)) return;
    setLoading(true);
    setError("");
    const requestBody = {
      page,
      page_size: pageSize,
      sort: { field: sortField, order: sortOrder },
      search: search || undefined,
      filters: filters.length ? filters : undefined
    };

    apiFetch<ListResponse>(`/shell/entities/${entity}/list`, { method: "POST", body: JSON.stringify(requestBody) })
      .then((payload) => {
        setData(payload);
        const allColumnKeys = payload.columns.map((col) => col.fieldname);
        const fromQuery = parseColumnsFromQuery(searchParams.get("cols"), allColumnKeys, allColumnKeys);
        let nextVisible = fromQuery;
        if (!searchParams.get("cols") && typeof window !== "undefined") {
          const stored = window.localStorage.getItem(columnPrefsStorageKey);
          if (stored) {
            nextVisible = parseColumnsFromQuery(stored, allColumnKeys, allColumnKeys);
          }
        }
        setVisibleCols(nextVisible);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [entity, page, pageSize, search, searchParams, sortField, sortOrder, filters, columnPrefsStorageKey]);

  useEffect(() => {
    if (!isSupportedEntity(entity)) return;
    fetchEntityMeta(entity)
      .then((meta) => setRuntimeMetaFields(meta.fields || []))
      .catch(() => setRuntimeMetaFields([]));
  }, [entity]);

  useEffect(() => {
    const rows = data?.rows || [];
    if (!rows.length) return;
    const productKeys = Array.from(
      new Set(
        rows
          .flatMap((row) => [String(row.product__id || ""), String(row.product || "")])
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    if (!productKeys.length) return;

    let cancelled = false;
    const encodedNameFilters = encodeURIComponent(JSON.stringify([["name", "in", productKeys]]));
    const encodedCodeFilters = encodeURIComponent(JSON.stringify([["product_code", "in", productKeys]]));
    const encodedFields = encodeURIComponent(JSON.stringify(["name", "product_name", "product_code"]));

    Promise.all([
      apiFetch<{ items: Array<Record<string, unknown>> }>(`/products?limit=500&offset=0&fields=${encodedFields}&filters=${encodedNameFilters}`),
      apiFetch<{ items: Array<Record<string, unknown>> }>(`/products?limit=500&offset=0&fields=${encodedFields}&filters=${encodedCodeFilters}`)
    ])
      .then(([byName, byCode]) => {
        if (cancelled) return;
        const merged = [...(byName.items || []), ...(byCode.items || [])];
        const next: Record<string, string> = {};
        merged.forEach((productRow) => {
          const id = String(productRow.name || "").trim();
          const code = String(productRow.product_code || "").trim();
          const label = String(productRow.product_name || productRow.product_code || productRow.name || "").trim();
          if (!label) return;
          if (id) next[id] = label;
          if (code) next[code] = label;
        });
        setProductLabelsById((previous) => ({ ...previous, ...next }));
      })
      .catch(() => {
        if (!cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [data?.rows]);

  useEffect(() => {
    const rows = data?.rows || [];
    const unresolvedKeys = Array.from(
      new Set(
        rows
          .flatMap((row) => [String(row.product__id || ""), String(row.product || "")])
          .map((value) => value.trim())
          .filter((value) => value && !productLabelsById[value])
      )
    );
    if (!unresolvedKeys.length) return;

    let cancelled = false;
    Promise.all(
      unresolvedKeys.map(async (rawKey) => {
        try {
          const payload = await apiFetch<{ items: Array<{ id: string; label: string }> }>(
            `/meta/link-options?doctype=${encodeURIComponent("Product")}&q=${encodeURIComponent(rawKey)}&limit=5`
          );
          const items = payload.items || [];
          const exact = items.find((item) => item.id === rawKey);
          const picked = exact || items[0];
          if (!picked) return null;
          return { key: rawKey, label: picked.label || picked.id };
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const updates = results.filter((entry): entry is { key: string; label: string } => Boolean(entry));
      if (!updates.length) return;
      setProductLabelsById((previous) => {
        const next = { ...previous };
        updates.forEach((entry) => {
          next[entry.key] = entry.label;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [data?.rows, productLabelsById]);

  useEffect(() => {
    setToolbarSearch(search);
    if (search) setShowToolbarSearch(true);
  }, [search]);

  useEffect(() => {
    setSelectedRowIds([]);
  }, [entity, page, pageSize, search, sortField, sortOrder, filters]);

  function openFilterDialog() {
    const fallbackField = data?.columns?.[0]?.fieldname || "modified";
    setDraftSearch(search);
    setDraftSortField(sortField);
    setDraftSortOrder(sortOrder);
    setDraftFilters(filters.length ? filters : [{ field: fallbackField, operator: "=", value: "" }]);
    filterDialogRef.current?.showModal();
  }

  function closeFilterDialog() {
    filterDialogRef.current?.close();
  }

  function applyFilters() {
    setSearch(draftSearch);
    setSortField(draftSortField);
    setSortOrder(draftSortOrder);
    setFilters(draftFilters.filter((row) => row.field && row.value.trim() !== ""));
    setPage(1);
    updateQuery({
      search: draftSearch || undefined,
      sort_field: draftSortField,
      sort_order: draftSortOrder,
      page: 1,
      page_size: pageSize
    });
    closeFilterDialog();
  }

  function clearAllFilters() {
    setSearch("");
    setSortField("modified");
    setSortOrder("desc");
    setFilters([]);
    setDraftSearch("");
    setDraftSortField("modified");
    setDraftSortOrder("desc");
    setDraftFilters([]);
    setPage(1);
    updateQuery({
      search: undefined,
      sort_field: "modified",
      sort_order: "desc",
      page: 1,
      page_size: pageSize
    });
  }

  function applyToolbarSearch() {
    setSearch(toolbarSearch.trim());
    setPage(1);
    updateQuery({
      search: toolbarSearch.trim() || undefined,
      page: 1,
      page_size: pageSize
    });
  }

  function toggleToolbarSearch() {
    if (showToolbarSearch) {
      setShowToolbarSearch(false);
      if (toolbarSearch.trim()) {
        setToolbarSearch("");
        setSearch("");
        setPage(1);
        updateQuery({ search: undefined, page: 1, page_size: pageSize });
      }
      return;
    }
    setShowToolbarSearch(true);
  }

  function addDraftFilter() {
    if (!data?.columns?.length) return;
    setDraftFilters((prev) => [...prev, { field: data.columns[0]?.fieldname || "", operator: "=", value: "" }]);
  }

  function updateDraftFilter(index: number, patch: Partial<FilterRow>) {
    setDraftFilters((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeDraftFilter(index: number) {
    setDraftFilters((prev) => prev.filter((_, i) => i !== index));
  }

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }),
    []
  );
  const runtimeMetaByField = useMemo(() => new Map(runtimeMetaFields.map((field) => [field.fieldname, field])), [runtimeMetaFields]);

  useEffect(() => {
    let cancelled = false;
    const dealId = String(createPayload.deal || "").trim();
    const locked = resolveLockedDerivedFields(createFields, { deal: dealId });
    setCreateLockedDerivedFields(locked);
    if (!dealId || !locked.size) return;
    fetchDealDerivedValues(dealId).then((derived) => {
      if (cancelled) return;
      setCreatePayload((previous) => applyDealDerivedValues(createFields, previous, derived));
    });
    return () => {
      cancelled = true;
    };
  }, [createFields, createPayload.deal]);

  if (!isSupportedEntity(entity)) return <AppAlert tone="error">Unknown entity.</AppAlert>;

  const allColumns = data?.columns || [];
  const activeColumnKeys = visibleCols.length ? visibleCols : allColumns.map((col) => col.fieldname);
  const displayColumns = allColumns.filter((col) => activeColumnKeys.includes(col.fieldname));
  const pageInfo = data?.pagination;
  const pageTotal = pageInfo?.total || 0;
  const pageStart = pageTotal > 0 ? ((pageInfo?.page || page) - 1) * (pageInfo?.page_size || pageSize) + 1 : 0;
  const pageEnd = pageTotal > 0 ? Math.min((pageInfo?.page || page) * (pageInfo?.page_size || pageSize), pageTotal) : 0;
  const restrictedCreateRoute = RESTRICTED_CREATE_ROUTES[entity];
  const hasActiveFilters = Boolean(search || filters.length || sortField !== "modified" || sortOrder !== "desc");
  const visibleRows = data?.rows || [];
  const selectableRowIds = visibleRows
    .map((row, index) => (row.id != null ? String(row.id) : String(index)))
    .filter(Boolean);
  const allRowsSelected = selectableRowIds.length > 0 && selectableRowIds.every((id) => selectedRowIds.includes(id));
  const selectedCount = selectedRowIds.length;
  const isLeadEntity = entity === "leads";

  function isAmountField(fieldname: string): boolean {
    return AMOUNT_FIELDS.has(fieldname);
  }

  function toggleSelectAllRows(checked: boolean) {
    if (!checked) {
      setSelectedRowIds([]);
      return;
    }
    setSelectedRowIds(selectableRowIds);
  }

  function toggleRowSelection(rowId: string, checked: boolean) {
    setSelectedRowIds((previous) => {
      if (checked) return Array.from(new Set([...previous, rowId]));
      return previous.filter((id) => id !== rowId);
    });
  }

  function persistColumnPrefs(nextVisible: string[], allKeys: string[]) {
    if (typeof window === "undefined") return;
    const serialized = serializeColumnsForQuery(nextVisible, allKeys);
    if (serialized) window.localStorage.setItem(columnPrefsStorageKey, serialized);
    else window.localStorage.removeItem(columnPrefsStorageKey);
  }

  async function openCreateDialog() {
    setCreateLoading(true);
    setCreateSaving(false);
    setCreateError("");
    try {
      const meta = await fetchEntityMeta(entity);
      const resolvedFields = resolveEntityFields(entity, meta.fields || []).filter(
        (field) => !field.readOnly && !CREATE_FORM_EXCLUDED_FIELDS.has(field.key)
      );
      const nextPayload: Record<string, string> = {};
      resolvedFields.forEach((field) => {
        nextPayload[field.key] = toInputValue(field.fieldtype, "");
      });
      setCreateFields(resolvedFields);
      setCreatePayload(nextPayload);
      setCreateLockedDerivedFields(resolveLockedDerivedFields(resolvedFields, nextPayload));
      createDialogRef.current?.showModal();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  }

  function closeCreateDialog() {
    createDialogRef.current?.close();
  }

  async function submitCreateForm() {
    setCreateSaving(true);
    setCreateError("");
    try {
      if (unavailableCreateSelectLabels.length) {
        throw new Error(`Missing backend options for: ${unavailableCreateSelectLabels.join(", ")}`);
      }
      for (const field of createFields) {
        if (!field.required || field.fieldtype === "Check") continue;
        if (!String(createPayload[field.key] || "").trim()) throw new Error(`${field.label} is required`);
      }

      const endpoint = getEntityApiEndpoint(entity);
      const submitPayload = buildSubmitPayload(createFields, createPayload);
      await apiFetch<Record<string, unknown>>(`/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(submitPayload)
      });
      closeCreateDialog();
      setPage(1);
      updateQuery({ page: 1, page_size: pageSize });
      setLoading(true);
      const requestBody = {
        page: 1,
        page_size: pageSize,
        sort: { field: sortField, order: sortOrder },
        search: search || undefined,
        filters: filters.length ? filters : undefined
      };
      const payload = await apiFetch<ListResponse>(`/shell/entities/${entity}/list`, { method: "POST", body: JSON.stringify(requestBody) });
      setData(payload);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreateSaving(false);
      setLoading(false);
    }
  }

  async function bulkDeleteSelectedRows() {
    if (!selectedRowIds.length) return;
    const confirmed =
      typeof window === "undefined"
        ? false
        : window.confirm(`Delete ${selectedRowIds.length} selected record(s)? This cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    setError("");
    try {
      const endpoint = getEntityApiEndpoint(entity);
      const failures: string[] = [];
      await Promise.all(
        selectedRowIds.map(async (rowId) => {
          try {
            await apiFetch<{ ok: boolean }>(`/${endpoint}/${encodeURIComponent(rowId)}`, { method: "DELETE" });
          } catch {
            failures.push(rowId);
          }
        })
      );

      if (failures.length) {
        throw new Error(`Failed to delete ${failures.length} record(s).`);
      }

      setSelectedRowIds([]);
      setPage(1);
      updateQuery({ page: 1, page_size: pageSize });

      const requestBody = {
        page: 1,
        page_size: pageSize,
        sort: { field: sortField, order: sortOrder },
        search: search || undefined,
        filters: filters.length ? filters : undefined
      };
      const payload = await apiFetch<ListResponse>(`/shell/entities/${entity}/list`, { method: "POST", body: JSON.stringify(requestBody) });
      setData(payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function renderCellValue(fieldname: string, value: unknown): string {
    if (value == null || value === "") return "-";
    if (fieldname === "probability") {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return `${n.toFixed(3)}%`;
    }
    if (fieldname === "deal_value" || fieldname === "total_payments_received" || fieldname === "to_collect" || fieldname === "amount") {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return currencyFormatter.format(n);
    }
    return String(value);
  }

  function dealStatusTone(status: string): "success" | "warning" | "error" | "primary" | "secondary" {
    const normalized = status.toLowerCase();
    if (normalized.includes("won")) return "success";
    if (normalized.includes("lost")) return "error";
    if (normalized.includes("ready to close")) return "primary";
    if (normalized.includes("negotiation")) return "secondary";
    return "warning";
  }

  function dealStatusBadgeClass(tone: "success" | "warning" | "error" | "primary" | "secondary"): string {
    const classes: Record<typeof tone, string> = {
      primary: "border-primary/30 bg-primary/10 !text-primary",
      secondary: "border-secondary/30 bg-secondary/10 !text-secondary",
      success: "border-success/30 bg-success/10 !text-success",
      warning: "border-warning/30 bg-warning/12 !text-warning",
      error: "border-error/30 bg-error/10 !text-error"
    };
    return classes[tone];
  }

  function renderCellContent(fieldname: string, row: Record<string, unknown>) {
    const value = row[fieldname];
    if (fieldname === "deal_status") {
      const label = renderCellValue(fieldname, value);
      if (label === "-") return label;
      const tone = dealStatusTone(label);
      return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${dealStatusBadgeClass(tone)}`}>{label}</span>;
    }
    return renderLinkedCell(fieldname, row);
  }

  function renderLinkedCell(fieldname: string, row: Record<string, unknown>) {
    const meta = runtimeMetaByField.get(fieldname);
    let display = renderCellValue(fieldname, row[fieldname]);
    if (!meta || meta.fieldtype !== "Link" || display === "-") {
      return display;
    }
    const rawId = (row[`${fieldname}__id`] as string | undefined) || (row[fieldname] as string | undefined);
    if (meta.link_doctype === "Product" && rawId && productLabelsById[rawId]) {
      display = productLabelsById[rawId];
    } else if (meta.link_doctype === "Product") {
      const inlineProductLabel =
        (row.product_name as string | undefined) ||
        (row.product_label as string | undefined) ||
        (row.product__label as string | undefined);
      if (inlineProductLabel && String(inlineProductLabel).trim()) {
        display = String(inlineProductLabel).trim();
      }
    }
    const href = rawId ? buildCrmRecordHrefFromDoctype(meta.link_doctype || "", String(rawId)) : null;
    return <LinkedCell value={display} href={href} stopPropagation ariaLabel={`Open ${meta.label} in new tab`} />;
  }

  function toggleColumnSort(fieldname: string) {
    if (!isLeadEntity) return;
    if (sortField === fieldname) {
      const nextOrder = sortOrder === "asc" ? "desc" : "asc";
      setSortOrder(nextOrder);
      setPage(1);
      updateQuery({ sort_field: fieldname, sort_order: nextOrder, page: 1, page_size: pageSize });
      return;
    }
    setSortField(fieldname);
    setSortOrder("asc");
    setPage(1);
    updateQuery({ sort_field: fieldname, sort_order: "asc", page: 1, page_size: pageSize });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-base-content">
              {data?.label ?? entityConfig?.label ?? "Records"}
            </h1>
            {selectedCount > 0 ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {selectedCount} selected
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 overflow-visible sm:w-auto sm:justify-end">
          <AppButton size="sm" variant="outline" type="button" onClick={toggleToolbarSearch} aria-label="Toggle search" className="text-primary">
            {showToolbarSearch ? "×" : "🔍"}
          </AppButton>
          <details className="dropdown dropdown-end">
            <summary className="btn btn-outline btn-sm h-9 gap-1.5 rounded-md border border-primary/45 px-3 text-sm font-semibold normal-case tracking-normal leading-none text-primary shadow-none marker:content-[''] hover:border-primary hover:bg-primary/10 flex items-center justify-center">
              Actions
            </summary>
            <ul className="menu dropdown-content z-[60] mt-1 w-48 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
              <li>
                <button
                  type="button"
                  className="rounded-md text-error hover:bg-error/10 disabled:text-text-muted"
                  disabled={selectedCount === 0}
                  onClick={(event) => {
                    event.preventDefault();
                    bulkDeleteSelectedRows();
                  }}
                >
                  Delete Selected
                </button>
              </li>
            </ul>
          </details>
          {showToolbarSearch ? (
            <>
              <div className="min-w-[220px] flex-1 sm:w-64 sm:flex-none">
                <label className="input input-bordered flex h-9 items-center gap-2 border-base-300 outline-none ring-0 focus-within:border-primary focus-within:outline-none focus-within:ring-0">
                  <input
                    type="text"
                    value={toolbarSearch}
                    onChange={(event) => setToolbarSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyToolbarSearch();
                    }}
                    className="w-full bg-transparent text-sm outline-none ring-0 focus:outline-none focus:ring-0"
                    placeholder="Search records"
                    aria-label="Search records"
                  />
                </label>
              </div>
              <AppButton size="sm" variant="outline" type="button" onClick={applyToolbarSearch} className="text-primary">
                Go
              </AppButton>
            </>
          ) : null}
          <div className="inline-flex items-center">
            <AppButton
              variant="outline"
              size="sm"
              type="button"
              onClick={openFilterDialog}
                className={`${hasActiveFilters ? "rounded-r-none border-r-0" : ""} text-primary`}
            >
              Filters
            </AppButton>
            {hasActiveFilters ? (
              <AppButton
                variant="outline"
                size="sm"
                type="button"
                onClick={clearAllFilters}
                aria-label="Clear filters"
                className="rounded-l-none px-2.5 text-primary"
              >
                ×
              </AppButton>
            ) : null}
          </div>
          <AppColumnManager
            columns={allColumns.map((col) => ({ key: col.fieldname, label: col.label }))}
            value={activeColumnKeys}
            onChange={(nextVisible) => {
              setVisibleCols(nextVisible);
              const allKeys = allColumns.map((col) => col.fieldname);
              persistColumnPrefs(nextVisible, allKeys);
              const serialized = serializeColumnsForQuery(
                nextVisible,
                allKeys
              );
              updateQuery({ cols: serialized, page: 1 });
              setPage(1);
            }}
          />

          {restrictedCreateRoute ? (
            <Link href={restrictedCreateRoute}>
              <AppButton size="sm" type="button" variant="outline" className="text-primary">
                Manage In Settings
              </AppButton>
            </Link>
          ) : (
            <AppButton
              size="sm"
              type="button"
              variant="outline"
              className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
              onClick={openCreateDialog}
            >
              Create
            </AppButton>
          )}
        </div>
      </div>

      {error ? <AppAlert tone="error">{error}</AppAlert> : null}

      <dialog ref={filterDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="font-display text-lg font-semibold">Filters</h3>
          <p className="mt-1 text-sm text-base-content/60">Search, sort, and add field filters like equals, in, not in, and like.</p>
          <div className="mt-4 space-y-4">
            <AppInput label="Search" placeholder="Search records" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} />
            <AppSelect label="Sort By" value={draftSortField} onChange={(e) => setDraftSortField(e.target.value)}>
              {(data?.columns || []).map((col) => (
                <option key={col.fieldname} value={col.fieldname}>
                  {col.label}
                </option>
              ))}
            </AppSelect>
            <AppSelect label="Order" value={draftSortOrder} onChange={(e) => setDraftSortOrder(e.target.value)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </AppSelect>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-strong">Field Filters</p>
                <AppButton size="sm" variant="outline" type="button" onClick={addDraftFilter}>
                  + Add Filter
                </AppButton>
              </div>
              {draftFilters.length === 0 ? (
                <p className="text-sm text-text-muted">No filters added.</p>
              ) : (
                draftFilters.map((row, index) => (
                  <div
                    key={`${row.field}:${index}`}
                    className="grid gap-2 rounded-md border border-border-subtle p-2.5 md:grid-cols-[1.3fr_1fr_1.4fr_auto] md:items-end"
                  >
                    <div>
                      <AppSelect label="Field" value={row.field} onChange={(e) => updateDraftFilter(index, { field: e.target.value })}>
                        {(data?.columns || []).map((col) => (
                          <option key={col.fieldname} value={col.fieldname}>
                            {col.label}
                          </option>
                        ))}
                      </AppSelect>
                    </div>
                    <div>
                      <AppSelect
                        label="Operator"
                        value={row.operator}
                        onChange={(e) => updateDraftFilter(index, { operator: e.target.value as FilterOperator })}
                      >
                        {FILTER_OPERATOR_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </AppSelect>
                    </div>
                    <div>
                      <AppInput
                        label="Value"
                        placeholder={row.operator === "in" || row.operator === "not in" ? "A, B, C" : "Filter value"}
                        value={row.value}
                        onChange={(e) => updateDraftFilter(index, { value: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end md:pb-[1px]">
                      <AppButton
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => removeDraftFilter(index)}
                        aria-label={`Remove filter ${index + 1}`}
                        className="h-9 px-2.5"
                      >
                        x
                      </AppButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="modal-action">
            <AppButton variant="ghost" type="button" onClick={closeFilterDialog}>
              Cancel
            </AppButton>
            <AppButton type="button" onClick={applyFilters} className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary">
              Apply
            </AppButton>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" className="h-full w-full cursor-default bg-transparent text-transparent" aria-label="Close filters">
            close
          </button>
        </form>
      </dialog>

      <dialog ref={createDialogRef} className="modal">
        <div className="modal-box max-w-5xl">
          <h3 className="font-display text-lg font-semibold">Create {data?.label ?? entityConfig?.label ?? "Record"}</h3>
          <p className="mt-1 text-sm text-base-content/60">Fill out the form and save.</p>
          <div className="mt-4">
            {createLoading ? (
              <AppEmptyState description="Loading form fields..." />
            ) : (
              <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {createFields.map((field) => (
                  <EntityFieldControl
                    key={field.key}
                    field={field}
                    value={createPayload[field.key] || ""}
                    disabled={createSaving}
                    forceReadOnly={createLockedDerivedFields.has(field.key)}
                    onChange={(nextValue) => setCreatePayload((old) => ({ ...old, [field.key]: nextValue }))}
                  />
                ))}
              </div>
            )}
            {createError ? <AppAlert tone="error">{createError}</AppAlert> : null}
            {unavailableCreateSelectLabels.length ? (
              <AppAlert tone="error">
                Missing backend options for: {unavailableCreateSelectLabels.join(", ")}. Update doctype metadata to continue.
              </AppAlert>
            ) : null}
          </div>
          <div className="modal-action">
            <AppFormActions>
              <AppButton
                loading={createSaving}
                type="button"
                className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
                onClick={submitCreateForm}
              >
                {createSaving ? "Saving..." : "Save"}
              </AppButton>
              <AppButton variant="outline" type="button" onClick={closeCreateDialog}>
                Cancel
              </AppButton>
            </AppFormActions>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" className="h-full w-full cursor-default bg-black/40 text-transparent" aria-label="Close create form">
            close
          </button>
        </form>
      </dialog>

      <section className="flex h-[calc(100vh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-base-200 bg-base-100 md:h-[calc(100vh-11rem)]">
        <AppDataTable
          colSpan={Math.max(1, displayColumns.length + 2)}
          isEmpty={visibleRows.length === 0}
          loading={loading}
          loadingLabel="Loading records..."
          skeletonRows={7}
          zebra={false}
          wrapperClassName="min-h-0 flex-1"
          className="[&_thead_th]:bg-base-100 [&_thead_th]:text-[10px]"
          emptyDescription="No records match this view."
          headers={
            <tr>
              <th className="w-10">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 cursor-pointer appearance-auto rounded border border-base-300 bg-base-100 align-middle accent-primary"
                    checked={allRowsSelected}
                    onChange={(event) => toggleSelectAllRows(event.target.checked)}
                    aria-label="Select all rows"
                  />
                </div>
              </th>
              {displayColumns.map((col) => (
                <th key={col.fieldname} className={isAmountField(col.fieldname) ? "text-right" : ""}>
                  {isLeadEntity ? (
                    <button
                      type="button"
                      onClick={() => toggleColumnSort(col.fieldname)}
                      className={`inline-flex items-center gap-1 ${isAmountField(col.fieldname) ? "ml-auto" : ""}`}
                      aria-label={`Sort by ${col.label}`}
                    >
                      <span>{col.label}</span>
                      {sortField === col.fieldname ? <span>{sortOrder === "asc" ? "↑" : "↓"}</span> : <span className="opacity-40">↕</span>}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th className="w-10 text-right">Actions</th>
            </tr>
          }
          rows={visibleRows.map((row, index) => {
            const rowId = row.id != null ? String(row.id) : String(index);
            return (
              <tr
                key={rowId}
                className="group cursor-pointer"
                onClick={() => {
                  if (row.id != null) router.push(`/crm/${entity}/${String(row.id)}`);
                }}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && row.id != null) {
                    event.preventDefault();
                    router.push(`/crm/${entity}/${String(row.id)}`);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={row.id != null ? `Open record ${rowId}` : undefined}
              >
                <td className="w-10">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 cursor-pointer appearance-auto rounded border border-base-300 bg-base-100 align-middle accent-primary"
                      checked={selectedRowIds.includes(rowId)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleRowSelection(rowId, event.target.checked)}
                      aria-label={`Select row ${rowId}`}
                    />
                  </div>
                </td>
                {displayColumns.map((col) => (
                  <td key={`${rowId}:${col.fieldname}`} className={isAmountField(col.fieldname) ? "text-right font-medium tabular-nums" : ""}>
                    {renderCellContent(col.fieldname, row)}
                  </td>
                ))}
                <td className="w-10 text-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs h-7 min-h-7 w-7 rounded-md border border-transparent p-0 text-text-muted opacity-0 transition group-hover:opacity-100 hover:border-base-300 hover:bg-base-100"
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Row actions for ${rowId}`}
                  >
                    ⋯
                  </button>
                </td>
              </tr>
            );
          })}
        />
        <div className="sticky bottom-0 z-[2] mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-200 bg-base-100 px-3 py-2">
          <p className="text-xs text-text-muted">
            {pageStart}-{pageEnd} of {pageTotal} (Page {pageInfo?.page || page}/{pageInfo?.total_pages || 1})
          </p>
          <div className="ml-auto flex flex-nowrap items-center gap-2 overflow-x-auto">
            <AppSelect
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(event) => {
                const nextSize = parsePageSize(event.target.value);
                setPageSize(nextSize);
                setPage(1);
                updateQuery({ page_size: nextSize, page: 1 });
              }}
              className="h-8 min-w-[108px] text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} rows
                </option>
              ))}
            </AppSelect>

            <AppButton
              variant="outline"
              size="sm"
              disabled={(pageInfo?.page || page) <= 1}
              onClick={() => {
                const next = Math.max(1, (pageInfo?.page || page) - 1);
                setPage(next);
                updateQuery({ page: next, page_size: pageSize });
              }}
              className="h-8 px-2.5 text-xs text-primary"
            >
              Prev
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              disabled={(pageInfo?.page || page) >= (pageInfo?.total_pages || 1)}
              onClick={() => {
                const next = Math.min(pageInfo?.total_pages || 1, (pageInfo?.page || page) + 1);
                setPage(next);
                updateQuery({ page: next, page_size: pageSize });
              }}
              className="h-8 px-2.5 text-xs text-primary"
            >
              Next
            </AppButton>
          </div>
        </div>
      </section>
    </div>
  );
}
