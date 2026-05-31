import { NextRequest, NextResponse } from "next/server";

const FRAPPE_BASE_URL = process.env.FRAPPE_BASE_URL || "http://localhost:8000";
const NEXTJS_ORIGIN = process.env.NEXTJS_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || "http://127.0.0.1:3000";

type EntityKey =
  | "products"
  | "user-product-access"
  | "leads"
  | "deals"
  | "contacts"
  | "organizations"
  | "tasks"
  | "notes"
  | "expenses"
  | "client-payments"
  | "call-logs";

type UserContext = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
};

const ENTITY_TO_DOCTYPE: Record<EntityKey, string> = {
  products: "Product",
  "user-product-access": "User Product Access",
  leads: "Lead",
  deals: "Deal",
  contacts: "Contact",
  organizations: "Organization",
  tasks: "Task",
  notes: "Note",
  expenses: "Expense",
  "client-payments": "Client Payment",
  "call-logs": "Activity"
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", route: "/crm" },
  { key: "leads", label: "Leads", route: "/crm/leads/view/list" },
  { key: "deals", label: "Deals", route: "/crm/deals/view/list" },
  { key: "organizations", label: "Organizations", route: "/crm/organizations/view/list" },
  { key: "notes", label: "Notes", route: "/crm/notes/view/list" },
  { key: "tasks", label: "Tasks", route: "/crm/tasks/view/list" },
  { key: "expenses", label: "Expenses", route: "/crm/expenses/view/list" },
  { key: "client-payments", label: "Client Payments", route: "/crm/client-payments/view/list" },
  { key: "call-logs", label: "Call Logs", route: "/crm/call-logs/view/list" }
];

const APP_ROLE_BUSINESS_ADMIN = "BUSINESS_ADMIN";
const APP_ROLE_BUSINESS_USER = "BUSINESS_USER";

const FRAPPE_BUSINESS_ADMIN_ROLES = new Set(["Business Admin", "CRM Manager"]);
const FRAPPE_BUSINESS_USER_ROLES = new Set(["Business User", "CRM User"]);

const DOCTYPES_REQUIRING_PRODUCT = new Set([
  "Organization",
  "Lead",
  "Deal",
  "Task",
  "Activity",
  "Expense",
  "Client Payment"
]);

const DOCTYPES_REQUIRING_ASSIGNED_TO = new Set([
  "Organization",
  "Lead",
  "Deal",
  "Task",
  "Activity",
  "Expense",
  "Client Payment"
]);

const DEFAULT_LIST_FIELDS: Record<string, string[]> = {
  products: ["name", "product_code", "product_name", "product_type", "is_active", "description"],
  "user-product-access": ["name", "user", "product", "role_in_product", "is_active", "valid_from", "valid_till"],
  leads: ["name", "lead_name", "contact_name", "location", "status", "email", "mobile_no", "product", "assigned_to", "modified"],
  deals: [
    "name",
    "deal_title",
    "organization",
    "deal_status",
    "probability",
    "deal_value",
    "total_payments_received",
    "to_collect",
    "product",
    "assigned_to",
    "modified"
  ],
  contacts: ["name", "full_name", "email", "mobile_no", "organization", "modified"],
  organizations: ["name", "organization_name", "contact_name", "location", "email", "phone", "product", "assigned_to", "modified"],
  tasks: ["name", "title", "status", "priority", "due_date", "deal", "product", "assigned_to", "modified"],
  notes: ["name", "title", "note_content", "deal", "product", "assigned_to", "modified"],
  expenses: ["name", "expense_title", "expense_scope", "status", "amount", "deal", "product", "assigned_to", "borne_by", "modified"],
  "client-payments": ["name", "payment_type", "status", "amount", "deal", "product", "assigned_to", "modified"],
  activities: ["name", "subject", "activity_type", "status", "activity_date", "deal", "product", "assigned_to", "modified"],
  "call-logs": ["name", "subject", "activity_type", "status", "activity_date", "deal", "product", "assigned_to", "modified"],
  comments: ["name", "comment_by", "comment_email", "content", "creation", "reference_doctype", "reference_name"],
  users: ["name", "email", "full_name", "is_active", "role", "modified"]
};

const ENTITY_FIELD_ALLOWLIST: Record<EntityKey, string[]> = {
  products: ["product_code", "product_name", "product_type", "product_owner", "is_active", "description"],
  "user-product-access": ["user", "product", "role_in_product", "is_active", "valid_from", "valid_till"],
  leads: ["lead_name", "contact_name", "location", "product", "assigned_to", "status", "source", "email", "mobile_no", "lost_reason"],
  deals: [
    "deal_title",
    "product",
    "assigned_to",
    "lead",
    "organization",
    "contact_name",
    "deal_status",
    "deal_value",
    "total_payments_received",
    "to_collect",
    "deal_value_change_reason",
    "lost_reason"
  ],
  contacts: ["full_name", "product", "organization", "assigned_to", "status", "email", "mobile_no", "job_title"],
  organizations: ["organization_name", "contact_name", "location", "product", "assigned_to", "status", "industry", "phone", "email", "website"],
  tasks: ["title", "product", "assigned_to", "lead", "deal", "organization", "contact", "status", "priority", "due_date"],
  notes: [
    "title",
    "product",
    "assigned_to",
    "lead",
    "deal",
    "organization",
    "contact",
    "note_content",
    "follow_up_date",
    "create_follow_up_task"
  ],
  expenses: [
    "expense_title",
    "expense_scope",
    "product",
    "assigned_to",
    "borne_by",
    "deal",
    "organization",
    "contact",
    "expense_date",
    "amount",
    "status"
  ],
  "client-payments": [
    "product",
    "assigned_to",
    "deal",
    "organization",
    "contact",
    "payment_date",
    "payment_type",
    "status",
    "amount",
    "reference_number"
  ],
  "call-logs": [
    "activity_type",
    "subject",
    "product",
    "assigned_to",
    "deal",
    "organization",
    "contact",
    "activity_date",
    "status",
    "description"
  ]
};

const ENTITY_PRIMARY_FIELD: Record<EntityKey, string> = {
  products: "product_name",
  "user-product-access": "role_in_product",
  leads: "lead_name",
  deals: "deal_title",
  contacts: "full_name",
  organizations: "organization_name",
  tasks: "title",
  notes: "title",
  expenses: "expense_title",
  "client-payments": "reference_number",
  "call-logs": "subject"
};

type RelatedCardDefinition = {
  id: string;
  title: string;
  entity: EntityKey;
  buildPrimaryFilters: (source: Record<string, unknown>) => [string, string, string | number | string[]][];
  buildFallbackFilters?: (source: Record<string, unknown>) => [string, string, string | number | string[]][];
};

const RELATED_CARD_DEFINITIONS: Record<EntityKey, RelatedCardDefinition[]> = {
  products: [
    { id: "related-organizations", title: "Organizations", entity: "organizations", buildPrimaryFilters: (s) => byProductFilters(s) },
    { id: "related-leads", title: "Leads", entity: "leads", buildPrimaryFilters: (s) => byProductFilters(s) },
    { id: "related-deals", title: "Deals", entity: "deals", buildPrimaryFilters: (s) => byProductFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byProductFilters(s) }
  ],
  organizations: [
    { id: "related-leads", title: "Leads", entity: "leads", buildPrimaryFilters: (s) => byOrganizationFilters(s) },
    { id: "related-deals", title: "Deals", entity: "deals", buildPrimaryFilters: (s) => byOrganizationFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byOrganizationFilters(s) }
  ],
  contacts: [
    { id: "related-deals", title: "Deals", entity: "deals", buildPrimaryFilters: (s) => byContactFilters(s) },
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byContactFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byContactFilters(s) },
    { id: "related-activities", title: "Activities", entity: "call-logs", buildPrimaryFilters: (s) => byContactFilters(s) }
  ],
  leads: [
    {
      id: "related-deals",
      title: "Deals",
      entity: "deals",
      buildPrimaryFilters: (s) => byLeadFilters(s)
    },
    {
      id: "related-notes",
      title: "Notes",
      entity: "notes",
      buildPrimaryFilters: (s) => byLeadFilters(s)
    },
    {
      id: "related-activities",
      title: "Activities",
      entity: "call-logs",
      buildPrimaryFilters: (s) => byLeadFilters(s)
    },
    {
      id: "related-tasks",
      title: "Tasks",
      entity: "tasks",
      buildPrimaryFilters: (s) => byLeadFilters(s)
    }
  ],
  deals: [
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byDealFilters(s) },
    {
      id: "related-activities",
      title: "Activities",
      entity: "call-logs",
      buildPrimaryFilters: (s) => byDealFilters(s)
    },
    {
      id: "related-client-payments",
      title: "Client Payments",
      entity: "client-payments",
      buildPrimaryFilters: (s) => byDealFilters(s)
    },
    { id: "related-expenses", title: "Expenses", entity: "expenses", buildPrimaryFilters: (s) => byDealFilters(s) }
  ],
  tasks: [
    {
      id: "related-notes",
      title: "Notes",
      entity: "notes",
      buildPrimaryFilters: (s) => byTaskScopedFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    },
    {
      id: "related-activities",
      title: "Activities",
      entity: "call-logs",
      buildPrimaryFilters: (s) => byTaskScopedFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    },
    {
      id: "related-expenses",
      title: "Expenses",
      entity: "expenses",
      buildPrimaryFilters: (s) => byTaskScopedFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    },
    {
      id: "related-client-payments",
      title: "Client Payments",
      entity: "client-payments",
      buildPrimaryFilters: (s) => byTaskScopedFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    }
  ],
  notes: [
    {
      id: "related-deals",
      title: "Deals",
      entity: "deals",
      buildPrimaryFilters: (s) => byDealFilters(s),
      buildFallbackFilters: (s) => byOrganizationProductFilters(s)
    },
    {
      id: "related-tasks",
      title: "Tasks",
      entity: "tasks",
      buildPrimaryFilters: (s) => byDealFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    },
    {
      id: "related-activities",
      title: "Activities",
      entity: "call-logs",
      buildPrimaryFilters: (s) => byDealFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    },
    {
      id: "related-client-payments",
      title: "Client Payments",
      entity: "client-payments",
      buildPrimaryFilters: (s) => byDealFilters(s),
      buildFallbackFilters: (s) => byOrganizationContactProductFilters(s)
    }
  ],
  expenses: [
    { id: "related-deal", title: "Deal", entity: "deals", buildPrimaryFilters: (s) => byDealNameFilters(s) },
    {
      id: "related-client-payments",
      title: "Client Payments",
      entity: "client-payments",
      buildPrimaryFilters: (s) => byDealFilters(s)
    },
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byDealFilters(s) }
  ],
  "client-payments": [
    { id: "related-deal", title: "Deal", entity: "deals", buildPrimaryFilters: (s) => byDealNameFilters(s) },
    { id: "related-expenses", title: "Expenses", entity: "expenses", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byDealFilters(s) }
  ],
  "user-product-access": [
    { id: "related-leads", title: "Leads", entity: "leads", buildPrimaryFilters: (s) => byUserProductFilters(s) },
    { id: "related-deals", title: "Deals", entity: "deals", buildPrimaryFilters: (s) => byUserProductFilters(s) },
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byUserProductFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byUserProductFilters(s) }
  ],
  "call-logs": [
    { id: "related-tasks", title: "Tasks", entity: "tasks", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-notes", title: "Notes", entity: "notes", buildPrimaryFilters: (s) => byDealFilters(s) },
    { id: "related-expenses", title: "Expenses", entity: "expenses", buildPrimaryFilters: (s) => byDealFilters(s) },
    {
      id: "related-client-payments",
      title: "Client Payments",
      entity: "client-payments",
      buildPrimaryFilters: (s) => byDealFilters(s)
    }
  ]
};

const ALLOWED_PAGE_SIZES = [10, 20, 50] as const;

type FrappeFilterTuple = [string, string, string | number | string[]];

function asNonEmptyString(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asNonEmptyString(source?.[key]);
    if (value) return value;
  }
  return "";
}

function buildEqualsFilter(field: string, value: string): FrappeFilterTuple[] {
  if (!value) return [];
  return [[field, "=", value]];
}

