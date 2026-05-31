"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppAlert, AppButton, AppCard, AppEmptyState } from "@/components/ui";
import { getEntityApiEndpoint, getEntityConfig, isSupportedEntity } from "@/features/entities/config";
import { buildCrmRecordHrefFromDoctype } from "@/features/entities/link-routes";
import { EntityFieldControl } from "@/features/entities/FieldControl";
import {
  applyDealDerivedValues,
  buildSubmitPayload,
  fetchDealDerivedValues,
  fetchEntityMeta,
  resolveLockedDerivedFields,
  resolveEntityFields,
  toInputValue,
  type ResolvedEntityField
} from "@/features/entities/meta";
import { apiFetch } from "@/lib/api-client";

type RelatedCardPayload = {
  id: string;
  title: string;
  entity: string;
  create_href: string;
  rows: Record<string, unknown>[];
};

type RelatedResponse = {
  entity: string;
  id: string;
  cards: RelatedCardPayload[];
};

type CommentRow = {
  id: string;
  content?: string;
  comment_by?: string;
  comment_email?: string;
  creation?: string;
};

type ActivityRow = {
  id: string;
  changed_at?: string;
  changed_by?: string;
  field?: string;
  from_value?: unknown;
  to_value?: unknown;
};

type LeadConvertResponse = {
  lead_id: number;
  organization_id: number;
  contact_id: number;
  deal_id: number;
};

function formatDisplayValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatActivityValue(value: unknown): string {
  if (value == null || value === "") return "(empty)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toFieldInputValue(field: ResolvedEntityField, record: Record<string, unknown>): string {
  if (field.fieldtype === "Link") {
    const rawId = record[`${field.key}__id`];
    if (rawId != null && String(rawId).trim()) {
      return toInputValue(field.fieldtype, rawId);
    }
  }
  return toInputValue(field.fieldtype, record[field.key]);
}

function resolveReferenceDoctype(entity: string): string {
  const map: Record<string, string> = {
    products: "Product",
    "user-product-access": "User Product Access",
    leads: "Lead",
    deals: "Deal",
    organizations: "Organization",
    tasks: "Task",
    notes: "Note",
    expenses: "Expense",
    "client-payments": "Client Payment",
    "call-logs": "Activity"
  };
  return map[entity] || entity;
}

type ParentLink = {
  key: string;
  label: string;
  value: string;
  doctype: string;
  href: string;
};

const PARENT_LINK_DOCTYPES = new Set(["Lead", "Deal", "Organization", "Contact"]);

function resolveParentLinks(fields: ResolvedEntityField[], row: Record<string, unknown> | null): ParentLink[] {
  if (!row) return [];
  return fields
    .filter((field) => field.fieldtype === "Link" && field.linkDoctype && PARENT_LINK_DOCTYPES.has(field.linkDoctype))
    .map((field) => {
      const rawId = row[`${field.key}__id`] ?? row[field.key];
      const value = rawId == null ? "" : String(rawId).trim();
      if (!value || !field.linkDoctype) return null;
      const href = buildCrmRecordHrefFromDoctype(field.linkDoctype, value);
      if (!href) return null;
      return {
        key: field.key,
        label: field.label,
        value,
        doctype: field.linkDoctype,
        href
      } as ParentLink;
    })
    .filter((entry): entry is ParentLink => Boolean(entry));
}

