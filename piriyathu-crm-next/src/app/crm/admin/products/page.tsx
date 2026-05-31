"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  AppAlert,
  AppBadge,
  AppButton,
  AppCard,
  AppColumnManager,
  AppDataTable,
  AppInput,
  AppPageHeader,
  AppTextarea,
  LinkedCell
} from "@/components/ui";
import { useAsyncFeedback } from "@/hooks/useAsyncFeedback";
import { apiFetch } from "@/lib/api-client";
import {
  arraysEqual,
  orderColumnsByVisible,
  parseColumnsFromQuery,
  serializeColumnsForQuery,
  type TableColumnOption
} from "@/lib/table-columns";

type ProductRow = {
  id: string;
  record_id: string;
  product_name: string;
  product_code?: string | null;
  product_type?: string | null;
  is_active: boolean;
};
type ProductListResponse = { items: ProductRow[] };

const TABLE_COLUMNS: TableColumnOption[] = [
  { key: "record_id", label: "ID" },
  { key: "product_name", label: "Name" },
  { key: "product_code", label: "Code" },
  { key: "product_type", label: "Type" },
  { key: "is_active", label: "Status" }
];

export default function AdminProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ProductRow[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(TABLE_COLUMNS.map((column) => column.key));
  const { loading, error, notice, setError, runAction } = useAsyncFeedback();

  const defaultColumns = useMemo(() => TABLE_COLUMNS.map((column) => column.key), []);

  useEffect(() => {
    const parsed = parseColumnsFromQuery(searchParams.get("cols"), defaultColumns, defaultColumns);
    setVisibleColumns((previous) => (arraysEqual(previous, parsed) ? previous : parsed));
  }, [defaultColumns, searchParams]);

  const renderedColumns = useMemo(() => orderColumnsByVisible(TABLE_COLUMNS, visibleColumns), [visibleColumns]);

  const loadProducts = useCallback(async () => {
    const payload = await apiFetch<ProductListResponse>("/products?limit=200&offset=0");
    setItems(payload.items || []);
  }, []);

  useEffect(() => {
    loadProducts().catch((e) => setError((e as Error).message));
  }, [loadProducts, setError]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      async () => {
        await apiFetch("/products", {
          method: "POST",
          body: JSON.stringify({
            product_name: name.trim(),
            product_code: code || null,
            product_type: type || null,
            description: description || null,
            is_active: true
          })
        });
        setName("");
        setCode("");
        setType("");
        setDescription("");
        await loadProducts();
      },
      { successMessage: "Product created successfully." }
    );
  }

  function updateColumns(nextVisible: string[]) {
    setVisibleColumns(nextVisible);
    const params = new URLSearchParams(searchParams.toString());
    const serialized = serializeColumnsForQuery(nextVisible, defaultColumns);
    if (serialized) params.set("cols", serialized);
    else params.delete("cols");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`);
  }

  function renderProductCell(row: ProductRow, key: string) {
    if (key === "record_id") {
      return <LinkedCell value={row.record_id || "-"} href={`/crm/products/${encodeURIComponent(row.id)}`} ariaLabel="Open product in new tab" />;
    }
    if (key === "product_name") {
      return <LinkedCell value={row.product_name || "-"} href={`/crm/products/${encodeURIComponent(row.id)}`} ariaLabel="Open product in new tab" />;
    }
    if (key === "product_code") return row.product_code || "-";
    if (key === "product_type") return row.product_type || "-";
    if (key === "is_active") {
      return <AppBadge tone={row.is_active ? "success" : "warning"}>{row.is_active ? "Active" : "Inactive"}</AppBadge>;
    }
    return "-";
  }

  return (
    <div className="space-y-3">
      <AppPageHeader title="Admin Products" subtitle="Manage catalog and ownership structure." />

      <AppCard title="Add Product">
        <form onSubmit={saveProduct} className="grid gap-2.5 md:grid-cols-2">
          <AppInput label="Product Name *" required value={name} onChange={(e) => setName(e.target.value)} />
          <AppInput label="Product Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <AppInput label="Product Type" value={type} onChange={(e) => setType(e.target.value)} />
          <div className="md:col-span-2">
            <AppTextarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2">
            <AppButton loading={loading} type="submit" leftIcon={<span aria-hidden>+</span>}>
              Create Product
            </AppButton>
          </div>
        </form>
      </AppCard>

      {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      {notice ? <AppAlert tone="success">{notice}</AppAlert> : null}

      <AppCard>
        <div className="mb-2 flex justify-end">
          <AppColumnManager columns={TABLE_COLUMNS} value={visibleColumns} onChange={updateColumns} />
        </div>
        <AppDataTable
          colSpan={Math.max(1, renderedColumns.length)}
          isEmpty={items.length === 0}
          headers={
            <tr>
              {renderedColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          }
          rows={items.map((row) => (
            <tr key={row.id}>
              {renderedColumns.map((column) => (
                <td key={`${row.id}:${column.key}`}>{renderProductCell(row, column.key)}</td>
              ))}
            </tr>
          ))}
        />
      </AppCard>
    </div>
  );
}