function uniqueFilters(filters: FrappeFilterTuple[]): FrappeFilterTuple[] {
  const seen = new Set<string>();
  const result: FrappeFilterTuple[] = [];
  for (const [field, op, value] of filters) {
    const key = `${field}::${op}::${Array.isArray(value) ? value.join("|") : String(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([field, op, value]);
  }
  return result;
}

function byProductFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const product = pickFirstString(source, ["product", "name"]);
  return buildEqualsFilter("product", product);
}

function byOrganizationFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const organization = pickFirstString(source, ["organization", "name"]);
  return buildEqualsFilter("organization", organization);
}

function byContactFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const contact = pickFirstString(source, ["contact", "name"]);
  return buildEqualsFilter("contact", contact);
}

function byLeadFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const lead = pickFirstString(source, ["lead", "name"]);
  return buildEqualsFilter("lead", lead);
}

function byDealFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const deal = pickFirstString(source, ["deal", "name"]);
  return buildEqualsFilter("deal", deal);
}

function byDealNameFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const deal = pickFirstString(source, ["deal", "name"]);
  return buildEqualsFilter("name", deal);
}

function byOrganizationProductFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const organization = pickFirstString(source, ["organization"]);
  if (organization) return [["organization", "=", organization]];
  const product = pickFirstString(source, ["product"]);
  if (product) return [["product", "=", product]];
  return [];
}

function byOrganizationContactProductFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const organization = pickFirstString(source, ["organization"]);
  if (organization) return [["organization", "=", organization]];
  const contact = pickFirstString(source, ["contact"]);
  if (contact) return [["contact", "=", contact]];
  const product = pickFirstString(source, ["product"]);
  if (product) return [["product", "=", product]];
  return [];
}

function byTaskScopedFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const deal = pickFirstString(source, ["deal"]);
  if (deal) return [["deal", "=", deal]];
  const organization = pickFirstString(source, ["organization"]);
  if (organization) return [["organization", "=", organization]];
  const contact = pickFirstString(source, ["contact"]);
  if (contact) return [["contact", "=", contact]];
  const product = pickFirstString(source, ["product"]);
  if (product) return [["product", "=", product]];
  return [];
}

function byUserProductFilters(source: Record<string, unknown>): FrappeFilterTuple[] {
  const filters: FrappeFilterTuple[] = [];
  const user = pickFirstString(source, ["user", "assigned_to", "owner"]);
  const product = pickFirstString(source, ["product"]);
  if (user) filters.push(["assigned_to", "=", user]);
  if (product) filters.push(["product", "=", product]);
  return uniqueFilters(filters);
}

function clampPageSize(value: unknown): number {
  const parsed = Number(value || 20);
  if (!Number.isFinite(parsed)) return 20;
  const candidate = Math.round(parsed);
  if (ALLOWED_PAGE_SIZES.includes(candidate as (typeof ALLOWED_PAGE_SIZES)[number])) return candidate;
  return 20;
}

function toIsoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, daysAgo));
  return date.toISOString().slice(0, 10);
}

function humanizeFieldname(fieldname: string): string {
  return fieldname
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inferFieldtypeFromFieldname(fieldname: string): string {
  const name = fieldname.toLowerCase();
  if (name === "creation" || name === "modified") return "Datetime";
  if (name === "owner" || name === "modified_by") return "Link";
  if (
    name === "product" ||
    name === "assigned_to" ||
    name === "borne_by" ||
    name === "lead" ||
    name === "deal" ||
    name === "organization" ||
    name === "contact" ||
    name === "user"
  ) {
    return "Link";
  }
  if (name.includes("date")) return "Date";
  if (name.includes("time")) return "Datetime";
  if (name.startsWith("is_") || name.startsWith("has_")) return "Check";
  if (name.includes("description") || name.includes("content") || name.includes("reason")) return "Text";
  if (name.includes("amount") || name.includes("value") || name.includes("percent")) return "Currency";
  if (name.includes("email")) return "Email";
  if (name.includes("phone") || name.includes("mobile")) return "Phone";
  if (name.includes("status") || name.includes("type") || name.includes("scope") || name.includes("priority")) return "Select";
  return "Data";
}

function inferLinkDoctypeFromFieldname(fieldname: string): string | null {
  const name = fieldname.toLowerCase();
  const map: Record<string, string> = {
    product: "Product",
    assigned_to: "User",
    borne_by: "User",
    owner: "User",
    modified_by: "User",
    lead: "Lead",
    deal: "Deal",
    organization: "Organization",
    contact: "Contact",
    user: "User"
  };
  return map[name] || null;
}

function parseSelectOptions(rawOptions: unknown): string[] {
  if (typeof rawOptions !== "string" || !rawOptions.trim()) return [];
  const normalized = rawOptions.includes("\\n") ? rawOptions.replace(/\\n/g, "\n") : rawOptions;
  return normalized
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith("-"));
}

function asFieldMetaList(payload: any): Record<string, any>[] {
  const message = payload?.message;
  if (Array.isArray(message)) {
    return message;
  }
  if (typeof message === "string") {
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray((parsed as any)?.fields)) return (parsed as any).fields;
      if (Array.isArray((parsed as any)?.docs)) {
        for (const doc of (parsed as any).docs) {
          if (Array.isArray((doc as any)?.fields)) return (doc as any).fields;
        }
      }
    } catch {
      // ignore invalid payload.message JSON
    }
  }
  const fromGetMeta = payload?.message?.fields;
  if (Array.isArray(fromGetMeta)) return fromGetMeta;
  if (fromGetMeta && typeof fromGetMeta === "object") {
    const values = Object.values(fromGetMeta as Record<string, unknown>);
    if (values.length && values.every((entry) => entry && typeof entry === "object")) {
      return values as Record<string, any>[];
    }
  }

  const fromMessageDocs = payload?.message?.docs;
  if (Array.isArray(fromMessageDocs)) {
    for (const doc of fromMessageDocs) {
      if (Array.isArray((doc as any)?.fields)) return (doc as any).fields;
    }
  }

  const fromDoctypeDocs = payload?.docs;
  if (Array.isArray(fromDoctypeDocs)) {
    for (const doc of fromDoctypeDocs) {
      if (Array.isArray((doc as any)?.fields)) return (doc as any).fields;
    }
  }

  const fromResource = payload?.data?.fields;
  if (Array.isArray(fromResource)) return fromResource;
  if (fromResource && typeof fromResource === "object") {
    const values = Object.values(fromResource as Record<string, unknown>);
    if (values.length && values.every((entry) => entry && typeof entry === "object")) {
      return values as Record<string, any>[];
    }
  }

  return [];
}

async function fetchDoctypeMetaFields(doctype: string, req: NextRequest): Promise<Record<string, any>[]> {
  const mergedByFieldname = new Map<string, Record<string, any>>();
  const mergeFields = (fields: Record<string, any>[]) => {
    for (const field of fields) {
      const fieldname = asNonEmptyString((field as any)?.fieldname);
      if (!fieldname) continue;
      const existing = mergedByFieldname.get(fieldname);
      if (!existing) {
        mergedByFieldname.set(fieldname, field);
        continue;
      }
      const existingFieldtype = asNonEmptyString((existing as any)?.fieldtype);
      const nextFieldtype = asNonEmptyString((field as any)?.fieldtype);
      const existingOptions = parseSelectOptions((existing as any)?.options);
      const nextOptions = parseSelectOptions((field as any)?.options);
      const shouldReplace =
        (nextOptions.length > 0 && existingOptions.length === 0) ||
        (!existingFieldtype && Boolean(nextFieldtype)) ||
        (existingFieldtype === "Data" && nextFieldtype !== "Data");
      if (shouldReplace) {
        mergedByFieldname.set(fieldname, field);
      }
    }
  };

  try {
    const meta = await frappeJson(
      `/api/method/frappe.client.get_meta?doctype=${encodeURIComponent(doctype)}`,
      {},
      req
    );
    const fields = asFieldMetaList(meta.payload);
    if (fields.length) mergeFields(fields);
  } catch {
    // fallback
  }

  try {
    const dt = await frappeJson(
      `/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(doctype)}&with_parent=1`,
      {},
      req
    );
    const fields = asFieldMetaList(dt.payload);
    if (fields.length) mergeFields(fields);
  } catch {
    // fallback
  }

  try {
    const dtResource = await frappeJson(`/api/resource/DocType/${encodeURIComponent(doctype)}`, {}, req);
    const fields = asFieldMetaList(dtResource.payload);
    if (fields.length) mergeFields(fields);
  } catch {
    // ignore
  }

  return Array.from(mergedByFieldname.values());
}

async function fetchSelectOptionsByFieldname(
  doctype: string,
  fieldnames: string[],
  req: NextRequest
): Promise<Map<string, string[]>> {
  const normalized = Array.from(new Set(fieldnames.map((name) => String(name || "").trim()).filter(Boolean)));
  if (!normalized.length) return new Map();
  const byField = new Map<string, string[]>();
  const limit = String(Math.max(50, normalized.length));
  const docFieldQuery = new URLSearchParams({
    fields: JSON.stringify(["fieldname", "options"]),
    filters: JSON.stringify([
      ["parent", "=", doctype],
      ["fieldtype", "=", "Select"],
      ["fieldname", "in", normalized]
    ]),
    limit_start: "0",
    limit_page_length: limit,
    order_by: "idx asc"
  });
  const customFieldQuery = new URLSearchParams({
    fields: JSON.stringify(["fieldname", "options"]),
    filters: JSON.stringify([
      ["dt", "=", doctype],
      ["fieldtype", "=", "Select"],
      ["fieldname", "in", normalized]
    ]),
    limit_start: "0",
    limit_page_length: limit,
    order_by: "creation asc"
  });
  try {
    const [docFieldRes, customFieldRes] = await Promise.all([
      frappeJson(`/api/resource/DocField?${docFieldQuery.toString()}`, {}, req).catch(() => null),
      frappeJson(`/api/resource/${encodeURIComponent("Custom Field")}?${customFieldQuery.toString()}`, {}, req).catch(() => null)
    ]);
    const docFieldRows = Array.isArray(docFieldRes?.payload?.data) ? docFieldRes.payload.data : [];
    const customFieldRows = Array.isArray(customFieldRes?.payload?.data) ? customFieldRes.payload.data : [];
    const rows = [...docFieldRows, ...customFieldRows];
    for (const row of rows) {
      const fieldname = asNonEmptyString((row as any)?.fieldname);
      if (!fieldname) continue;
      const parsed = parseSelectOptions((row as any)?.options);
      if (parsed.length) byField.set(fieldname, parsed);
    }
  } catch {
    return byField;
  }
  return byField;
}

async function fetchSelectOptionsFromMetaByFieldname(
  doctype: string,
  fieldnames: string[],
  req: NextRequest
): Promise<Map<string, string[]>> {
  const normalized = Array.from(new Set(fieldnames.map((name) => String(name || "").trim()).filter(Boolean)));
  if (!normalized.length) return new Map();
  try {
    const meta = await frappeJson(
      `/api/method/frappe.client.get_meta?doctype=${encodeURIComponent(doctype)}`,
      {},
      req
    );
    const fields = asFieldMetaList(meta.payload);
    const wanted = new Set(normalized);
    const byField = new Map<string, string[]>();
    for (const raw of fields) {
      const fieldname = asNonEmptyString((raw as any)?.fieldname);
      if (!fieldname || !wanted.has(fieldname)) continue;
      const fieldtype = asNonEmptyString((raw as any)?.fieldtype);
      if (fieldtype !== "Select") continue;
      byField.set(fieldname, parseSelectOptions((raw as any)?.options));
    }
    return byField;
  } catch {
    return new Map();
  }
}

async function fetchSelectOptionsFromRecordsByFieldname(
  doctype: string,
  fieldnames: string[],
  req: NextRequest
): Promise<Map<string, string[]>> {
  const normalized = Array.from(new Set(fieldnames.map((name) => String(name || "").trim()).filter(Boolean)));
  const byField = new Map<string, string[]>();
  if (!normalized.length) return byField;

  await Promise.all(
    normalized.map(async (fieldname) => {
      try {
        const query = new URLSearchParams({
          fields: JSON.stringify([fieldname]),
          limit_start: "0",
          limit_page_length: "500",
          order_by: "modified desc"
        });
        const listRes = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
        const rows: Record<string, unknown>[] = Array.isArray(listRes.payload?.data) ? (listRes.payload.data as Record<string, unknown>[]) : [];
        const options: string[] = Array.from(
          new Set(
            rows
              .map((row) => asNonEmptyString(row[fieldname]) || "")
              .map((value: string) => value.trim())
              .filter(Boolean)
          )
        );
        if (options.length) byField.set(fieldname, options);
      } catch {
        // ignore and continue
      }
    })
  );

  return byField;
}

function collectSelectOptionsFromUnknownMetaShape(
  node: unknown,
  wanted: Set<string>,
  out: Map<string, string[]>
): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectSelectOptionsFromUnknownMetaShape(item, wanted, out);
    return;
  }
  if (typeof node !== "object") return;

  const row = node as Record<string, unknown>;
  const fieldname = asNonEmptyString(row.fieldname);
  const fieldtype = asNonEmptyString(row.fieldtype);
  if (fieldname && wanted.has(fieldname) && fieldtype === "Select") {
    const parsed = parseSelectOptions(row.options);
    if (parsed.length) out.set(fieldname, parsed);
  }

  for (const value of Object.values(row)) {
    if (value && (Array.isArray(value) || typeof value === "object")) {
      collectSelectOptionsFromUnknownMetaShape(value, wanted, out);
    }
  }
}

async function fetchSelectOptionsFromDoctypeLoadByFieldname(
  doctype: string,
  fieldnames: string[],
  req: NextRequest
): Promise<Map<string, string[]>> {
  const normalized = Array.from(new Set(fieldnames.map((name) => String(name || "").trim()).filter(Boolean)));
  const out = new Map<string, string[]>();
  if (!normalized.length) return out;
  const wanted = new Set(normalized);
  try {
    const [metaRes, loadRes] = await Promise.all([
      frappeJson(`/api/method/frappe.client.get_meta?doctype=${encodeURIComponent(doctype)}`, {}, req).catch(() => null),
      frappeJson(
        `/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(doctype)}&with_parent=1`,
        {},
        req
      ).catch(() => null)
    ]);
    collectSelectOptionsFromUnknownMetaShape(metaRes?.payload, wanted, out);
    collectSelectOptionsFromUnknownMetaShape(loadRes?.payload, wanted, out);
  } catch {
    return out;
  }
  return out;
}

async function fetchSelectOptionsViaSearchLinkByFieldname(
  doctype: string,
  fieldnames: string[],
  req: NextRequest
): Promise<Map<string, string[]>> {
  const normalized = Array.from(new Set(fieldnames.map((name) => String(name || "").trim()).filter(Boolean)));
  const out = new Map<string, string[]>();
  if (!normalized.length) return out;
  await Promise.all(
    normalized.map(async (fieldname) => {
      try {
        const args = encodeURIComponent(
          JSON.stringify({
            doctype,
            txt: "",
            searchfield: fieldname,
            page_len: 200,
            filters: []
          })
        );
        const res = await frappeJson(
          `/api/method/frappe.desk.search.search_link?doctype=${encodeURIComponent(doctype)}&txt=&page_length=200&query=&filters=[]&searchfield=${encodeURIComponent(
            fieldname
          )}&args=${args}`,
          {},
          req
        );
        const message = Array.isArray(res.payload?.message) ? res.payload.message : [];
        const options: string[] = Array.from(
          new Set(
            message
              .map((row: unknown) => {
                if (Array.isArray(row)) return asNonEmptyString(row[0]) || "";
                if (row && typeof row === "object") {
                  return asNonEmptyString((row as Record<string, unknown>).value) || asNonEmptyString((row as Record<string, unknown>).name) || "";
                }
                return "";
              })
              .map((value: string) => value.trim())
              .filter(Boolean)
          )
        );
        if (options.length) out.set(fieldname, options);
      } catch {
        // ignore
      }
    })
  );
  return out;
}

function backendSelectFallbackOptions(doctype: string, fieldname: string): string[] {
  const byDoctype: Record<string, Record<string, string[]>> = {
    Lead: {
      status: ["Open", "In Progress", "Interested", "Qualified", "Lost", "Converted"]
    },
    Deal: {
      deal_status: ["Qualification", "Discovery", "Demo / Making", "Proposal / Quotation", "Negotiation", "Ready to Close", "Won", "Lost"]
    },
    Organization: {
      status: ["Active", "Inactive"]
    },
    Contact: {
      status: ["Passive", "Open", "Replied"]
    },
    Task: {
      status: ["Open", "In Progress", "Completed", "Cancelled"],
      priority: ["Low", "Medium", "High"]
    },
    Note: {
      follow_up_when: ["Date", "Days from now", "None"],
      follow_up_task_type: ["Call", "Email", "Meeting", "WhatsApp", "Follow-up", "Task"]
    },
    Expense: {
      expense_scope: ["Deal", "Company"],
      status: ["Draft", "Approved", "Rejected"]
    },
    "Client Payment": {
      payment_type: ["Advance", "Checkpoint", "Partial", "Milestone", "Full Payment", "Refund", "Adjustment"],
      status: ["Expected", "Received", "Cleared", "Failed", "Refunded"]
    },
    Activity: {
      activity_type: ["Call", "Email", "Meeting", "WhatsApp", "Other"],
      status: ["Planned", "Completed", "Cancelled"]
    }
  };
  return byDoctype[doctype]?.[fieldname] || [];
}

function mergeOptionSets(...optionSets: Array<string[] | undefined>): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const set of optionSets) {
    for (const raw of set || []) {
      const value = String(raw || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      merged.push(value);
    }
  }
  return merged;
}

async function getFrappeCount(doctype: string, filters: unknown[], req: NextRequest): Promise<number> {
  const query = new URLSearchParams({ doctype });
  if (Array.isArray(filters) && filters.length) {
    query.set("filters", JSON.stringify(filters));
  }

  try {
    const res = await frappeJson(`/api/method/frappe.client.get_count?${query.toString()}`, {}, req);
    const count = Number(res.payload?.message ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

function relatedFieldsForEntity(entity: EntityKey): string[] {
  const primaryField = ENTITY_PRIMARY_FIELD[entity] || "name";
  const base = DEFAULT_LIST_FIELDS[entity] || ["name", primaryField, "status", "modified"];
  const selected = [primaryField, ...base.filter((field) => field !== "name"), "status", "modified"];
  return Array.from(new Set(["name", ...selected])).slice(0, 6);
}

function buildRelatedPrefill(sourceEntity: EntityKey, source: Record<string, unknown>, targetEntity: EntityKey) {
  const allowed = new Set(ENTITY_FIELD_ALLOWLIST[targetEntity] || []);
  const prefill: Record<string, string> = {};
  const sourceName = pickFirstString(source, ["name"]);
  const sourceProduct = pickFirstString(source, ["product__id", "product"]);
  const sourceOrganization = pickFirstString(source, ["organization__id", "organization"]);
  const sourceContact = pickFirstString(source, ["contact"]);
  const sourceLead = pickFirstString(source, ["lead"]);
  const sourceDeal = pickFirstString(source, ["deal__id", "deal"]);
  const sourceAssignedTo = pickFirstString(source, ["assigned_to__id", "assigned_to", "owner"]);
  const sourceUser = pickFirstString(source, ["user__id", "user", "assigned_to__id", "assigned_to", "owner"]);

  if (allowed.has("product")) {
    if (sourceEntity === "products" && sourceName) prefill.product = sourceName;
    else if (sourceProduct) prefill.product = sourceProduct;
  }

  if (allowed.has("assigned_to") && sourceAssignedTo) {
    prefill.assigned_to = sourceAssignedTo;
  }

  if (allowed.has("organization")) {
    if (sourceEntity === "organizations" && sourceName) prefill.organization = sourceName;
    else if (sourceOrganization) prefill.organization = sourceOrganization;
  }

  if (allowed.has("contact")) {
    if (sourceEntity === "contacts" && sourceName) prefill.contact = sourceName;
    else if (sourceContact) prefill.contact = sourceContact;
  }

  if (allowed.has("lead")) {
    if (sourceEntity === "leads" && sourceName) prefill.lead = sourceName;
    else if (sourceLead) prefill.lead = sourceLead;
  }

  if (allowed.has("deal")) {
    if (sourceEntity === "deals" && sourceName) prefill.deal = sourceName;
    else if (sourceDeal) prefill.deal = sourceDeal;
  }

  if (allowed.has("user") && sourceUser) {
    prefill.user = sourceUser;
  }

  if (targetEntity === "expenses" && allowed.has("expense_scope") && prefill.deal) {
    prefill.expense_scope = "Deal";
  }

  return prefill;
}

function buildRelatedCreateHref(sourceEntity: EntityKey, source: Record<string, unknown>, targetEntity: EntityKey): string {
  const prefill = buildRelatedPrefill(sourceEntity, source, targetEntity);
  const payload = Object.keys(prefill).length ? `?prefill=${encodeURIComponent(JSON.stringify(prefill))}` : "";
  return `/crm/${targetEntity}/new${payload}`;
}

function toRelatedRow(entity: EntityKey, row: Record<string, unknown>) {
  const normalized = normalizeRecord(row) as Record<string, unknown>;
  const primaryField = ENTITY_PRIMARY_FIELD[entity] || "name";
  const primaryValue = asNonEmptyString(normalized[primaryField]) || asNonEmptyString(normalized.name) || "-";
  const statusValue = asNonEmptyString(normalized.status);
  const modifiedValue = asNonEmptyString(normalized.modified);
  return {
    ...normalized,
    primary: primaryValue,
    status: statusValue || null,
    modified: modifiedValue || null
  };
}

function envelope<T>(data: T, meta: Record<string, unknown> = {}) {
  return { data, meta, error: null };
}

function errorEnvelope(message: string, code?: string) {
  return { data: null, meta: {}, error: { code, message } };
}

function getSetCookieValues(response: Response): string[] {
  const withGetSetCookie = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const combined = response.headers.get("set-cookie");
  if (!combined) return [];
  return combined
    .split(/,(?=\s*[^;=,\s]+=[^;,]+)/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function resolveProxyOrigin(req?: NextRequest): string {
  const requestOrigin = normalizeOrigin(req?.headers.get("origin"));
  if (requestOrigin) return requestOrigin;
  return NEXTJS_ORIGIN;
}

function parseServerMessages(payload: any): string | null {
  const raw = payload?._server_messages;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const first = parsed[0];
    if (typeof first !== "string") return null;
    const obj = JSON.parse(first);
    return typeof obj?.message === "string" ? obj.message : null;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: any, fallbackStatus: number): string {
  const serverMessage = parseServerMessages(payload);
  if (serverMessage) return serverMessage;

  const candidates = [payload?.exception, payload?.exc, payload?.message, payload?.error, payload?.error?.message];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return `API request failed (${fallbackStatus})`;
}

async function frappeFetch(path: string, init: RequestInit = {}, req?: NextRequest): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (req) {
    const cookie = req.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const csrfHeader = req.headers.get("x-csrf-token");
    if (csrfHeader && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", csrfHeader);
    }
  }

  const proxyOrigin = resolveProxyOrigin(req);
  if (!headers.has("origin")) headers.set("origin", proxyOrigin);
  if (!headers.has("referer")) headers.set("referer", `${proxyOrigin}/`);

  return fetch(`${FRAPPE_BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: "manual",
    cache: "no-store"
  });
}

