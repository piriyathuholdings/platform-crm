"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AppAlert, AppButton, AppCard, AppEmptyState, AppFormActions } from "@/components/ui";
import { getEntityApiEndpoint, getEntityConfig, isSupportedEntity } from "@/features/entities/config";
import { EntityFieldControl } from "@/features/entities/FieldControl";
import {
  applyDealDerivedValues,
  buildSubmitPayload,
  fetchDealDerivedValues,
  fetchEntityMeta,
  parsePrefillPayload,
  resolveLockedDerivedFields,
  resolveEntityFields,
  toInputValue,
  type ResolvedEntityField
} from "@/features/entities/meta";
import { apiFetch } from "@/lib/api-client";

const RESTRICTED_CREATE_REDIRECT: Record<string, string> = {
  products: "/crm/admin/products",
  "user-product-access": "/crm/admin/user-product-access"
};
const CREATE_FORM_EXCLUDED_FIELDS = new Set(["creation", "owner", "modified", "modified_by"]);

export default function NewEntityPage() {
  const params = useParams<{ entity: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const entity = params.entity;

  const [fields, setFields] = useState<ResolvedEntityField[]>([]);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lockedDerivedFields, setLockedDerivedFields] = useState<Set<string>>(new Set());
  const unavailableSelectLabels = useMemo(
    () => fields.filter((field) => field.fieldtype === "Select" && field.isRuntimeFieldtype && field.options.length === 0).map((field) => field.label),
    [fields]
  );

  const entityConfig = useMemo(() => getEntityConfig(entity), [entity]);
  const restrictedCreateTarget = RESTRICTED_CREATE_REDIRECT[entity];

  useEffect(() => {
    if (restrictedCreateTarget) {
      router.replace(restrictedCreateTarget);
      return;
    }

    if (!isSupportedEntity(entity)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const prefillValues = parsePrefillPayload(searchParams.get("prefill"));

    fetchEntityMeta(entity)
      .then((meta) => {
        const resolvedFields = resolveEntityFields(entity, meta.fields || []).filter(
          (field) => !field.readOnly && !CREATE_FORM_EXCLUDED_FIELDS.has(field.key)
        );
        const nextPayload: Record<string, string> = {};

        resolvedFields.forEach((field) => {
          const prefilled = prefillValues[field.key];
          if (prefilled != null && prefilled !== "") {
            nextPayload[field.key] = prefilled;
          } else {
            nextPayload[field.key] = toInputValue(field.fieldtype, "");
          }
        });

        setFields(resolvedFields);
        setPayload(nextPayload);
        setLockedDerivedFields(resolveLockedDerivedFields(resolvedFields, nextPayload));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [entity, searchParams, restrictedCreateTarget, router]);

  useEffect(() => {
    let cancelled = false;
    const dealId = String(payload.deal || "").trim();
    const locked = resolveLockedDerivedFields(fields, { deal: dealId });
    setLockedDerivedFields(locked);
    if (!dealId || !locked.size) return;
    fetchDealDerivedValues(dealId).then((derived) => {
      if (cancelled) return;
      setPayload((previous) => applyDealDerivedValues(fields, previous, derived));
    });
    return () => {
      cancelled = true;
    };
  }, [fields, payload.deal]);

  if (!isSupportedEntity(entity)) return <AppAlert tone="error">Unknown entity.</AppAlert>;
  if (restrictedCreateTarget) {
    return (
      <AppCard>
        <AppEmptyState description="Redirecting to settings management..." />
      </AppCard>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (unavailableSelectLabels.length) {
        throw new Error(`Missing backend options for: ${unavailableSelectLabels.join(", ")}`);
      }
      for (const field of fields) {
        if (!field.required) continue;
        const value = payload[field.key];
        if (field.fieldtype === "Check") continue;
        if (!String(value || "").trim()) throw new Error(`${field.label} is required`);
      }

      const endpoint = getEntityApiEndpoint(entity);
      const submitPayload = buildSubmitPayload(fields, payload);
      const created = await apiFetch<Record<string, unknown>>(`/${endpoint}`, { method: "POST", body: JSON.stringify(submitPayload) });
      if (created.id) router.push(`/crm/${entity}/${String(created.id)}`);
      else router.push(`/crm/${entity}/view/list`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const entityLabel = entityConfig?.label || entity;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight text-base-content md:text-xl">Create {entityLabel}</h1>
      </div>

      <AppCard>
        {loading ? (
          <AppEmptyState description="Loading form metadata..." />
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-3 lg:grid-cols-2">
              {fields.map((field) => (
                <EntityFieldControl
                  key={field.key}
                  field={field}
                  value={payload[field.key] || ""}
                  disabled={saving}
                  forceReadOnly={lockedDerivedFields.has(field.key)}
                  onChange={(nextValue) => setPayload((old) => ({ ...old, [field.key]: nextValue }))}
                />
              ))}
            </div>
            {unavailableSelectLabels.length ? (
              <AppAlert tone="error">
                Missing backend options for: {unavailableSelectLabels.join(", ")}. Update doctype metadata to continue.
              </AppAlert>
            ) : null}
            {error ? <AppAlert tone="error">{error}</AppAlert> : null}
            <AppFormActions>
              <AppButton
                loading={saving}
                type="submit"
                leftIcon={<span aria-hidden>+</span>}
                className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
              >
                {saving ? "Saving..." : "Save"}
              </AppButton>
              <AppButton variant="outline" onClick={() => router.back()} type="button">
                Cancel
              </AppButton>
            </AppFormActions>
          </form>
        )}
      </AppCard>
    </div>
  );
}
