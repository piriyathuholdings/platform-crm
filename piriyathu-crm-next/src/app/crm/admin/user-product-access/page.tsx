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
  AppSelect,
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

type UserProductAccessRow = {
  id: string;
  record_id: string;
  user: string;
  product: string;
  product__id?: string;
  role_in_product?: string | null;
  is_active: boolean;
  valid_from?: string | null;
  valid_till?: string | null;
};

type UserProductAccessListResponse = { items: UserProductAccessRow[] };

const TABLE_COLUMNS: TableColumnOption[] = [
  { key: "record_id", label: "ID" },
  { key: "user", label: "User" },
  { key: "product", label: "Product" },
  { key: "role_in_product", label: "Role" },
  { key: "is_active", label: "Status" },
  { key: "valid_from", label: "Valid From" },
  { key: "valid_till", label: "Valid Till" }
];

export default function AdminUserProductAccessPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<UserProductAccessRow[]>([]);
  const [user, setUser] = useState("");
  const [product, setProduct] = useState("");
  const [roleInProduct, setRoleInProduct] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTill, setValidTill] = useState("");
  const [isActive, setIsActive] = useState("1");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(TABLE_COLUMNS.map((column) => column.key));
  const { loading, error, notice, setError, runAction } = useAsyncFeedback();

  const defaultColumns = useMemo(() => TABLE_COLUMNS.map((column) => column.key), []);

  useEffect(() => {
    const parsed = parseColumnsFromQuery(searchParams.get("cols"), defaultColumns, defaultColumns);
    setVisibleColumns((previous) => (arraysEqual(previous, parsed) ? previous : parsed));
  }, [defaultColumns, searchParams]);

  const renderedColumns = useMemo(() => orderColumnsByVisible(TABLE_COLUMNS, visibleColumns), [visibleColumns]);

  const loadUserProductAccess = useCallback(async () => {
    const payload = await apiFetch<UserProductAccessListResponse>("/user-product-access?limit=200&offset=0");
    setItems(payload.items || []);
  }, []);

  useEffect(() => {
    loadUserProductAccess().catch((e) => setError((e as Error).message));
  }, [loadUserProductAccess, setError]);

  async function saveUserProductAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      async () => {
        await apiFetch("/user-product-access", {
          method: "POST",
          body: JSON.stringify({
            user: user.trim(),
            product: product.trim(),
            role_in_product: roleInProduct.trim() || null,
            is_active: isActive === "1" ? 1 : 0,
            valid_from: validFrom || null,
            valid_till: validTill || null
          })
        });
        setUser("");
        setProduct("");
        setRoleInProduct("");
        setValidFrom("");
        setValidTill("");
        setIsActive("1");
        await loadUserProductAccess();
      },
      { successMessage: "Product user access created successfully." }
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

  function renderAccessCell(row: UserProductAccessRow, key: string) {
    if (key === "record_id") return row.record_id || "-";
    if (key === "user") {
      return <LinkedCell value={row.user || "-"} href={`/crm/admin/users/${encodeURIComponent(row.user)}`} ariaLabel="Open user in new tab" />;
    }
    if (key === "product") {
      const productId = row.product__id || row.product;
      return <LinkedCell value={row.product || "-"} href={`/crm/products/${encodeURIComponent(productId)}`} ariaLabel="Open product in new tab" />;
    }
    if (key === "role_in_product") return row.role_in_product || "-";
    if (key === "is_active") {
      return <AppBadge tone={row.is_active ? "success" : "warning"}>{row.is_active ? "Active" : "Inactive"}</AppBadge>;
    }
    if (key === "valid_from") return row.valid_from || "-";
    if (key === "valid_till") return row.valid_till || "-";
    return "-";
  }

  return (
    <div className="space-y-3">
      <AppPageHeader title="Admin Product User Access" subtitle="Manage user-level access assignments for products." />

      <AppCard title="Add Product User Access">
        <form onSubmit={saveUserProductAccess} className="grid gap-2.5 md:grid-cols-2">
          <AppInput label="User *" required value={user} onChange={(e) => setUser(e.target.value)} placeholder="user@example.com" />
          <AppInput label="Product *" required value={product} onChange={(e) => setProduct(e.target.value)} placeholder="PROD-00001" />
          <AppInput label="Role In Product" value={roleInProduct} onChange={(e) => setRoleInProduct(e.target.value)} placeholder="Manager" />
          <AppSelect label="Status" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </AppSelect>
          <AppInput label="Valid From" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          <AppInput label="Valid Till" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
          <div className="md:col-span-2">
            <AppButton loading={loading} type="submit" leftIcon={<span aria-hidden>+</span>}>
              Create Product User Access
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
                <td key={`${row.id}:${column.key}`}>{renderAccessCell(row, column.key)}</td>
              ))}
            </tr>
          ))}
        />
      </AppCard>
    </div>
  );
}