async function frappeJson(path: string, init: RequestInit = {}, req?: NextRequest) {
  const response = await frappeFetch(path, init, req);
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.exc || payload?.exception) {
    throw new Error(extractErrorMessage(payload, response.status));
  }

  return { response, payload };
}

function normalizeRecord(row: Record<string, unknown>) {
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  const fallbackId = row?.id != null && row?.id !== "" ? String(row.id) : "";
  const canonicalId = name || fallbackId;
  const normalized: Record<string, unknown> = {
    id: canonicalId,
    record_id: canonicalId,
    ...row
  };
  const referenceType = asNonEmptyString(normalized.reference_type).toLowerCase();
  const referenceName = asNonEmptyString(normalized.reference_name);
  if (!asNonEmptyString(normalized.lead) && referenceType === "lead" && referenceName) {
    normalized.lead = referenceName;
  }
  return normalized;
}

async function hydrateProductNames(rows: Record<string, unknown>[], req: NextRequest): Promise<void> {
  try {
    const productIds = Array.from(
      new Set(
        rows
          .map((row) => asNonEmptyString(row.product))
          .filter((value): value is string => Boolean(value))
      )
    );
    if (!productIds.length) return;

    const byNameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "product_name", "product_code"]),
      filters: JSON.stringify([["name", "in", productIds]]),
      limit_start: "0",
      limit_page_length: String(Math.max(productIds.length, 1))
    });
    const byCodeQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "product_name", "product_code"]),
      filters: JSON.stringify([["product_code", "in", productIds]]),
      limit_start: "0",
      limit_page_length: String(Math.max(productIds.length, 1))
    });
    const [byNameRes, byCodeRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent("Product")}?${byNameQuery.toString()}`, {}, req).catch(() => ({ payload: { data: [] } })),
      frappeJson(`/api/resource/${encodeURIComponent("Product")}?${byCodeQuery.toString()}`, {}, req).catch(() => ({ payload: { data: [] } }))
    ]);
    const byNameRows = Array.isArray(byNameRes.payload?.data) ? byNameRes.payload.data : [];
    const byCodeRows = Array.isArray(byCodeRes.payload?.data) ? byCodeRes.payload.data : [];
    const mergedRows = [...byNameRows, ...byCodeRows];
    const productNameById = new Map<string, string>();
    for (const productRow of mergedRows) {
      const row = productRow as Record<string, unknown>;
      const productId = asNonEmptyString(row.name);
      const productCode = asNonEmptyString(row.product_code);
      const productName = asNonEmptyString(row.product_name) || productCode || productId;
      if (productId && productName) productNameById.set(productId, productName);
      if (productCode && productName) productNameById.set(productCode, productName);
    }

    for (const row of rows) {
      const productId = asNonEmptyString(row.product);
      if (!productId) continue;
      const productName = productNameById.get(productId);
      if (!productName) continue;
      
      row.product__id = productId;
      row.product = productName;
      // Also update common aliases to ensure UI finds it
      row.product_id = productId;
      row.product_name = productName;
    }
  } catch (error) {
    console.error("Failed to hydrate product names:", error);
  }
}

async function hydrateUserNames(rows: Record<string, unknown>[], req: NextRequest): Promise<void> {
  try {
    const userLinkedFields = ["assigned_to", "owner", "modified_by", "user", "borne_by", "comment_by", "changed_by"];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => userLinkedFields.map((field) => asNonEmptyString(row[field])))
          .filter((value): value is string => Boolean(value))
      )
    );
    if (!userIds.length) return;

    const baseQuery = {
      fields: JSON.stringify(["name", "full_name", "email", "username"]),
      limit_start: "0",
      limit_page_length: String(Math.max(userIds.length, 1))
    };
    const [byName, byEmail, byUsername] = await Promise.all([
      frappeJson(
        `/api/resource/${encodeURIComponent("User")}?${new URLSearchParams({
          ...baseQuery,
          filters: JSON.stringify([["name", "in", userIds]])
        }).toString()}`,
        {},
        req
      ).catch(() => ({ payload: { data: [] } })),
      frappeJson(
        `/api/resource/${encodeURIComponent("User")}?${new URLSearchParams({
          ...baseQuery,
          filters: JSON.stringify([["email", "in", userIds]])
        }).toString()}`,
        {},
        req
      ).catch(() => ({ payload: { data: [] } })),
      frappeJson(
        `/api/resource/${encodeURIComponent("User")}?${new URLSearchParams({
          ...baseQuery,
          filters: JSON.stringify([["username", "in", userIds]])
        }).toString()}`,
        {},
        req
      ).catch(() => ({ payload: { data: [] } }))
    ]);
    const userRows = [
      ...(Array.isArray(byName.payload?.data) ? byName.payload.data : []),
      ...(Array.isArray(byEmail.payload?.data) ? byEmail.payload.data : []),
      ...(Array.isArray(byUsername.payload?.data) ? byUsername.payload.data : [])
    ];
    const fullNameByIdentity = new Map<string, string>();
    const canonicalIdByIdentity = new Map<string, string>();
    for (const userRow of userRows) {
      const row = userRow as Record<string, unknown>;
      const userId = asNonEmptyString(row.name);
      const email = asNonEmptyString(row.email);
      const username = asNonEmptyString(row.username);
      const fullName = asNonEmptyString(row.full_name);
      if (!userId || !fullName) continue;
      for (const identity of [userId, email, username]) {
        if (!identity) continue;
        fullNameByIdentity.set(identity, fullName);
        canonicalIdByIdentity.set(identity, userId);
      }
    }

    for (const row of rows) {
      for (const field of userLinkedFields) {
        const userId = asNonEmptyString(row[field]);
        if (!userId) continue;
        const fullName = fullNameByIdentity.get(userId);
        if (!fullName) continue;
        row[`${field}__id`] = canonicalIdByIdentity.get(userId) || userId;
        row[field] = fullName;
      }
    }
  } catch (error) {
    console.error("Failed to hydrate user names:", error);
  }
}

async function hydrateOrganizationNames(rows: Record<string, unknown>[], req: NextRequest): Promise<void> {
  try {
    const orgLinkedFields = ["organization"];
    const organizationIds = Array.from(
      new Set(
        rows
          .flatMap((row) => orgLinkedFields.map((field) => asNonEmptyString(row[field])))
          .filter((value): value is string => Boolean(value))
      )
    );
    if (!organizationIds.length) return;

    const query = new URLSearchParams({
      fields: JSON.stringify(["name", "organization_name"]),
      filters: JSON.stringify([["name", "in", organizationIds]]),
      limit_start: "0",
      limit_page_length: String(Math.max(organizationIds.length, 1))
    });
    const res = await frappeJson(`/api/resource/${encodeURIComponent("Organization")}?${query.toString()}`, {}, req).catch(() => ({ payload: { data: [] } }));
    const orgRows = Array.isArray(res.payload?.data) ? res.payload.data : [];
    const orgNameById = new Map<string, string>();
    for (const orgRow of orgRows) {
      const orgId = asNonEmptyString((orgRow as Record<string, unknown>).name);
      const orgName = asNonEmptyString((orgRow as Record<string, unknown>).organization_name);
      if (orgId && orgName) orgNameById.set(orgId, orgName);
    }

    for (const row of rows) {
      for (const field of orgLinkedFields) {
        const orgId = asNonEmptyString(row[field]);
        if (!orgId) continue;
        const orgName = orgNameById.get(orgId);
        if (!orgName) continue;
        
        row[`${field}__id`] = orgId;
        row[field] = orgName;
        // Also update common aliases
        if (field === "organization") {
          row.organization_id = orgId;
          row.organization_name = orgName;
        }
      }
    }
  } catch (error) {
    console.error("Failed to hydrate organization names:", error);
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function toFrappeDatetime(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function toAppRoleLabels(frappeRoles: string[]) {
  const appRoles = new Set<string>();

  if (frappeRoles.some((role) => FRAPPE_BUSINESS_ADMIN_ROLES.has(role))) {
    appRoles.add(APP_ROLE_BUSINESS_ADMIN);
  }

  if (frappeRoles.some((role) => FRAPPE_BUSINESS_USER_ROLES.has(role))) {
    appRoles.add(APP_ROLE_BUSINESS_USER);
  }

  return Array.from(appRoles);
}

async function getUserContext(req: NextRequest): Promise<UserContext> {
  let whoami: { payload?: any };
  try {
    whoami = await frappeJson("/api/method/frappe.auth.get_logged_user", {}, req);
  } catch {
    throw new Error("Unauthorized");
  }
  const userId = String(whoami.payload?.message || "").trim();
  if (!userId || userId === "Guest") {
    throw new Error("Unauthorized");
  }

  let frappeRoles: string[] = [];
  try {
    const rolesPayload = await frappeJson(
      `/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(userId)}`,
      {},
      req
    );
    frappeRoles = normalizeStringArray(rolesPayload.payload?.message);
  } catch {
    frappeRoles = [];
  }

  const appRoles = toAppRoleLabels(frappeRoles);
  const fullNameRaw = req.cookies.get("full_name")?.value || "";
  const fullName = fullNameRaw ? decodeURIComponent(fullNameRaw) : userId;

  return {
    id: userId,
    email: userId,
    full_name: fullName,
    roles: [...appRoles, ...frappeRoles]
  };
}

function entityColumns(entity: EntityKey) {
  const auditColumns = [
    { fieldname: "creation", label: "Created Date" },
    { fieldname: "owner", label: "Created By" },
    { fieldname: "modified", label: "Modified Date" },
    { fieldname: "modified_by", label: "Modified By" }
  ];
  const columns: Record<EntityKey, { fieldname: string; label: string }[]> = {
    products: [
      { fieldname: "id", label: "ID" },
      { fieldname: "product_code", label: "Product Code" },
      { fieldname: "product_name", label: "Product Name" },
      { fieldname: "product_type", label: "Product Type" },
      { fieldname: "is_active", label: "Is Active" }
    ],
    "user-product-access": [
      { fieldname: "id", label: "ID" },
      { fieldname: "user", label: "User" },
      { fieldname: "product", label: "Product" },
      { fieldname: "role_in_product", label: "Role In Product" },
      { fieldname: "is_active", label: "Is Active" }
    ],
    leads: [
      { fieldname: "id", label: "ID" },
      { fieldname: "lead_name", label: "Lead Name" },
      { fieldname: "location", label: "Location" },
      { fieldname: "product", label: "Product" },
      { fieldname: "status", label: "Status" },
      { fieldname: "email", label: "Email" }
    ],
    deals: [
      { fieldname: "id", label: "ID" },
      { fieldname: "deal_title", label: "Deal Title" },
      { fieldname: "organization", label: "Organization" },
      { fieldname: "product", label: "Product" },
      { fieldname: "deal_status", label: "Status" },
      { fieldname: "probability", label: "Probability" },
      { fieldname: "deal_value", label: "Deal Value" },
      { fieldname: "total_payments_received", label: "Collection" },
      { fieldname: "to_collect", label: "To Collect" }
    ],
    contacts: [
      { fieldname: "id", label: "ID" },
      { fieldname: "full_name", label: "Full Name" },
      { fieldname: "email", label: "Email" },
      { fieldname: "mobile_no", label: "Mobile" }
    ],
    organizations: [
      { fieldname: "organization_name", label: "Organization Name" },
      { fieldname: "contact_name", label: "Contact Name" },
      { fieldname: "location", label: "Location" },
      { fieldname: "product", label: "Product" },
      { fieldname: "email", label: "Email" },
      { fieldname: "phone", label: "Phone" }
    ],
    tasks: [
      { fieldname: "id", label: "ID" },
      { fieldname: "title", label: "Title" },
      { fieldname: "product", label: "Product" },
      { fieldname: "status", label: "Status" },
      { fieldname: "priority", label: "Priority" }
    ],
    notes: [
      { fieldname: "id", label: "ID" },
      { fieldname: "title", label: "Title" },
      { fieldname: "product", label: "Product" },
      { fieldname: "note_content", label: "Content" }
    ],
    expenses: [
      { fieldname: "id", label: "ID" },
      { fieldname: "expense_title", label: "Title" },
      { fieldname: "product", label: "Product" },
      { fieldname: "borne_by", label: "Borne By" },
      { fieldname: "expense_scope", label: "Scope" },
      { fieldname: "amount", label: "Amount" }
    ],
    "client-payments": [
      { fieldname: "id", label: "ID" },
      { fieldname: "payment_type", label: "Payment Type" },
      { fieldname: "deal", label: "Deal" },
      { fieldname: "organization", label: "Organization" },
      { fieldname: "product", label: "Product" },
      { fieldname: "status", label: "Status" },
      { fieldname: "amount", label: "Amount" }
    ],
    "call-logs": [
      { fieldname: "id", label: "ID" },
      { fieldname: "subject", label: "Subject" },
      { fieldname: "product", label: "Product" },
      { fieldname: "status", label: "Status" }
    ]
  };
  const base = columns[entity] || [];
  return [...base, ...auditColumns];
}

type IncomingFilter = {
  field?: string;
  operator?: string;
  value?: unknown;
};

function normalizeFilterValue(operator: string, value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (operator === "in" || operator === "not in") {
    return text
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return text;
}

function buildFrappeFilters(filters: IncomingFilter[] | undefined): unknown[] {
  if (!Array.isArray(filters)) return [];
  const allowed = new Set(["=", "!=", ">", ">=", "<", "<=", "like", "in", "not in"]);
  return filters
    .filter((filter) => filter?.field && filter?.operator && allowed.has(String(filter.operator)))
    .map((filter) => [filter.field, filter.operator, normalizeFilterValue(String(filter.operator), filter.value)]);
}

function sanitizeSortField(input: unknown, allowedFields: string[]): string {
  const candidate = typeof input === "string" ? input.trim() : "";
  if (!candidate) return "modified";

  const safeExtras = new Set(["name", "modified", "creation", "owner"]);
  if (safeExtras.has(candidate) || allowedFields.includes(candidate)) return candidate;
  return "modified";
}

function buildEntityFilters(entity: EntityKey, inputFilters: IncomingFilter[] | undefined, searchText: string): unknown[] {
  const filters = buildFrappeFilters(inputFilters);
  const search = String(searchText || "").trim();
  if (!search) return filters;

  const primary = ENTITY_PRIMARY_FIELD[entity] || "name";
  filters.push([primary, "like", `%${search}%`]);
  return filters;
}

function asVersionChanges(rawData: unknown): Array<{ field: string; from_value: unknown; to_value: unknown }> {
  if (typeof rawData !== "string" || !rawData.trim()) return [];
  try {
    const parsed = JSON.parse(rawData) as Record<string, unknown>;
    const changed = Array.isArray(parsed.changed) ? parsed.changed : [];
    return changed
      .filter((item) => Array.isArray(item) && item.length >= 3)
      .map((item) => {
        const tuple = item as unknown[];
        return {
          field: String(tuple[0] || ""),
          from_value: tuple[1],
          to_value: tuple[2]
        };
      })
      .filter((item) => item.field);
  } catch {
    return [];
  }
}

async function handleEntityMeta(entityRaw: string, req: NextRequest) {
  await getUserContext(req);
  const entity = entityRaw as EntityKey;
  const doctype = ENTITY_TO_DOCTYPE[entity];
  if (!doctype) {
    return NextResponse.json(errorEnvelope("Unknown entity", "BAD_ENTITY"), { status: 400 });
  }

  const allowlist = ENTITY_FIELD_ALLOWLIST[entity] || [];
  const rawMetaFields = await fetchDoctypeMetaFields(doctype, req);
  const byFieldname = new Map<string, Record<string, unknown>>();
  for (const field of rawMetaFields) {
    const fieldname = asNonEmptyString((field as any)?.fieldname);
    if (!fieldname) continue;
    byFieldname.set(fieldname, field);
  }

  const baseFields = allowlist.map((fieldname) => {
    const raw = byFieldname.get(fieldname) || {};
    const fieldtype = asNonEmptyString((raw as any)?.fieldtype) || inferFieldtypeFromFieldname(fieldname);
    const linkDoctype =
      fieldtype === "Link" ? asNonEmptyString((raw as any)?.options) || inferLinkDoctypeFromFieldname(fieldname) : null;
    return {
      fieldname,
      label: asNonEmptyString((raw as any)?.label) || humanizeFieldname(fieldname),
      fieldtype,
      required: Boolean((raw as any)?.reqd),
      read_only: Boolean((raw as any)?.read_only),
      options: fieldtype === "Select" ? parseSelectOptions((raw as any)?.options) : [],
      link_doctype: linkDoctype
    };
  });
  const auditFieldDefinitions: Array<{ fieldname: string; label: string; fieldtype: string; link_doctype?: string }> = [
    { fieldname: "creation", label: "Created Date", fieldtype: "Datetime" },
    { fieldname: "owner", label: "Created By", fieldtype: "Link", link_doctype: "User" },
    { fieldname: "modified", label: "Modified Date", fieldtype: "Datetime" },
    { fieldname: "modified_by", label: "Modified By", fieldtype: "Link", link_doctype: "User" }
  ];
  const baseFieldNames = new Set(baseFields.map((field) => field.fieldname));
  for (const auditField of auditFieldDefinitions) {
    if (baseFieldNames.has(auditField.fieldname)) continue;
    baseFields.push({
      fieldname: auditField.fieldname,
      label: auditField.label,
      fieldtype: auditField.fieldtype,
      required: false,
      read_only: true,
      options: [],
      link_doctype: auditField.link_doctype || null
    });
  }

  const hiddenFieldtypes = new Set([
    "Section Break",
    "Column Break",
    "Tab Break",
    "Fold",
    "Heading",
    "HTML",
    "Button",
    "Table",
    "Table MultiSelect",
    "Read Only"
  ]);
  const excludedFieldnames = new Set([
    "name",
    "docstatus",
    "idx",
    "_user_tags",
    "_comments",
    "_assign",
    "_liked_by",
    "amended_from",
    "naming_series"
  ]);

  // Include additional editable runtime fields so create popup can show complete forms.
  const extraFields = rawMetaFields
    .map((raw) => {
      const fieldname = asNonEmptyString((raw as any)?.fieldname);
      const fieldtype = asNonEmptyString((raw as any)?.fieldtype) || "Data";
      if (!fieldname || excludedFieldnames.has(fieldname)) return null;
      if (allowlist.includes(fieldname)) return null;
      if (hiddenFieldtypes.has(fieldtype)) return null;
      if (Boolean((raw as any)?.read_only)) return null;
      if (Boolean((raw as any)?.hidden)) return null;
      if (fieldname.startsWith("_")) return null;
      const linkDoctype =
        fieldtype === "Link" ? asNonEmptyString((raw as any)?.options) || inferLinkDoctypeFromFieldname(fieldname) : null;
      return {
        fieldname,
        label: asNonEmptyString((raw as any)?.label) || humanizeFieldname(fieldname),
        fieldtype,
        required: Boolean((raw as any)?.reqd),
        read_only: Boolean((raw as any)?.read_only),
        options: fieldtype === "Select" ? parseSelectOptions((raw as any)?.options) : [],
        link_doctype: linkDoctype
      };
    })
    .filter((field): field is NonNullable<typeof field> => Boolean(field));

  const fields = [...baseFields, ...extraFields];

  // Merge canonical select options so partial backend meta does not hide valid choices.
  for (const field of fields) {
    if (field.fieldtype !== "Select") continue;
    const fallback = backendSelectFallbackOptions(doctype, field.fieldname);
    if (fallback.length) {
      field.options = mergeOptionSets(field.options, fallback);
    }
  }

  const missingSelectFieldnames = fields
    .filter((field) => field.fieldtype === "Select" && (!Array.isArray(field.options) || field.options.length === 0))
    .map((field) => field.fieldname);
  if (missingSelectFieldnames.length) {
    const [fromMeta, fromDocField, fromDoctypeLoad, fromSearchLink, fromRecords] = await Promise.all([
      fetchSelectOptionsFromMetaByFieldname(doctype, missingSelectFieldnames, req),
      fetchSelectOptionsByFieldname(doctype, missingSelectFieldnames, req),
      fetchSelectOptionsFromDoctypeLoadByFieldname(doctype, missingSelectFieldnames, req),
      fetchSelectOptionsViaSearchLinkByFieldname(doctype, missingSelectFieldnames, req),
      fetchSelectOptionsFromRecordsByFieldname(doctype, missingSelectFieldnames, req)
    ]);
    for (const field of fields) {
      if (field.fieldtype !== "Select") continue;
      if (Array.isArray(field.options) && field.options.length > 0) continue;
      field.options = mergeOptionSets(
        fromMeta.get(field.fieldname),
        fromDocField.get(field.fieldname),
        fromDoctypeLoad.get(field.fieldname),
        fromSearchLink.get(field.fieldname),
        fromRecords.get(field.fieldname),
        backendSelectFallbackOptions(doctype, field.fieldname)
      );
    }
  }

  return NextResponse.json(
    envelope({
      entity,
      doctype,
      fields
    })
  );
}

async function handleLinkOptions(req: NextRequest) {
  await getUserContext(req);
  const url = new URL(req.url);
  const doctype = asNonEmptyString(url.searchParams.get("doctype"));
  if (!doctype) {
    return NextResponse.json(errorEnvelope("Missing doctype", "VALIDATION_ERROR"), { status: 400 });
  }

  const q = asNonEmptyString(url.searchParams.get("q")) || "";
  const fieldname = asNonEmptyString(url.searchParams.get("fieldname")) || "";
  const requestedLimit = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;

  if (doctype === "Lead" && fieldname === "location") {
    const filters: unknown[] = [["location", "!=", ""]];
    if (q) filters.push(["location", "like", `%${q}%`]);
    const query = new URLSearchParams({
      fields: JSON.stringify(["location"]),
      filters: JSON.stringify(filters),
      order_by: "location asc",
      limit_start: "0",
      limit_page_length: "500"
    });
    const listRes = await frappeJson(`/api/resource/${encodeURIComponent("Lead")}?${query.toString()}`, {}, req);
    const rows = Array.isArray(listRes.payload?.data) ? listRes.payload.data : [];
    const seen = new Set<string>();
    const items = rows
      .map((row: Record<string, unknown>) => asNonEmptyString(row.location))
      .filter((value: string): value is string => Boolean(value))
      .map((value: string) => value.trim())
      .filter((value: string) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: string, b: string) => a.localeCompare(b))
      .slice(0, limit)
      .map((value: string) => ({ id: value, label: value }));
    return NextResponse.json(envelope({ items }));
  }

  let rows: Record<string, unknown>[] = [];
  if (doctype === "User") {
    const baseUserFilters: unknown[] = [
      ["enabled", "=", 1],
      ["user_type", "=", "System User"],
      ["name", "!=", "Guest"]
    ];
    const fullNameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "full_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "full_name asc"
    });
    const nameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "full_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "full_name asc"
    });
    if (q) {
      fullNameQuery.set("filters", JSON.stringify([...baseUserFilters, ["full_name", "like", `%${q}%`]]));
      nameQuery.set("filters", JSON.stringify([...baseUserFilters, ["name", "like", `%${q}%`]]));
    } else {
      fullNameQuery.set("filters", JSON.stringify(baseUserFilters));
      nameQuery.set("filters", JSON.stringify(baseUserFilters));
    }
    const [fullNameRes, nameRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${fullNameQuery.toString()}`, {}, req),
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${nameQuery.toString()}`, {}, req)
    ]);
    const fullNameRows = Array.isArray(fullNameRes.payload?.data) ? fullNameRes.payload.data : [];
    const nameRows = Array.isArray(nameRes.payload?.data) ? nameRes.payload.data : [];
    const merged = [...fullNameRows, ...nameRows];
    const seen = new Set<string>();
    rows = merged.filter((row) => {
      const id = asNonEmptyString((row as Record<string, unknown>).name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else if (doctype === "Product") {
    const productNameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "product_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "product_name asc"
    });
    const nameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "product_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "product_name asc"
    });
    if (q) {
      productNameQuery.set("filters", JSON.stringify([["product_name", "like", `%${q}%`]]));
      nameQuery.set("filters", JSON.stringify([["name", "like", `%${q}%`]]));
    }
    const [productNameRes, nameRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${productNameQuery.toString()}`, {}, req),
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${nameQuery.toString()}`, {}, req)
    ]);
    const productNameRows = Array.isArray(productNameRes.payload?.data) ? productNameRes.payload.data : [];
    const nameRows = Array.isArray(nameRes.payload?.data) ? nameRes.payload.data : [];
    const merged = [...productNameRows, ...nameRows];
    const seen = new Set<string>();
    rows = merged.filter((row) => {
      const id = asNonEmptyString((row as Record<string, unknown>).name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else if (doctype === "Organization") {
    const orgNameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "organization_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "organization_name asc"
    });
    const nameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "organization_name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "organization_name asc"
    });
    if (q) {
      orgNameQuery.set("filters", JSON.stringify([["organization_name", "like", `%${q}%`]]));
      nameQuery.set("filters", JSON.stringify([["name", "like", `%${q}%`]]));
    }
    const [orgNameRes, nameRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${orgNameQuery.toString()}`, {}, req),
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${nameQuery.toString()}`, {}, req)
    ]);
    const orgNameRows = Array.isArray(orgNameRes.payload?.data) ? orgNameRes.payload.data : [];
    const nameRows = Array.isArray(nameRes.payload?.data) ? nameRes.payload.data : [];
    const merged = [...orgNameRows, ...nameRows];
    const seen = new Set<string>();
    rows = merged.filter((row) => {
      const id = asNonEmptyString((row as Record<string, unknown>).name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else if (doctype === "Deal") {
    const dealTitleQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "deal_title"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "deal_title asc"
    });
    const nameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", "deal_title"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "deal_title asc"
    });
    if (q) {
      dealTitleQuery.set("filters", JSON.stringify([["deal_title", "like", `%${q}%`]]));
      nameQuery.set("filters", JSON.stringify([["name", "like", `%${q}%`]]));
    }
    const [dealTitleRes, nameRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${dealTitleQuery.toString()}`, {}, req),
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${nameQuery.toString()}`, {}, req)
    ]);
    const dealTitleRows = Array.isArray(dealTitleRes.payload?.data) ? dealTitleRes.payload.data : [];
    const nameRows = Array.isArray(nameRes.payload?.data) ? nameRes.payload.data : [];
    const merged = [...dealTitleRows, ...nameRows];
    const seen = new Set<string>();
    rows = merged.filter((row) => {
      const id = asNonEmptyString((row as Record<string, unknown>).name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else if (doctype === "Lead" || doctype === "Contact" || doctype === "Task" || doctype === "Note") {
    const displayFieldByDoctype: Record<string, string> = {
      Lead: "lead_name",
      Contact: "full_name",
      Task: "title",
      Note: "title"
    };
    const displayField = displayFieldByDoctype[doctype] || "name";
    const displayQuery = new URLSearchParams({
      fields: JSON.stringify(["name", displayField]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "modified desc"
    });
    const nameQuery = new URLSearchParams({
      fields: JSON.stringify(["name", displayField]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "modified desc"
    });
    if (q) {
      displayQuery.set("filters", JSON.stringify([[displayField, "like", `%${q}%`]]));
      nameQuery.set("filters", JSON.stringify([["name", "like", `%${q}%`]]));
    }
    const [displayRes, nameRes] = await Promise.all([
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${displayQuery.toString()}`, {}, req),
      frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${nameQuery.toString()}`, {}, req)
    ]);
    const displayRows = Array.isArray(displayRes.payload?.data) ? displayRes.payload.data : [];
    const nameRows = Array.isArray(nameRes.payload?.data) ? nameRes.payload.data : [];
    const merged = [...displayRows, ...nameRows];
    const seen = new Set<string>();
    rows = merged.filter((row) => {
      const id = asNonEmptyString((row as Record<string, unknown>).name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } else {
    const filters: unknown[] = [];
    if (q) {
      filters.push(["name", "like", `%${q}%`]);
    }

    const query = new URLSearchParams({
      fields: JSON.stringify(["name"]),
      limit_start: "0",
      limit_page_length: String(limit),
      order_by: "modified desc"
    });
    if (filters.length) query.set("filters", JSON.stringify(filters));

    const listRes = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
    rows = Array.isArray(listRes.payload?.data) ? listRes.payload.data : [];
  }

  const items = rows
    .map((row: Record<string, unknown>) => {
      const id = asNonEmptyString(row.name) || "";
      if (!id) return null;
      const label =
        doctype === "User"
          ? asNonEmptyString(row.full_name) || id
          : doctype === "Product"
            ? asNonEmptyString(row.product_name) || id
            : doctype === "Organization"
              ? asNonEmptyString(row.organization_name) || id
              : doctype === "Deal"
                ? asNonEmptyString(row.deal_title) || id
                : doctype === "Lead"
                  ? asNonEmptyString(row.lead_name) || id
                  : doctype === "Contact"
                    ? asNonEmptyString(row.full_name) || id
                    : doctype === "Task" || doctype === "Note"
                      ? asNonEmptyString(row.title) || id
                : id;
      return { id, label };
    })
    .filter((item): item is { id: string; label: string } => Boolean(item))
    .slice(0, limit);

  return NextResponse.json(envelope({ items }));
}

async function handleActivityLog(req: NextRequest) {
  await getUserContext(req);
  const url = new URL(req.url);
  const referenceDoctype = asNonEmptyString(url.searchParams.get("reference_doctype"));
  const referenceName = asNonEmptyString(url.searchParams.get("reference_name"));
  const requestedLimit = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200) : 50;

  if (!referenceDoctype || !referenceName) {
    return NextResponse.json(errorEnvelope("Missing reference_doctype or reference_name", "VALIDATION_ERROR"), { status: 400 });
  }

  const query = new URLSearchParams({
    fields: JSON.stringify(["name", "comment_by", "creation", "content"]),
    filters: JSON.stringify([
      ["reference_doctype", "=", referenceDoctype],
      ["reference_name", "=", referenceName]
    ]),
    order_by: "creation desc",
    limit_start: "0",
    limit_page_length: String(limit)
  });

  let commentRows: Record<string, unknown>[] = [];
  try {
    const commentsRes = await frappeJson(`/api/resource/${encodeURIComponent("Comment")}?${query.toString()}`, {}, req);
    commentRows = Array.isArray(commentsRes.payload?.data) ? commentsRes.payload.data : [];
  } catch {
    return NextResponse.json(envelope({ items: [] }));
  }

  const flattened = commentRows.flatMap((row: Record<string, unknown>) => {
    const content = asNonEmptyString(row.content);
    const parsed = parseAuditCommentMessage(content);
    if (!parsed) return [];
    return [
      {
        id: `${asNonEmptyString(row.name)}:${parsed.field}:${parsed.to_value}`,
        changed_at: asNonEmptyString(row.creation),
        changed_by: asNonEmptyString(row.comment_by),
        field: parsed.field,
        from_value: parsed.from_value,
        to_value: parsed.to_value
      }
    ];
  });

  await hydrateUserNames(flattened as unknown as Record<string, unknown>[], req);

  return NextResponse.json(envelope({ items: flattened }));
}

function parseAuditCommentMessage(content: string): { field: string; from_value: string; to_value: string } | null {
  const match = content.match(/^(.+?) changed:\s*(.+?)\s*->\s*(.+)$/);
  if (!match) return null;
  return {
    field: match[1].trim(),
    from_value: match[2].trim(),
    to_value: match[3].trim()
  };
}

async function queryRelatedRows(
  entity: EntityKey,
  filters: FrappeFilterTuple[],
  limit: number,
  req: NextRequest
): Promise<Record<string, unknown>[]> {
  if (!filters.length) return [];
  const doctype = ENTITY_TO_DOCTYPE[entity];
  const fields = relatedFieldsForEntity(entity);
  const query = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    order_by: "modified desc",
    limit_start: "0",
    limit_page_length: String(Math.max(1, limit))
  });

  const response = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
  const rows = Array.isArray(response.payload?.data) ? response.payload.data : [];
  await hydrateProductNames(rows, req);
  await hydrateUserNames(rows, req);
  await hydrateOrganizationNames(rows, req);
  return rows.map((row: Record<string, unknown>) => toRelatedRow(entity, row));
}

async function handleEntityRelated(path: string[], req: NextRequest) {
  await getUserContext(req);
  const sourceEntity = path[1] as EntityKey;
  const sourceId = path[2];
  const sourceDoctype = ENTITY_TO_DOCTYPE[sourceEntity];
  if (!sourceDoctype) {
    return NextResponse.json(errorEnvelope("Unknown entity", "BAD_ENTITY"), { status: 400 });
  }

  if (!sourceId) {
    return NextResponse.json(errorEnvelope("Missing record id", "VALIDATION_ERROR"), { status: 400 });
  }

  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit") || "5");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 20) : 5;

  const sourceRes = await frappeJson(
    `/api/resource/${encodeURIComponent(sourceDoctype)}/${encodeURIComponent(sourceId)}`,
    {},
    req
  );
  const sourceDoc = (sourceRes.payload?.data || {}) as Record<string, unknown>;
  const definitions = RELATED_CARD_DEFINITIONS[sourceEntity] || [];

  const cards = await Promise.all(
    definitions.map(async (definition) => {
      let rows: Record<string, unknown>[] = [];
      try {
        const primaryFilters = uniqueFilters(definition.buildPrimaryFilters(sourceDoc) || []);
        rows = await queryRelatedRows(definition.entity, primaryFilters, limit, req);

        if (!rows.length && definition.buildFallbackFilters) {
          const fallbackFilters = uniqueFilters(definition.buildFallbackFilters(sourceDoc) || []);
          rows = await queryRelatedRows(definition.entity, fallbackFilters, limit, req);
        }
      } catch {
        // Keep card visible with empty state + create action even when a specific related query fails.
        rows = [];
      }

      return {
        id: definition.id,
        title: definition.title,
        entity: definition.entity,
        create_href: buildRelatedCreateHref(sourceEntity, sourceDoc, definition.entity),
        rows
      };
    })
  );

  return NextResponse.json(
    envelope({
      entity: sourceEntity,
      id: sourceId,
      cards
    })
  );
}

async function resolveDefaultProduct(userId: string, req: NextRequest): Promise<string | null> {
  try {
    const upa = await frappeJson(
      `/api/resource/${encodeURIComponent("User Product Access")}?fields=${encodeURIComponent(
        JSON.stringify(["product"])
      )}&filters=${encodeURIComponent(JSON.stringify([["user", "=", userId], ["is_active", "=", 1]]))}&limit_page_length=1`,
      {},
      req
    );
    const linked = upa.payload?.data?.[0]?.product;
    if (typeof linked === "string" && linked.trim()) return linked;
  } catch {
    // fall through
  }

  const products = await frappeJson(
    `/api/resource/${encodeURIComponent("Product")}?fields=${encodeURIComponent(JSON.stringify(["name"]))}&filters=${encodeURIComponent(
      JSON.stringify([["is_active", "=", 1]])
    )}&limit_page_length=1`,
    {},
    req
  );

  const fallback = products.payload?.data?.[0]?.name;
  return typeof fallback === "string" && fallback.trim() ? fallback : null;
}

async function applyDealDerivedFields(
  doctype: string,
  doc: Record<string, unknown>,
  req: NextRequest
): Promise<Record<string, unknown>> {
  if (doctype === "Deal") {
    const organizationId = asNonEmptyString(doc.organization);
    if (organizationId) {
      try {
        const organizationRes = await frappeJson(
          `/api/resource/${encodeURIComponent("Organization")}/${encodeURIComponent(organizationId)}?fields=${encodeURIComponent(
            JSON.stringify(["name", "contact_name"])
          )}`,
          {},
          req
        );
        const organization = normalizeRecord((organizationRes.payload?.data || {}) as Record<string, unknown>);
        const orgContactName = asNonEmptyString(organization.contact_name);
        if (orgContactName) {
          doc.contact_name = orgContactName;
        }
      } catch {
        // Keep request resilient even if organization lookup fails.
      }
    }
  }

  const dealId = asNonEmptyString(doc.deal);
  if (!dealId) return doc;

  try {
    const dealRes = await frappeJson(
      `/api/resource/${encodeURIComponent("Deal")}/${encodeURIComponent(dealId)}?fields=${encodeURIComponent(
        JSON.stringify(["name", "organization", "product", "assigned_to"])
      )}`,
      {},
      req
    );
    const deal = normalizeRecord(dealRes.payload?.data) as Record<string, unknown>;
    const doctypeFields = new Set(
      (await fetchDoctypeMetaFields(doctype, req))
        .map((field) => asNonEmptyString((field as any)?.fieldname))
        .filter(Boolean)
    );
    const canSet = (fieldname: string) =>
      doctypeFields.has(fieldname) || Object.prototype.hasOwnProperty.call(doc, fieldname);

    const derivedOrganization = asNonEmptyString(deal.organization);
    const derivedProduct = asNonEmptyString(deal.product);
    const derivedAssignedTo = asNonEmptyString(deal.assigned_to);

    // Locked-derived behavior: deal is source of truth when present.
    if (canSet("organization") && derivedOrganization) doc.organization = derivedOrganization;
    if (canSet("product") && derivedProduct) doc.product = derivedProduct;
    if (canSet("assigned_to") && derivedAssignedTo) doc.assigned_to = derivedAssignedTo;
    if (doctype === "Expense" && canSet("expense_scope")) doc.expense_scope = "Deal";
  } catch {
    // Keep request resilient even if derivation lookup fails.
  }

  return doc;
}

async function enrichCreatePayload(
  doctype: string,
  payload: Record<string, unknown>,
  user: UserContext,
  req: NextRequest
): Promise<Record<string, unknown>> {
  const doc = await applyDealDerivedFields(doctype, { ...payload }, req);

  if (DOCTYPES_REQUIRING_ASSIGNED_TO.has(doctype)) {
    const requestedAssignee = asNonEmptyString(doc.assigned_to);
    if (!requestedAssignee) {
      doc.assigned_to = user.id;
    } else {
      try {
        await frappeJson(`/api/resource/${encodeURIComponent("User")}/${encodeURIComponent(requestedAssignee)}`, {}, req);
      } catch {
        doc.assigned_to = user.id;
      }
    }
  }

  if (DOCTYPES_REQUIRING_PRODUCT.has(doctype) && !doc.product) {
    const product = await resolveDefaultProduct(user.id, req);
    if (!product) {
      throw new Error(`No Product available for ${doctype}. Please create/assign a Product first.`);
    }
    doc.product = product;
  }

  if (doctype === "Lead" && !doc.status) doc.status = "Open";
  if (doctype === "Deal" && !doc.deal_status) doc.deal_status = "Qualification";
  if (doctype === "Task") {
    if (!doc.status) doc.status = "Open";
    if (!doc.priority) doc.priority = "Medium";
  }
  if (doctype === "Activity") {
    if (!doc.status) doc.status = "Planned";
    const normalizedActivityDate = toFrappeDatetime(doc.activity_date);
    if (normalizedActivityDate) {
      doc.activity_date = normalizedActivityDate;
    } else {
      doc.activity_date = toFrappeDatetime(new Date());
    }
  }
  if (doctype === "Expense") {
    if (!doc.expense_scope) doc.expense_scope = "Company";
    if (!doc.status) doc.status = "Draft";
  }
  if (doctype === "Client Payment") {
    if (!doc.payment_type) doc.payment_type = "Partial";
    if (!doc.status) doc.status = "Expected";
  }
  if (doctype === "Organization" && !doc.status) {
    doc.status = "Active";
  }
  if (doctype === "Comment") {
    doc.comment_by = user.full_name;
    doc.comment_email = user.id;
  }

  return doc;
}

async function ensureUserProductAccess(userId: string, productId: string, req: NextRequest): Promise<void> {
  if (!userId || !productId) return;
  const query = new URLSearchParams({
    fields: JSON.stringify(["name"]),
    filters: JSON.stringify([
      ["user", "=", userId],
      ["product", "=", productId],
      ["is_active", "=", 1]
    ]),
    limit_page_length: "1"
  });
  const existing = await frappeJson(`/api/resource/${encodeURIComponent("User Product Access")}?${query.toString()}`, {}, req);
  const existingRows = Array.isArray(existing.payload?.data) ? existing.payload.data : [];
  if (existingRows.length) return;

  await frappeJson(
    `/api/resource/${encodeURIComponent("User Product Access")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: userId,
        product: productId,
        is_active: 1,
        role_in_product: "Member"
      })
    },
    req
  );
}

