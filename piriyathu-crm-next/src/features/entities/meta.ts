import { apiFetch } from "@/lib/api-client";

import type { EntityField } from "./config";
import { getEntityConfig } from "./config";

export type RuntimeEntityFieldMeta = {
  fieldname: string;
  label: string;
  fieldtype: string;
  required: boolean;
  read_only: boolean;
  options: string[];
  link_doctype?: string | null;
};

export type RuntimeEntityMetaResponse = {
  entity: string;
  doctype: string;
  fields: RuntimeEntityFieldMeta[];
};

export type ResolvedEntityField = EntityField & {
  fieldtype: string;
  readOnly: boolean;
  options: string[];
  linkDoctype?: string | null;
  isRuntimeFieldtype: boolean;
};

const NUMERIC_TYPES = new Set(["Int", "Float", "Currency", "Percent"]);
const TEXTAREA_TYPES = new Set(["Text", "Small Text", "Text Editor", "Long Text", "Code"]);
const USER_LINK_FIELDS = new Set(["assigned_to", "owner", "modified_by", "user", "borne_by", "comment_by", "changed_by"]);

export function isNumericFieldType(fieldtype: string): boolean {
  return NUMERIC_TYPES.has(fieldtype);
}

export function isTextareaFieldType(fieldtype: string): boolean {
  return TEXTAREA_TYPES.has(fieldtype);
}

export async function fetchEntityMeta(entity: string): Promise<RuntimeEntityMetaResponse> {
  return apiFetch<RuntimeEntityMetaResponse>(`/meta/${entity}`);
}

export function resolveEntityFields(entity: string, runtimeFields: RuntimeEntityFieldMeta[]): ResolvedEntityField[] {
  const entityConfig = getEntityConfig(entity);
  if (!entityConfig) return [];

  const byName = new Map(runtimeFields.map((field) => [field.fieldname, field]));
  const configured = entityConfig.fields.map((field) => {
    const runtime = byName.get(field.key);
    const runtimeFieldtype = runtime?.fieldtype || inferFallbackFieldType(field.key);
    const forcedUserLink = USER_LINK_FIELDS.has(field.key);
    return {
      ...field,
      label: runtime?.label || field.label,
      required: runtime?.required ?? Boolean(field.required),
      fieldtype: forcedUserLink ? "Link" : runtimeFieldtype,
      isRuntimeFieldtype: Boolean(runtime?.fieldtype),
      readOnly: Boolean(runtime?.read_only),
      options: resolveFieldOptions(entity, field.key, runtimeFieldtype, runtime?.options || []),
      linkDoctype: forcedUserLink ? "User" : runtime?.link_doctype || null
    };
  });

  const configuredKeys = new Set(configured.map((field) => field.key));
  const additionalRuntime = runtimeFields
    .filter((field) => !configuredKeys.has(field.fieldname))
    .map((field) => {
      const runtimeFieldtype = field.fieldtype || inferFallbackFieldType(field.fieldname);
      const forcedUserLink = USER_LINK_FIELDS.has(field.fieldname);
      return {
        key: field.fieldname,
        label: field.label,
        required: field.required,
        fieldtype: forcedUserLink ? "Link" : runtimeFieldtype,
        isRuntimeFieldtype: Boolean(field.fieldtype),
        readOnly: Boolean(field.read_only),
        options: resolveFieldOptions(entity, field.fieldname, runtimeFieldtype, field.options || []),
        linkDoctype: forcedUserLink ? "User" : field.link_doctype || null
      };
    });

  return [...configured, ...additionalRuntime];
}

function resolveFieldOptions(entity: string, fieldname: string, fieldtype: string, options: string[]): string[] {
  if (fieldtype !== "Select") return options;
  return options;
}

function inferFallbackFieldType(fieldname: string): string {
  const name = fieldname.toLowerCase();
  if (name.includes("date")) return "Date";
  if (name.includes("time")) return "Datetime";
  if (name.includes("status") || name.includes("type") || name.includes("scope") || name.includes("priority")) return "Select";
  if (name.includes("amount") || name.includes("value")) return "Currency";
  if (name.includes("email")) return "Email";
  if (name.includes("mobile") || name.includes("phone")) return "Phone";
  if (name.startsWith("is_") || name.startsWith("has_")) return "Check";
  if (name.includes("description") || name.includes("content")) return "Text";
  return "Data";
}

export function parsePrefillPayload(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? "" : String(value)]));
  } catch {
    return {};
  }
}

export function toInputValue(fieldtype: string, value: unknown): string {
  if (value == null) return "";
  const raw = String(value);

  if (fieldtype === "Check") {
    return raw === "1" || raw.toLowerCase() === "true" ? "1" : "0";
  }
  if (fieldtype === "Datetime") {
    return raw.includes("T") ? raw.slice(0, 16) : raw.replace(" ", "T").slice(0, 16);
  }
  if (fieldtype === "Date") {
    return raw.slice(0, 10);
  }
  if (fieldtype === "Time") {
    return raw.slice(0, 5);
  }
  return raw;
}

export function toSubmitValue(fieldtype: string, value: string): unknown {
  if (value === "") return null;

  if (fieldtype === "Check") {
    return value === "1" || value.toLowerCase() === "true" ? 1 : 0;
  }

  if (fieldtype === "Datetime") {
    const normalized = value.replace("T", " ");
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  }

  if (NUMERIC_TYPES.has(fieldtype)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return value;
}

export function buildSubmitPayload(fields: ResolvedEntityField[], payload: Record<string, string>): Record<string, unknown> {
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      const field = fieldByKey.get(key);
      return [key, toSubmitValue(field?.fieldtype || "Data", value)];
    })
  );
}

export function resolveLockedDerivedFields(fields: ResolvedEntityField[], payload: Record<string, string>): Set<string> {
  const hasDeal = Boolean(String(payload.deal || "").trim());
  if (!hasDeal) return new Set();
  const keys = new Set(fields.map((field) => field.key));
  return new Set(["organization", "product", "assigned_to"].filter((field) => keys.has(field)));
}

export async function fetchDealDerivedValues(dealId: string): Promise<Record<string, string>> {
  const trimmedDealId = String(dealId || "").trim();
  if (!trimmedDealId) return {};
  try {
    const deal = await apiFetch<Record<string, unknown>>(`/deals/${encodeURIComponent(trimmedDealId)}`);
    const pickValue = (fieldname: string) => {
      const rawId = deal[`${fieldname}__id`];
      if (rawId != null && String(rawId).trim()) return String(rawId).trim();
      const raw = deal[fieldname];
      return raw != null && String(raw).trim() ? String(raw).trim() : "";
    };
    return {
      organization: pickValue("organization"),
      product: pickValue("product"),
      assigned_to: pickValue("assigned_to")
    };
  } catch {
    return {};
  }
}

export function applyDealDerivedValues(
  fields: ResolvedEntityField[],
  payload: Record<string, string>,
  derived: Record<string, string>
): Record<string, string> {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const nextPayload = { ...payload };
  if (fieldKeys.has("organization") && derived.organization) nextPayload.organization = derived.organization;
  if (fieldKeys.has("product") && derived.product) nextPayload.product = derived.product;
  if (fieldKeys.has("assigned_to") && derived.assigned_to) nextPayload.assigned_to = derived.assigned_to;
  if (fieldKeys.has("expense_scope") && String(nextPayload.deal || "").trim()) nextPayload.expense_scope = "Deal";
  return nextPayload;
}