export default function EntityDetailPage({ params }: { params: { entity: string; id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entity = params.entity;
  const id = params.id;
  const entityConfig = useMemo(() => getEntityConfig(entity), [entity]);

  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [fields, setFields] = useState<ResolvedEntityField[]>([]);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [relatedCards, setRelatedCards] = useState<RelatedCardPayload[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "comments" | "activity">("details");
  const [convertResult, setConvertResult] = useState<LeadConvertResponse | null>(null);
  const [lockedDerivedFields, setLockedDerivedFields] = useState<Set<string>>(new Set());
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }),
    []
  );
  const unavailableSelectLabels = useMemo(
    () => fields.filter((field) => field.fieldtype === "Select" && field.options.length === 0).map((field) => field.label),
    [fields]
  );
  const parentLinks = useMemo(() => resolveParentLinks(fields, row), [fields, row]);

  function syncEditQuery(nextEdit: boolean) {
    const query = new URLSearchParams(searchParams.toString());
    if (nextEdit) query.set("edit", "1");
    else query.delete("edit");
    const qs = query.toString();
    router.replace(`/crm/${entity}/${id}${qs ? `?${qs}` : ""}`);
  }

  useEffect(() => {
    setIsEditing(searchParams.get("edit") === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!isSupportedEntity(entity)) {
      setError("Unknown entity.");
      setLoading(false);
      return;
    }

    const endpoint = getEntityApiEndpoint(entity);
    setLoading(true);
    setError("");

    Promise.all([
      apiFetch<Record<string, unknown>>(`/${endpoint}/${id}`),
      fetchEntityMeta(entity),
      apiFetch<RelatedResponse>(`/related/${entity}/${id}?limit=5`).catch(() => ({ entity, id, cards: [] })),
      apiFetch<{ items: CommentRow[] }>(
        `/comments?limit=20&filters=${encodeURIComponent(
          JSON.stringify([
            ["reference_doctype", "=", resolveReferenceDoctype(entity)],
            ["reference_name", "=", id]
          ])
        )}&order_by=${encodeURIComponent("creation desc")}`
      ).catch(() => ({ items: [] })),
      apiFetch<{ items: ActivityRow[] }>(
        `/activity-log?reference_doctype=${encodeURIComponent(resolveReferenceDoctype(entity))}&reference_name=${encodeURIComponent(id)}&limit=100`
      ).catch(() => ({ items: [] }))
    ])
      .then(([record, meta, related, commentRes, activityRes]) => {
        const resolvedFields = resolveEntityFields(entity, meta.fields || []);
        const nextPayload: Record<string, string> = {};
        resolvedFields.forEach((field) => {
          nextPayload[field.key] = toFieldInputValue(field, record);
        });

        setRow(record);
        setFields(resolvedFields);
        setPayload(nextPayload);
        setLockedDerivedFields(resolveLockedDerivedFields(resolvedFields, nextPayload));
        setRelatedCards(related.cards || []);
        setComments(commentRes.items || []);
        setActivities(activityRes.items || []);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [entity, id]);

  useEffect(() => {
    let cancelled = false;
    const dealId = String(payload.deal || "").trim();
    const locked = resolveLockedDerivedFields(fields, { deal: dealId });
    setLockedDerivedFields(locked);
    if (!isEditing || !dealId || !locked.size) return;
    fetchDealDerivedValues(dealId).then((derived) => {
      if (cancelled) return;
      setPayload((previous) => applyDealDerivedValues(fields, previous, derived));
    });
    return () => {
      cancelled = true;
    };
  }, [fields, isEditing, payload.deal]);

  async function saveRecord() {
    if (!row || saving) return;

    try {
      setSaving(true);
      setError("");
      if (unavailableSelectLabels.length) {
        throw new Error(`Missing backend options for: ${unavailableSelectLabels.join(", ")}`);
      }

      for (const field of fields) {
        if (!field.required) continue;
        const value = payload[field.key];
        if (field.fieldtype === "Check") continue;
        if (!String(value || "").trim()) {
          throw new Error(`${field.label} is required`);
        }
      }

      const endpoint = getEntityApiEndpoint(entity);
      const submitPayload = buildSubmitPayload(fields, payload);
      const updated = await apiFetch<Record<string, unknown>>(`/${endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(submitPayload)
      });

      const nextPayload: Record<string, string> = {};
      fields.forEach((field) => {
        nextPayload[field.key] = toFieldInputValue(field, updated);
      });

      setRow(updated);
      setPayload(nextPayload);
      setIsEditing(false);
      syncEditQuery(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!row) {
      setIsEditing(false);
      syncEditQuery(false);
      return;
    }

    const resetPayload: Record<string, string> = {};
    fields.forEach((field) => {
      resetPayload[field.key] = toFieldInputValue(field, row);
    });
    setPayload(resetPayload);
    setIsEditing(false);
    syncEditQuery(false);
  }

  async function deleteRecord() {
    if (deleting) return;

    const endpoint = getEntityApiEndpoint(entity);
    setDeleting(true);
    setError("");
    try {
      await apiFetch<{ ok: boolean }>(`/${endpoint}/${id}`, { method: "DELETE" });
      router.push(`/crm/${entity}/view/list`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function addComment() {
    const content = commentText.trim();
    if (!content || commentSaving) return;
    setCommentSaving(true);
    setError("");
    try {
      await apiFetch<Record<string, unknown>>(`/comments`, {
        method: "POST",
        body: JSON.stringify({
          comment_type: "Comment",
          reference_doctype: resolveReferenceDoctype(entity),
          reference_name: id,
          content
        })
      });
      const refreshed = await apiFetch<{ items: CommentRow[] }>(
        `/comments?limit=20&filters=${encodeURIComponent(
          JSON.stringify([
            ["reference_doctype", "=", resolveReferenceDoctype(entity)],
            ["reference_name", "=", id]
          ])
        )}&order_by=${encodeURIComponent("creation desc")}`
      );
      setComments(refreshed.items || []);
      setCommentText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommentSaving(false);
    }
  }

  async function convertLead() {
    if (entity !== "leads" || converting) return;
    setConverting(true);
    setError("");
    try {
      const result = await apiFetch<LeadConvertResponse>(`/leads/${id}/convert`, { method: "POST" });
      const refreshed = await apiFetch<Record<string, unknown>>(`/leads/${id}`);
      const nextPayload: Record<string, string> = {};
      fields.forEach((field) => {
        nextPayload[field.key] = toFieldInputValue(field, refreshed);
      });
      setRow(refreshed);
      setPayload(nextPayload);
      setConvertResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConverting(false);
    }
  }

  if (!isSupportedEntity(entity)) {
    return <AppAlert tone="error">Unknown entity.</AppAlert>;
  }

  if (loading) {
    return (
      <AppCard>
        <AppEmptyState description="Loading record details..." />
      </AppCard>
    );
  }

  const entityLabel = entityConfig?.label || entity;
  const isLeadConverted = entity === "leads" && Boolean(row?.converted);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <AppButton variant="outline" size="sm" type="button" leftIcon={<span aria-hidden>←</span>} onClick={() => router.back()}>
            Back
          </AppButton>
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-base-content md:text-xl">{entityLabel} Detail</h1>
            <p className="mt-0.5 text-xs text-base-content/60 md:text-sm">Record {id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <AppButton
                size="sm"
                type="button"
                loading={saving}
                onClick={saveRecord}
                className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
              >
                {saving ? "Saving..." : "Save"}
              </AppButton>
              <AppButton size="sm" variant="outline" type="button" onClick={cancelEdit}>
                Cancel
              </AppButton>
            </>
          ) : (
            <AppButton
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsEditing(true);
                syncEditQuery(true);
              }}
            >
              Edit
            </AppButton>
          )}
          {entity === "leads" ? (
            <AppButton
              size="sm"
              type="button"
              onClick={convertLead}
              disabled={isLeadConverted}
              loading={converting}
              className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeadConverted ? "Already Converted" : converting ? "Converting..." : "Convert to Organization & Deal"}
            </AppButton>
          ) : null}
          <AppButton variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} type="button" loading={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </AppButton>
        </div>
      </div>

      {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      {convertResult ? (
        <AppAlert tone="success">
          Lead converted successfully.{" "}
          <Link href={`/crm/organizations/${convertResult.organization_id}`} className="underline">
            Organization #{convertResult.organization_id}
          </Link>{" "}
          and{" "}
          <Link href={`/crm/deals/${convertResult.deal_id}`} className="underline">
            Deal #{convertResult.deal_id}
          </Link>{" "}
          created and linked.
        </AppAlert>
      ) : null}
      {isEditing && unavailableSelectLabels.length ? (
        <AppAlert tone="error">
          Missing backend options for: {unavailableSelectLabels.join(", ")}. Update doctype metadata to edit these fields.
        </AppAlert>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <AppCard>
            <div className="mb-3 inline-flex items-center gap-1 rounded-lg border border-base-300 bg-base-100 p-1.5">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "details"
                    ? "bg-primary/12 text-primary"
                    : "text-text-muted hover:bg-base-200 hover:text-text-default"
                }`}
                onClick={() => setActiveTab("details")}
              >
                Details
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "comments"
                    ? "bg-primary/12 text-primary"
                    : "text-text-muted hover:bg-base-200 hover:text-text-default"
                }`}
                onClick={() => setActiveTab("comments")}
              >
                Comments
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "activity"
                    ? "bg-primary/12 text-primary"
                    : "text-text-muted hover:bg-base-200 hover:text-text-default"
                }`}
                onClick={() => setActiveTab("activity")}
              >
                Activity
              </button>
            </div>
            {activeTab === "details" ? (
              <div className="grid gap-2.5 md:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="rounded-md border border-base-300 bg-base-100 p-2.5">
                    {isEditing ? (
                      <EntityFieldControl
                        field={field}
                        value={payload[field.key] || ""}
                        disabled={saving}
                        forceReadOnly={lockedDerivedFields.has(field.key)}
                        onChange={(nextValue) => setPayload((old) => ({ ...old, [field.key]: nextValue }))}
                      />
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-[0.1em] text-text-muted">{field.label}</p>
                        <div className="mt-1 break-all text-sm font-medium text-text-strong">
                          {(() => {
                            if (!(field.fieldtype === "Link" && field.linkDoctype && row?.[field.key])) {
                              return formatDisplayValue(row?.[field.key]);
                            }
                            const linkHref = buildCrmRecordHrefFromDoctype(
                              field.linkDoctype,
                              String(row[`${field.key}__id`] ?? row[field.key])
                            );
                            if (!linkHref) return formatDisplayValue(row?.[field.key]);
                            return (
                              <Link href={linkHref} className="text-primary hover:underline">
                                {formatDisplayValue(row[field.key])}
                              </Link>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "comments" ? (
              <div className="space-y-3">
                <textarea
                  className="textarea textarea-bordered min-h-[84px] w-full"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={commentSaving}
                />
                <div className="flex justify-end">
                  <AppButton
                    type="button"
                    loading={commentSaving}
                    onClick={addComment}
                    className="border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
                  >
                    {commentSaving ? "Posting..." : "Post Comment"}
                  </AppButton>
                </div>
                {comments.length ? (
                  <div className="space-y-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border border-base-300 bg-base-100 p-2.5">
                        <p className="text-sm text-text-strong">{formatDisplayValue(comment.content)}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {[comment.comment_by || comment.comment_email, comment.creation].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AppEmptyState description="No comments yet." />
                )}
              </div>
            ) : null}

            {activeTab === "activity" ? (
              <div className="space-y-2">
                {activities.length ? (
                  activities.map((activity) => (
                    <div key={activity.id} className="rounded-md border border-base-300 bg-base-100 p-2.5">
                      <p className="text-sm text-text-strong">
                        <span className="font-semibold">{formatDisplayValue(activity.field)}</span>: changed value from{" "}
                        <span className="font-medium">{formatActivityValue(activity.from_value)}</span> to{" "}
                        <span className="font-medium">{formatActivityValue(activity.to_value)}</span>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {[activity.changed_at, activity.changed_by].filter(Boolean).join(" • by ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <AppEmptyState description="No activity yet." />
                )}
              </div>
            ) : null}
          </AppCard>
        </div>

        <aside className="space-y-3 lg:col-span-4">
          <h2 className="font-display text-base font-semibold text-text-strong">Related Items</h2>
          {relatedCards.map((card) => (
            <AppCard
              key={card.id}
              title={
                (() => {
                  if (card.entity !== "expenses" && card.entity !== "client-payments") return card.title;
                  const total = card.rows.reduce((sum, row) => {
                    const value = Number(row.amount || 0);
                    return Number.isFinite(value) ? sum + value : sum;
                  }, 0);
                  return `${card.title} (${currencyFormatter.format(total)})`;
                })()
              }
              actions={
                <Link href={card.create_href}>
                  <AppButton
                    variant="outline"
                    size="sm"
                    type="button"
                    leftIcon={<span aria-hidden>+</span>}
                    className="text-primary"
                  >
                    New
                  </AppButton>
                </Link>
              }
            >
              {card.rows.length ? (
                <div className="space-y-2">
                  {card.rows.map((relatedRow) => {
                    const relatedId = String(relatedRow.id || relatedRow.name || "");
                    const relatedHref = `/crm/${card.entity}/${encodeURIComponent(relatedId)}`;
                    return (
                      <div
                        key={`${card.id}:${relatedId}`}
                        className="relative cursor-pointer rounded-md border border-base-300 px-2.5 py-2 transition-colors hover:border-base-300 hover:bg-base-200/60"
                        onClick={() => router.push(relatedHref)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(relatedHref);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <a
                          href={relatedHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open related record in new tab"
                          className="absolute right-2 top-1 text-xs text-primary hover:text-primary/80"
                          onClick={(event) => event.stopPropagation()}
                        >
                          ↗
                        </a>
                        <p className="text-sm font-semibold text-text-strong">{formatDisplayValue(relatedRow.primary || relatedRow.name)}</p>
                        <p className="text-xs text-text-muted">
                          {[relatedRow.status, relatedRow.modified].filter(Boolean).map((val) => String(val)).join(" • ") || "Open record"}
                        </p>
                        {card.entity === "expenses" || card.entity === "client-payments" ? (
                          <p className="mt-1 text-xs font-medium text-primary">
                            Amount: {currencyFormatter.format(Number(relatedRow.amount || 0))}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <AppEmptyState title="" description={`No related ${card.title.toLowerCase()} found.`} />
              )}
            </AppCard>
          ))}

          {!relatedCards.length ? <AppEmptyState title="" description="No related sets configured for this document." /> : null}
        </aside>
      </div>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-base-300 bg-base-100 p-4 shadow-xl">
            <h3 className="text-base font-semibold text-text-strong">Delete this {entityLabel} record?</h3>
            <p className="mt-1 text-sm text-text-muted">This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <AppButton
                variant="outline"
                size="sm"
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                type="button"
                loading={deleting}
                onClick={deleteRecord}
              >
                {deleting ? "Deleting..." : "Delete"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