async function enrichUpdatePayload(doctype: string, payload: Record<string, unknown>, req: NextRequest): Promise<Record<string, unknown>> {
  const doc = await applyDealDerivedFields(doctype, { ...payload }, req);
  const blockedUpdateFields = new Set([
    "name",
    "id",
    "creation",
    "owner",
    "modified",
    "modified_by",
    "docstatus",
    "idx"
  ]);
  for (const key of Object.keys(doc)) {
    if (blockedUpdateFields.has(key) || key.startsWith("_")) {
      delete doc[key];
    }
  }

  if (doctype === "Deal" && Object.prototype.hasOwnProperty.call(doc, "deal_value") && !doc.deal_value_change_reason) {
    doc.deal_value_change_reason = "Updated via Next.js";
  }

  if (doctype === "Deal") {
    const assignedTo = asNonEmptyString(doc.assigned_to);
    const product = asNonEmptyString(doc.product);
    if (assignedTo && product) {
      try {
        await ensureUserProductAccess(assignedTo, product, req);
      } catch {
        // Do not block deal save when access bootstrap fails.
      }
    }
  }

  return doc;
}

function mapUiRoleToFrappeRole(input: string): string {
  const normalized = String(input || "").trim().toUpperCase();
  if (normalized === APP_ROLE_BUSINESS_ADMIN) return "Business Admin";
  if (normalized === APP_ROLE_BUSINESS_USER) return "Business User";
  return input;
}

