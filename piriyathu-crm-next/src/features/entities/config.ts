export type EntityField = {
  key: string;
  label: string;
  required?: boolean;
};

export type EntityConfig = {
  key: string;
  label: string;
  apiEndpoint: string;
  icon: string;
  fields: EntityField[];
};

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  products: {
    key: "products",
    label: "Products",
    apiEndpoint: "products",
    icon: "products",
    fields: [
      { key: "product_code", label: "Product Code", required: true },
      { key: "product_name", label: "Product Name", required: true },
      { key: "product_type", label: "Product Type" },
      { key: "product_owner", label: "Product Owner" },
      { key: "is_active", label: "Is Active" }
    ]
  },
  "user-product-access": {
    key: "user-product-access",
    label: "User Product Access",
    apiEndpoint: "user-product-access",
    icon: "user-product-access",
    fields: [
      { key: "user", label: "User", required: true },
      { key: "product", label: "Product", required: true },
      { key: "role_in_product", label: "Role In Product" },
      { key: "is_active", label: "Is Active" }
    ]
  },
  leads: {
    key: "leads",
    label: "Leads",
    apiEndpoint: "leads",
    icon: "leads",
    fields: [
      { key: "lead_name", label: "Lead Name", required: true },
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "contact_name", label: "Contact Name" },
      { key: "location", label: "Location" },
      { key: "source", label: "Source" },
      { key: "email", label: "Email" },
      { key: "mobile_no", label: "Mobile" },
      { key: "status", label: "Status" },
      { key: "lost_reason", label: "Lost Reason" }
    ]
  },
  deals: {
    key: "deals",
    label: "Deals",
    apiEndpoint: "deals",
    icon: "deals",
    fields: [
      { key: "deal_title", label: "Deal Title", required: true },
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "deal_status", label: "Deal Status", required: true },
      { key: "lead", label: "Source Lead" },
      { key: "organization", label: "Organization" },
      { key: "contact", label: "Contact" },
      { key: "deal_value", label: "Deal Value" },
      { key: "total_payments_received", label: "Collection" },
      { key: "to_collect", label: "To Collect" },
      { key: "deal_value_change_reason", label: "Deal Value Change Reason" }
    ]
  },
  organizations: {
    key: "organizations",
    label: "Organizations",
    apiEndpoint: "organizations",
    icon: "organizations",
    fields: [
      { key: "organization_name", label: "Organization Name", required: true },
      { key: "contact_name", label: "Contact Name" },
      { key: "location", label: "Location" },
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" }
    ]
  },
  tasks: {
    key: "tasks",
    label: "Tasks",
    apiEndpoint: "tasks",
    icon: "tasks",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "lead", label: "Lead" },
      { key: "deal", label: "Deal" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" }
    ]
  },
  notes: {
    key: "notes",
    label: "Notes",
    apiEndpoint: "notes",
    icon: "notes",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "product", label: "Product" },
      { key: "assigned_to", label: "Assigned To" },
      { key: "note_content", label: "Content" }
    ]
  },
  expenses: {
    key: "expenses",
    label: "Expenses",
    apiEndpoint: "expenses",
    icon: "expenses",
    fields: [
      { key: "expense_title", label: "Title", required: true },
      { key: "expense_scope", label: "Scope", required: true },
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "borne_by", label: "Borne By" },
      { key: "deal", label: "Deal" },
      { key: "amount", label: "Amount", required: true },
      { key: "status", label: "Status" }
    ]
  },
  "client-payments": {
    key: "client-payments",
    label: "Client Payments",
    apiEndpoint: "client-payments",
    icon: "client-payments",
    fields: [
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "deal", label: "Deal", required: true },
      { key: "payment_type", label: "Payment Type" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", required: true }
    ]
  },
  "call-logs": {
    key: "call-logs",
    label: "Call Logs",
    apiEndpoint: "activities",
    icon: "call-logs",
    fields: [
      { key: "product", label: "Product", required: true },
      { key: "assigned_to", label: "Assigned To", required: true },
      { key: "subject", label: "Subject" },
      { key: "activity_type", label: "Activity Type" },
      { key: "activity_date", label: "Activity Date" },
      { key: "status", label: "Status" }
    ]
  }
};

export function getEntityConfig(entity: string): EntityConfig | null {
  return ENTITY_CONFIGS[entity] || null;
}

export function isSupportedEntity(entity: string): boolean {
  return Boolean(ENTITY_CONFIGS[entity]);
}

export function getEntityApiEndpoint(entity: string): string {
  return getEntityConfig(entity)?.apiEndpoint || entity;
}
