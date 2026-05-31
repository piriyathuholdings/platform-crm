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

type UserRow = { id: string; email: string; full_name: string; is_active: boolean; roles: string[] };
type UserListResponse = { items: UserRow[] };

const TABLE_COLUMNS: TableColumnOption[] = [
  { key: "full_name", label: "User" },
  { key: "email", label: "Email" },
  { key: "roles", label: "Role" },
  { key: "is_active", label: "Status" }
];

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<UserRow[]>([]);
  const [filters, setFilters] = useState({ email: "", role: "", is_active: "all" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"BUSINESS_ADMIN" | "BUSINESS_USER">("BUSINESS_USER");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(TABLE_COLUMNS.map((column) => column.key));
  const { loading, notice, error, setError, runAction } = useAsyncFeedback();

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (filters.email.trim()) query.set("email", filters.email.trim());
    if (filters.role) query.set("role", filters.role);
    if (filters.is_active === "active") query.set("is_active", "true");
    if (filters.is_active === "inactive") query.set("is_active", "false");
    query.set("limit", "200");
    query.set("offset", "0");
    return query.toString();
  }, [filters]);

  const defaultColumns = useMemo(() => TABLE_COLUMNS.map((column) => column.key), []);

  useEffect(() => {
    const parsed = parseColumnsFromQuery(searchParams.get("cols"), defaultColumns, defaultColumns);
    setVisibleColumns((previous) => (arraysEqual(previous, parsed) ? previous : parsed));
  }, [defaultColumns, searchParams]);

  const renderedColumns = useMemo(() => orderColumnsByVisible(TABLE_COLUMNS, visibleColumns), [visibleColumns]);

  const loadUsers = useCallback(async () => {
    const result = await apiFetch<UserListResponse>(`/users?${queryString}`);
    setItems(result.items || []);
  }, [queryString]);

  useEffect(() => {
    loadUsers().catch((e) => setError((e as Error).message));
  }, [loadUsers, setError]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      async () => {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({ full_name: name.trim(), email: email.trim(), temporary_password: password, roles: [role] })
        });
        setName("");
        setEmail("");
        setPassword("");
        setRole("BUSINESS_USER");
        await loadUsers();
      },
      { successMessage: "User created successfully." }
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

  function renderUserCell(user: UserRow, key: string) {
    if (key === "full_name") {
      return <LinkedCell value={user.full_name || "-"} href={`/crm/admin/users/${encodeURIComponent(user.id)}`} ariaLabel="Open user in new tab" />;
    }
    if (key === "email") {
      return <LinkedCell value={user.email || "-"} href={`/crm/admin/users/${encodeURIComponent(user.id)}`} ariaLabel="Open user in new tab" />;
    }
    if (key === "roles") {
      return <AppBadge tone={user.roles.includes("BUSINESS_ADMIN") ? "primary" : "secondary"}>{user.roles.join(", ") || "-"}</AppBadge>;
    }
    if (key === "is_active") {
      return <AppBadge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Active" : "Inactive"}</AppBadge>;
    }
    return "-";
  }

  return (
    <div className="space-y-3">
      <AppPageHeader title="Admin Users" subtitle="Manage platform access, roles, and credentials." />

      <AppCard title="Add User">
        <form className="grid gap-2.5 md:grid-cols-2" onSubmit={createUser}>
          <AppInput label="Full Name *" required value={name} onChange={(e) => setName(e.target.value)} />
          <AppInput label="Email *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <AppInput label="Temporary Password *" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <AppSelect label="Role" value={role} onChange={(e) => setRole(e.target.value as "BUSINESS_ADMIN" | "BUSINESS_USER")}>
            <option value="BUSINESS_USER">Business User</option>
            <option value="BUSINESS_ADMIN">Business Admin</option>
          </AppSelect>
          <div className="md:col-span-2">
            <AppButton loading={loading} type="submit" leftIcon={<span aria-hidden>+</span>}>
              Create User
            </AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard title="Filters">
        <div className="grid gap-2.5 md:grid-cols-3">
          <AppInput label="Search Email" value={filters.email} onChange={(e) => setFilters((prev) => ({ ...prev, email: e.target.value }))} />
          <AppSelect label="Role" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
            <option value="">All Roles</option>
            <option value="BUSINESS_USER">Business User</option>
            <option value="BUSINESS_ADMIN">Business Admin</option>
          </AppSelect>
          <AppSelect label="Status" value={filters.is_active} onChange={(e) => setFilters((prev) => ({ ...prev, is_active: e.target.value }))}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AppSelect>
        </div>
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
          rows={items.map((user) => (
            <tr key={user.id}>
              {renderedColumns.map((column) => (
                <td key={`${user.id}:${column.key}`}>{renderUserCell(user, column.key)}</td>
              ))}
            </tr>
          ))}
        />
      </AppCard>
    </div>
  );
}