async function readUserRoles(userId: string, req: NextRequest): Promise<string[]> {
  try {
    const roles = await frappeJson(
      `/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(userId)}`,
      {},
      req
    );
    const frappeRoles = normalizeStringArray(roles.payload?.message);
    return toAppRoleLabels(frappeRoles);
  } catch {
    return [];
  }
}

function toUserRow(doc: Record<string, unknown>, roles: string[]) {
  const id = String(doc.email || doc.username || doc.name || "");
  const activeRaw = doc.is_active ?? doc.enabled;
  const isActive =
    activeRaw === true ||
    activeRaw === 1 ||
    activeRaw === "1" ||
    String(activeRaw).toLowerCase() === "true";
  return {
    id,
    email: String(doc.email || id),
    full_name: String(doc.full_name || id),
    is_active: isActive,
    roles
  };
}

async function listUsers(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(Number(url.searchParams.get("limit") || "50"), 1);
  const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);
  const emailFilter = (url.searchParams.get("email") || "").trim();
  const roleFilter = (url.searchParams.get("role") || "").trim().toUpperCase();
  const isActiveRaw = (url.searchParams.get("is_active") || "").trim().toLowerCase();

  const filters: unknown[] = [];
  if (emailFilter) {
    filters.push(["email", "like", `%${emailFilter}%`]);
  }
  if (isActiveRaw === "true" || isActiveRaw === "false") {
    filters.push(["is_active", "=", isActiveRaw === "true" ? 1 : 0]);
  }

  const query = new URLSearchParams({
    fields: JSON.stringify(DEFAULT_LIST_FIELDS.users),
    limit_page_length: String(limit),
    limit_start: String(offset),
    order_by: "modified desc"
  });
  if (filters.length) {
    query.set("filters", JSON.stringify(filters));
  }

  const users = await frappeJson(`/api/resource/${encodeURIComponent("User")}?${query.toString()}`, {}, req);
  const records = Array.isArray(users.payload?.data) ? users.payload.data : [];

  const rows = await Promise.all(
    records.map(async (doc: Record<string, unknown>) => {
      const userId = String(doc.name || "");
      const roles = await readUserRoles(userId, req);
      return toUserRow(doc, roles);
    })
  );

  const filtered = roleFilter
    ? rows.filter((row) => row.roles.includes(roleFilter === APP_ROLE_BUSINESS_ADMIN ? APP_ROLE_BUSINESS_ADMIN : APP_ROLE_BUSINESS_USER))
    : rows;

  return NextResponse.json(envelope({ items: filtered }));
}

