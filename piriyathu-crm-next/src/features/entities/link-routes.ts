export function buildCrmRecordHrefFromDoctype(doctype: string, recordId: string): string | null {
  if (!doctype || !recordId) return null;
  const map: Record<string, string> = {
    Product: "products",
    "User Product Access": "user-product-access",
    Organization: "organizations",
    Lead: "leads",
    Deal: "deals",
    Task: "tasks",
    Note: "notes",
    Activity: "call-logs",
    Expense: "expenses",
    "Client Payment": "client-payments",
    User: "admin/users"
  };
  const route = map[doctype];
  if (!route) return null;
  return `/crm/${route}/${encodeURIComponent(recordId)}`;
}