async function readUser(id: string, req: NextRequest) {
  const user = await frappeJson(`/api/resource/${encodeURIComponent("User")}/${encodeURIComponent(id)}`, {}, req);
  const roles = await readUserRoles(id, req);
  return NextResponse.json(envelope(toUserRow(user.payload?.data || {}, roles)));
}

async function createUser(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || body.name || "").trim();

  if (!email) {
    return NextResponse.json(errorEnvelope("Email is required", "VALIDATION_ERROR"), { status: 400 });
  }

  const requestedRoles = normalizeStringArray(body.roles).map(mapUiRoleToFrappeRole);
  const normalizedRoles = requestedRoles.length ? requestedRoles : ["Business User"];

  const payload: Record<string, unknown> = {
    email,
    username: email,
    full_name: fullName || email.split("@")[0],
    role: normalizedRoles[0] || "Business User",
    is_active: body.is_active === false ? 0 : 1,
  };

  const temporaryPassword = String(body.temporary_password || body.new_password || "").trim();
  if (temporaryPassword) {
    payload.password = temporaryPassword;
  }

  const created = await frappeJson(`/api/resource/${encodeURIComponent("User")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, req);

  const createdId = String(created.payload?.data?.name || email);
  return readUser(createdId, req);
}

async function updateUser(id: string, req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  if (typeof body.email === "string" && body.email.trim()) {
    payload.email = body.email.trim().toLowerCase();
  }

  if (typeof body.full_name === "string" && body.full_name.trim()) {
    const [firstName, ...rest] = body.full_name.trim().split(" ").filter(Boolean);
    payload.first_name = firstName || body.full_name.trim();
    payload.last_name = rest.join(" ");
  }

  if (typeof body.is_active === "boolean") {
    payload.is_active = body.is_active ? 1 : 0;
  }

  const newPassword = String(body.temporary_password || body.new_password || "").trim();
  if (newPassword) {
    payload.new_password = newPassword;
  }

  if (Array.isArray(body.roles)) {
    const normalizedRoles = normalizeStringArray(body.roles).map(mapUiRoleToFrappeRole);
    if (normalizedRoles.length) {
      payload.role = normalizedRoles[0];
    }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(errorEnvelope("No changes supplied", "VALIDATION_ERROR"), { status: 400 });
  }

  await frappeJson(
    `/api/resource/${encodeURIComponent("User")}/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    },
    req
  );

  return readUser(id, req);
}

async function deleteResource(doctype: string, id: string, req: NextRequest) {
  const upstream = await frappeFetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`, { method: "DELETE" }, req);
  let payload: any = null;
  try {
    payload = await upstream.json();
  } catch {
    payload = null;
  }

  if (!upstream.ok || payload?.exc || payload?.exception) {
    const message = extractErrorMessage(payload, upstream.status);
    return NextResponse.json(errorEnvelope(message, "DELETE_FAILED"), { status: upstream.status || 500 });
  }

  return NextResponse.json(envelope({ ok: true, id }));
}

async function handleAuth(path: string[], req: NextRequest) {
  const action = path[1];

  if (action === "login" && req.method === "POST") {
    const { email, password } = await req.json();
    const body = new URLSearchParams({ usr: String(email || ""), pwd: String(password || "") }).toString();

    const upstream = await frappeFetch("/api/method/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    let payload: any = null;
    try {
      payload = await upstream.json();
    } catch {
      payload = null;
    }

    if (!upstream.ok || payload?.exc || payload?.exception) {
      const message = extractErrorMessage(payload, upstream.status) || "Invalid credentials";
      const status = upstream.status === 403 ? 403 : 401;
      return NextResponse.json(errorEnvelope(message, "AUTH_INVALID"), { status });
    }

    const response = NextResponse.json(
      envelope({
        id: String(email || ""),
        email: String(email || ""),
        full_name: payload?.full_name || String(email || ""),
        roles: []
      })
    );

    const setCookieValues = getSetCookieValues(upstream);
    for (const setCookie of setCookieValues) {
      response.headers.append("set-cookie", setCookie);
    }

    if (setCookieValues.length === 0) {
      const accessCookieName = process.env.ACCESS_COOKIE_NAME || "crm_access_token";
      response.headers.append("set-cookie", `${accessCookieName}=1; Path=/; HttpOnly; SameSite=Lax`);
    }

    response.headers.append(
      "set-cookie",
      `full_name=${encodeURIComponent(payload?.full_name || String(email || ""))}; Path=/; SameSite=Lax`
    );

    return response;
  }

  if (action === "logout" && req.method === "POST") {
    const response = NextResponse.json(envelope({ ok: true }));

    const upstream = await frappeFetch("/api/method/logout", { method: "GET" }, req);
    for (const setCookie of getSetCookieValues(upstream)) {
      response.headers.append("set-cookie", setCookie);
    }

    const accessCookieName = process.env.ACCESS_COOKIE_NAME || "crm_access_token";
    response.headers.append("set-cookie", `${accessCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    response.headers.append("set-cookie", `full_name=; Path=/; SameSite=Lax; Max-Age=0`);

    return response;
  }

  if (action === "me" && req.method === "GET") {
    const user = await getUserContext(req);
    return NextResponse.json(envelope(user));
  }

  if (action === "refresh" && req.method === "POST") {
    const user = await getUserContext(req);
    return NextResponse.json(envelope({ ok: Boolean(user.id) }));
  }

  if (action === "dev-seed" && req.method === "POST") {
    // Kept for backward compatibility; intentionally no-op in backend-linked mode.
    return NextResponse.json(envelope({ ok: true }));
  }

  return NextResponse.json(errorEnvelope("Not found", "NOT_FOUND"), { status: 404 });
}

async function handleShell(path: string[], req: NextRequest) {
  if (path[1] === "boot" && req.method === "GET") {
    const user = await getUserContext(req);
    return NextResponse.json(
      envelope({
        user_profile: { id: user.id, email: user.email, full_name: user.full_name },
        sidebar_items: NAV_ITEMS,
        roles: user.roles
      })
    );
  }

  if (path[1] === "entities" && path[3] === "list" && req.method === "POST") {
    await getUserContext(req);
    const entity = path[2] as EntityKey;
    const doctype = ENTITY_TO_DOCTYPE[entity];
    if (!doctype) return NextResponse.json(errorEnvelope("Unknown entity", "BAD_ENTITY"), { status: 400 });

    const body = await req.json().catch(() => ({}));
    const page = Math.max(Number(body?.page || 1), 1);
    const pageSize = clampPageSize(body?.page_size || body?.page_length || 20);
    const start = (page - 1) * pageSize;
    const cols = entityColumns(entity);
    const fields = Array.from(new Set(["name", "modified", ...cols.map((c) => c.fieldname).filter((f) => f !== "id")]));
    const filters = buildEntityFilters(entity, body?.filters, body?.search);
    const sortField = sanitizeSortField(body?.sort?.field, fields);
    const sortOrder = String(body?.sort?.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const query = new URLSearchParams({
      fields: JSON.stringify(fields),
      limit_start: String(start),
      limit_page_length: String(pageSize),
      order_by: `${sortField} ${sortOrder}`
    });

    if (filters.length) {
      query.set("filters", JSON.stringify(filters));
    }

    const listRes = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
    const rows: Record<string, unknown>[] = (Array.isArray(listRes.payload?.data) ? listRes.payload.data : []).map((row: Record<string, unknown>) =>
      normalizeRecord(row)
    );
    await hydrateProductNames(rows, req);
    await hydrateUserNames(rows, req);
    await hydrateOrganizationNames(rows, req);
    if (entity === "deals" && rows.length) {
      const organizationIds = Array.from(
        new Set(
          rows
            .map((row) => asNonEmptyString(row.organization))
            .filter((value): value is string => Boolean(value))
        )
      );
      if (organizationIds.length) {
        const orgQuery = new URLSearchParams({
          fields: JSON.stringify(["name", "organization_name"]),
          filters: JSON.stringify([["name", "in", organizationIds]]),
          limit_start: "0",
          limit_page_length: String(Math.max(organizationIds.length, 1))
        });
        const orgRes = await frappeJson(`/api/resource/${encodeURIComponent("Organization")}?${orgQuery.toString()}`, {}, req);
        const orgRows = Array.isArray(orgRes.payload?.data) ? orgRes.payload.data : [];
        const orgNameById = new Map<string, string>();
        for (const orgRow of orgRows) {
          const orgId = asNonEmptyString((orgRow as Record<string, unknown>).name);
          const orgName = asNonEmptyString((orgRow as Record<string, unknown>).organization_name);
          if (orgId && orgName) orgNameById.set(orgId, orgName);
        }
        for (const row of rows) {
          const orgId = asNonEmptyString(row.organization);
          if (!orgId) continue;
          row.organization__id = orgId;
          const label = orgNameById.get(orgId);
          if (label) row.organization = label;
        }
      }
    }
    const total = await getFrappeCount(doctype, filters, req);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return NextResponse.json(
      envelope({
        label: doctype,
        columns: cols,
        rows,
        pagination: { page, page_size: pageSize, total, total_pages: totalPages }
      })
    );
  }

  if (path[1] === "entities" && path[3] === "cards" && req.method === "POST") {
    await getUserContext(req);
    const entity = path[2] as EntityKey;
    const doctype = ENTITY_TO_DOCTYPE[entity];
    if (!doctype) return NextResponse.json(errorEnvelope("Unknown entity", "BAD_ENTITY"), { status: 400 });

    return NextResponse.json(
      envelope({
        cards: [],
        deprecation_notice: "Entity cards are dashboard-only. This endpoint is kept for compatibility."
      })
    );
  }

  return NextResponse.json(errorEnvelope("Not found", "NOT_FOUND"), { status: 404 });
}

type DashboardPreset = "today" | "week" | "month" | "quarter";

function parseDashboardPreset(value: unknown): DashboardPreset {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "today" || raw === "week" || raw === "month" || raw === "quarter") {
    return raw;
  }
  return "month";
}

function toStartOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function resolveDashboardWindow(preset: DashboardPreset): { start: Date; end: Date } {
  const end = new Date();
  const start = toStartOfDay(end);
  if (preset === "today") {
    return { start, end };
  }
  if (preset === "week") {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (preset === "month") {
    start.setDate(start.getDate() - 29);
    return { start, end };
  }
  start.setDate(start.getDate() - 89);
  return { start, end };
}

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isWithinWindow(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

function formatShortMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function formatShortDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHourLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getBucketKeyFromDate(date: Date, preset: DashboardPreset, start: Date): string {
  if (preset === "today") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}`;
  }
  if (preset === "week") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  if (preset === "month") {
    const startDay = toStartOfDay(start).getTime();
    const currentDay = toStartOfDay(date).getTime();
    const diffDays = Math.max(0, Math.floor((currentDay - startDay) / 86400000));
    return `week-${Math.floor(diffDays / 7) + 1}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildDashboardBuckets(preset: DashboardPreset, start: Date, end: Date): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];

  if (preset === "today") {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = getBucketKeyFromDate(cursor, preset, start);
      buckets.push({ key, label: formatHourLabel(cursor) });
      cursor.setHours(cursor.getHours() + 1);
    }
    return buckets;
  }

  if (preset === "week") {
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = getBucketKeyFromDate(cursor, preset, start);
      buckets.push({ key, label: formatShortDay(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  if (preset === "month") {
    const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000 / 7) + 1);
    for (let index = 1; index <= totalWeeks; index += 1) {
      buckets.push({ key: `week-${index}`, label: `W${index}` });
    }
    return buckets;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: formatShortMonth(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isWonDealStatus(status: string): boolean {
  return status.includes("won");
}

function isClosedDealStatus(status: string): boolean {
  return status.includes("won") || status.includes("lost") || status.includes("closed");
}

function isOpenPipelineStatus(status: string): boolean {
  if (!status) return true;
  return !status.includes("won") && !status.includes("lost") && !status.includes("closed") && !status.includes("cancel");
}

function isTaskCompletedStatus(status: string): boolean {
  return status.includes("done") || status.includes("completed") || status.includes("closed");
}

function isTaskOpenStatus(status: string): boolean {
  if (!status) return true;
  return !isTaskCompletedStatus(status) && !status.includes("cancel");
}

function isCollectedPaymentStatus(status: string): boolean {
  if (!status) return true;
  return (
    status.includes("received") ||
    status.includes("paid") ||
    status.includes("completed") ||
    status.includes("collected") ||
    status.includes("posted")
  );
}

function isIncludedExpenseStatus(status: string): boolean {
  if (!status) return true;
  return !status.includes("cancel") && !status.includes("reject");
}

function resolveDateField(row: Record<string, unknown>, candidates: string[]): Date | null {
  for (const candidate of candidates) {
    const parsed = parseDate(row[candidate]);
    if (parsed) return parsed;
  }
  return null;
}

async function fetchDashboardRows(
  doctype: string,
  fields: string[],
  start: Date,
  req: NextRequest
): Promise<Record<string, unknown>[]> {
  const filters = [["creation", ">=", `${start.toISOString().slice(0, 10)} 00:00:00`]];
  const query = new URLSearchParams({
    fields: JSON.stringify(Array.from(new Set(["name", ...fields]))),
    filters: JSON.stringify(filters),
    limit_page_length: "1000",
    order_by: "creation asc"
  });
  const response = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
  return Array.isArray(response.payload?.data) ? response.payload.data : [];
}

async function handleDashboard(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.json(errorEnvelope("Method not allowed"), { status: 405 });
  await getUserContext(req);

  const body = await req.json().catch(() => ({}));
  const preset = parseDashboardPreset(body?.date_preset);
  const { start, end } = resolveDashboardWindow(preset);
  const buckets = buildDashboardBuckets(preset, start, end);
  const defaultByBucket = Object.fromEntries(buckets.map((bucket) => [bucket.key, 0])) as Record<string, number>;

  const [leads, deals, tasks, payments, expenses] = await Promise.all([
    fetchDashboardRows("Lead", ["creation", "status"], start, req),
    fetchDashboardRows("Deal", ["creation", "deal_status", "deal_value"], start, req),
    fetchDashboardRows("Task", ["creation", "status", "due_date"], start, req),
    fetchDashboardRows("Client Payment", ["creation", "payment_date", "status", "amount"], start, req),
    fetchDashboardRows("Expense", ["creation", "expense_date", "status", "amount"], start, req)
  ]);

  const leadTrend = { ...defaultByBucket };
  const wonTrend = { ...defaultByBucket };
  const collectionsTrend = { ...defaultByBucket };
  const expenseTrend = { ...defaultByBucket };

  const stageDistribution = new Map<string, { count: number; value: number }>();

  for (const row of leads) {
    const created = resolveDateField(row, ["creation"]);
    if (!created) continue;
    if (!isWithinWindow(created, start, end)) continue;
    const key = getBucketKeyFromDate(created, preset, start);
    if (Object.prototype.hasOwnProperty.call(leadTrend, key)) {
      leadTrend[key] += 1;
    }
  }

  let wonDeals = 0;
  let closedDeals = 0;
  let openPipelineValue = 0;
  for (const row of deals) {
    const created = resolveDateField(row, ["creation"]);
    if (!created) continue;
    if (!isWithinWindow(created, start, end)) continue;
    const status = normalizeStatus(row.deal_status);
    const value = asNumber(row.deal_value);
    const key = getBucketKeyFromDate(created, preset, start);

    if (isWonDealStatus(status) && Object.prototype.hasOwnProperty.call(wonTrend, key)) {
      wonTrend[key] += 1;
      wonDeals += 1;
    }
    if (isClosedDealStatus(status)) {
      closedDeals += 1;
    }
    if (isOpenPipelineStatus(status)) {
      openPipelineValue += value;
    }

    const stageLabel = asString(row.deal_status) || "Unspecified";
    const existing = stageDistribution.get(stageLabel) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += value;
    stageDistribution.set(stageLabel, existing);
  }

  const todayStart = toStartOfDay(end);
  let taskOpen = 0;
  let taskCompleted = 0;
  let taskOverdue = 0;
  for (const row of tasks) {
    const created = resolveDateField(row, ["creation"]);
    if (!created) continue;
    if (!isWithinWindow(created, start, end)) continue;
    const status = normalizeStatus(row.status);
    const dueDate = resolveDateField(row, ["due_date"]);
    if (isTaskCompletedStatus(status)) {
      taskCompleted += 1;
      continue;
    }
    if (isTaskOpenStatus(status)) {
      taskOpen += 1;
      if (dueDate && dueDate < todayStart) {
        taskOverdue += 1;
      }
    }
  }

  let collectedAmount = 0;
  for (const row of payments) {
    const paymentDate = resolveDateField(row, ["payment_date", "creation"]);
    if (!paymentDate) continue;
    if (!isWithinWindow(paymentDate, start, end)) continue;
    const status = normalizeStatus(row.status);
    if (!isCollectedPaymentStatus(status)) continue;
    const amount = asNumber(row.amount);
    const key = getBucketKeyFromDate(paymentDate, preset, start);
    if (Object.prototype.hasOwnProperty.call(collectionsTrend, key)) {
      collectionsTrend[key] += amount;
    }
    collectedAmount += amount;
  }

  let expenseAmount = 0;
  for (const row of expenses) {
    const expenseDate = resolveDateField(row, ["expense_date", "creation"]);
    if (!expenseDate) continue;
    if (!isWithinWindow(expenseDate, start, end)) continue;
    const status = normalizeStatus(row.status);
    if (!isIncludedExpenseStatus(status)) continue;
    const amount = asNumber(row.amount);
    const key = getBucketKeyFromDate(expenseDate, preset, start);
    if (Object.prototype.hasOwnProperty.call(expenseTrend, key)) {
      expenseTrend[key] += amount;
    }
    expenseAmount += amount;
  }

  const dealCount = deals.length;
  const leadCount = leads.length;
  const taskCount = tasks.length;
  const leadToDealRate = leadCount > 0 ? (dealCount / leadCount) * 100 : 0;
  const winRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;
  const netCollections = collectedAmount - expenseAmount;

  return NextResponse.json(
    envelope({
      kpis: {
        total_leads: leadCount,
        total_deals: dealCount,
        total_tasks: taskCount,
        open_pipeline_value: openPipelineValue,
        net_collections: netCollections
      },
      charts: {
        lead_vs_won_trend: buckets.map((bucket) => ({
          label: bucket.label,
          leads: leadTrend[bucket.key] || 0,
          won_deals: wonTrend[bucket.key] || 0
        })),
        deal_stage_distribution: Array.from(stageDistribution.entries())
          .map(([stage, values]) => ({ stage, count: values.count, value: values.value }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        collections_vs_expenses_trend: buckets.map((bucket) => ({
          label: bucket.label,
          collections: collectionsTrend[bucket.key] || 0,
          expenses: expenseTrend[bucket.key] || 0
        }))
      },
      insights: {
        conversion: {
          lead_to_deal_rate: leadToDealRate,
          win_rate: winRate,
          won_deals: wonDeals,
          closed_deals: closedDeals
        },
        task_health: {
          open: taskOpen,
          overdue: taskOverdue,
          completed: taskCompleted
        },
        pipeline_cashflow: {
          open_pipeline_value: openPipelineValue,
          collected_amount: collectedAmount,
          expense_amount: expenseAmount,
          net_collections: netCollections
        }
      }
    })
  );
}

function resourcePathFromEndpoint(endpoint: string): string {
  const map: Record<string, string> = {
    leads: "Lead",
    deals: "Deal",
    contacts: "Contact",
    organizations: "Organization",
    tasks: "Task",
    notes: "Note",
    expenses: "Expense",
    "client-payments": "Client Payment",
    "user-product-access": "User Product Access",
    activities: "Activity",
    "call-logs": "Activity",
    products: "Product",
    comments: "Comment",
    users: "User"
  };
  return map[endpoint] || endpoint;
}

async function handleResource(path: string[], req: NextRequest) {
  const user = await getUserContext(req);
  const endpoint = path[0];
  const id = path[1];
  const doctype = resourcePathFromEndpoint(endpoint);
  if (!doctype) return NextResponse.json(errorEnvelope("Unknown resource", "BAD_RESOURCE"), { status: 400 });

  if (doctype === "User") {
    if (req.method === "GET" && !id) return listUsers(req);
    if (req.method === "GET" && id) return readUser(id, req);
    if (req.method === "POST" && !id) return createUser(req);
    if (req.method === "PATCH" && id) return updateUser(id, req);
    if (req.method === "DELETE" && id) return deleteResource(doctype, id, req);
    return NextResponse.json(errorEnvelope("Method not allowed"), { status: 405 });
  }

  if (req.method === "GET" && !id) {
    const url = new URL(req.url);
    const limit = Math.max(Number(url.searchParams.get("limit") || "20"), 1);
    const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);
    const requestedFields = url.searchParams.get("fields");
    const requestedFilters = url.searchParams.get("filters");
    const requestedOrderBy = url.searchParams.get("order_by");
    const fields = requestedFields
      ? (() => {
          try {
            const parsed = JSON.parse(requestedFields);
            return Array.isArray(parsed) ? parsed.map((v) => String(v)) : DEFAULT_LIST_FIELDS[endpoint] || ["name", "modified"];
          } catch {
            return DEFAULT_LIST_FIELDS[endpoint] || ["name", "modified"];
          }
        })()
      : DEFAULT_LIST_FIELDS[endpoint] || ["name", "modified"];

    const query = new URLSearchParams({
      fields: JSON.stringify(Array.from(new Set(["name", ...fields]))),
      limit_page_length: String(limit),
      limit_start: String(offset),
      order_by: requestedOrderBy || "modified desc"
    });
    if (requestedFilters) query.set("filters", requestedFilters);

    const res = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`, {}, req);
    const rows = (Array.isArray(res.payload?.data) ? res.payload.data : []).map((row: Record<string, unknown>) => normalizeRecord(row));
    await hydrateProductNames(rows, req);
    await hydrateUserNames(rows, req);
    await hydrateOrganizationNames(rows, req);
    return NextResponse.json(envelope({ items: rows }));
  }

  if (req.method === "GET" && id) {
    const res = await frappeJson(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`, {}, req);
    const record = normalizeRecord(res.payload?.data || {});
    await hydrateProductNames([record], req);
    await hydrateUserNames([record], req);
    await hydrateOrganizationNames([record], req);
    return NextResponse.json(envelope(record));
  }

  if (req.method === "POST" && !id) {
    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prepared = await enrichCreatePayload(doctype, payload, user, req);

    const res = await frappeJson(
      `/api/resource/${encodeURIComponent(doctype)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared)
      },
      req
    );

    const createdName = res.payload?.data?.name;
    if (createdName) {
      const fetchCreated = await frappeJson(
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(createdName)}`,
        {},
        req
      );
      const createdRecord = normalizeRecord(fetchCreated.payload?.data || {});
      await hydrateProductNames([createdRecord], req);
      await hydrateUserNames([createdRecord], req);
      await hydrateOrganizationNames([createdRecord], req);
      return NextResponse.json(envelope(createdRecord));
    }

    const createdRecord = normalizeRecord(res.payload?.data || {});
    await hydrateProductNames([createdRecord], req);
    await hydrateUserNames([createdRecord], req);
    await hydrateOrganizationNames([createdRecord], req);
    return NextResponse.json(envelope(createdRecord));
  }

  if ((req.method === "PATCH" || req.method === "PUT") && id) {
    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prepared = await enrichUpdatePayload(doctype, payload, req);
    const res = await frappeJson(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepared)
      },
      req
    );
    const updatedRecord = normalizeRecord(res.payload?.data || {});
    await hydrateProductNames([updatedRecord], req);
    await hydrateUserNames([updatedRecord], req);
    await hydrateOrganizationNames([updatedRecord], req);
    return NextResponse.json(envelope(updatedRecord));
  }

  if (req.method === "DELETE" && id) {
    return deleteResource(doctype, id, req);
  }

  return NextResponse.json(errorEnvelope("Method not allowed"), { status: 405 });
}

async function handleNotifications(path: string[], req: NextRequest) {
  await getUserContext(req);

  if (req.method === "GET" && path.length === 1) {
    return NextResponse.json(envelope({ items: [] }));
  }

  if (req.method === "POST" && path[1] === "mark-read") {
    return NextResponse.json(envelope({ ok: true }));
  }

  return NextResponse.json(errorEnvelope("Not found", "NOT_FOUND"), { status: 404 });
}

async function handleLeadConvert(path: string[], req: NextRequest) {
  await getUserContext(req);
  const leadId = path[1];
  if (!leadId || path[2] !== "convert" || req.method !== "POST") {
    return NextResponse.json(errorEnvelope("Not found", "NOT_FOUND"), { status: 404 });
  }

  const convertRes = await frappeFetch(
    `/crm/leads/${encodeURIComponent(leadId)}/convert`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    },
    req
  );

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await convertRes.json();
  } catch {
    payload = null;
  }

  if (!convertRes.ok) {
    throw new Error(extractErrorMessage(payload, convertRes.status));
  }

  return NextResponse.json(
    envelope({
      lead_id: payload?.lead_id ?? leadId,
      organization_id: payload?.organization_id,
      contact_id: payload?.contact_id,
      deal_id: payload?.deal_id
    })
  );
}

async function handleRequest(req: NextRequest, ctx: { params: { path: string[] } }) {
  try {
    const path = ctx.params.path || [];
    if (!path.length) {
      return NextResponse.json(errorEnvelope("Not found", "NOT_FOUND"), { status: 404 });
    }

    if (path[0] === "auth") return await handleAuth(path, req);
    if (path[0] === "shell") return await handleShell(path, req);
    if (path[0] === "meta" && req.method === "GET" && path[1] === "link-options") return await handleLinkOptions(req);
    if (path[0] === "meta" && req.method === "GET" && path[1]) return await handleEntityMeta(path[1], req);
    if (path[0] === "activity-log" && req.method === "GET") return await handleActivityLog(req);
    if (path[0] === "related" && req.method === "GET" && path[1] && path[2]) return await handleEntityRelated(path, req);
    if (path[0] === "leads" && path[2] === "convert" && req.method === "POST") return await handleLeadConvert(path, req);
    if (path[0] === "dashboard" && path[1] === "metrics") return await handleDashboard(req);
    if (path[0] === "notifications") return await handleNotifications(path, req);

    return await handleResource(path, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const stack = error instanceof Error ? error.stack : undefined;
    const normalized = String(message || "");
    const status = normalized === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ ...errorEnvelope(normalized, "API_ERROR"), stack }, { status });
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return handleRequest(req, ctx);
}
