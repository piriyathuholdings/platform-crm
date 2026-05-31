"use client";

import { useEffect, useRef, useState } from "react";

import { AppInput, AppSelect, AppTextarea } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

import type { ResolvedEntityField } from "./meta";
import { isNumericFieldType, isTextareaFieldType } from "./meta";

type EntityFieldControlProps = {
  field: ResolvedEntityField;
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  forceReadOnly?: boolean;
};

function isSelectField(fieldtype: string): boolean {
  return fieldtype === "Select";
}

function isLinkField(fieldtype: string): boolean {
  return fieldtype === "Link";
}

function inputTypeForField(fieldtype: string): string {
  if (fieldtype === "Email") return "email";
  if (fieldtype === "Phone") return "tel";
  if (fieldtype === "Date") return "date";
  if (fieldtype === "Datetime") return "datetime-local";
  if (fieldtype === "Time") return "time";
  if (isNumericFieldType(fieldtype)) return "number";
  return "text";
}

export function EntityFieldControl({ field, value, onChange, disabled = false, forceReadOnly = false }: EntityFieldControlProps) {
  const readOnly = disabled || field.readOnly || forceReadOnly;
  const required = Boolean(field.required);
  const label = `${field.label}${required ? " *" : ""}`;
  const [linkOptions, setLinkOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const isUserLink = isLinkField(field.fieldtype) && field.linkDoctype === "User";
  const isProductLink = isLinkField(field.fieldtype) && field.linkDoctype === "Product";
  const isDealLink = isLinkField(field.fieldtype) && field.linkDoctype === "Deal";
  const isOrganizationLink = isLinkField(field.fieldtype) && field.linkDoctype === "Organization";
  const showIdSuffix = !isUserLink && !isProductLink && !isDealLink && !isOrganizationLink;
  const [userLinkSearchText, setUserLinkSearchText] = useState("");
  const [productLinkSearchText, setProductLinkSearchText] = useState("");
  const [dealLinkSearchText, setDealLinkSearchText] = useState("");
  const [organizationLinkSearchText, setOrganizationLinkSearchText] = useState("");
  const [dataSuggestions, setDataSuggestions] = useState<Array<{ id: string; label: string }>>([]);
  const [showDataSuggestions, setShowDataSuggestions] = useState(false);
  const previousUserValueRef = useRef("");
  const previousProductValueRef = useRef("");
  const previousDealValueRef = useRef("");
  const previousOrganizationValueRef = useRef("");
  const isLeadLocationField = field.key === "location" && field.fieldtype === "Data";

  useEffect(() => {
    if (!isLinkField(field.fieldtype)) return;
    if (!field.linkDoctype) return;

    let cancelled = false;
    const query = (
      isUserLink
        ? userLinkSearchText
        : isProductLink
          ? productLinkSearchText
          : isDealLink
            ? dealLinkSearchText
            : isOrganizationLink
              ? organizationLinkSearchText
              : value
    )?.trim() || "";
    const timer = window.setTimeout(async () => {
      try {
        const payload = await apiFetch<{ items: Array<{ id: string; label: string }> }>(
          `/meta/link-options?doctype=${encodeURIComponent(field.linkDoctype || "")}&q=${encodeURIComponent(query)}&limit=20`
        );
        if (!cancelled) setLinkOptions(payload.items || []);
      } catch {
        if (!cancelled) setLinkOptions([]);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    field.fieldtype,
    field.linkDoctype,
    value,
    isUserLink,
    isProductLink,
    isDealLink,
    isOrganizationLink,
    userLinkSearchText,
    productLinkSearchText,
    dealLinkSearchText,
    organizationLinkSearchText
  ]);

  useEffect(() => {
    if (!isLeadLocationField) return;
    let cancelled = false;
    const query = (value || "").trim();
    const timer = window.setTimeout(async () => {
      try {
        const payload = await apiFetch<{ items: Array<{ id: string; label: string }> }>(
          `/meta/link-options?doctype=${encodeURIComponent("Lead")}&fieldname=${encodeURIComponent("location")}&q=${encodeURIComponent(query)}&limit=20`
        );
        if (!cancelled) setDataSuggestions(payload.items || []);
      } catch {
        if (!cancelled) setDataSuggestions([]);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLeadLocationField, value]);

  useEffect(() => {
    if (!isUserLink) return;
    if (!value) {
      if (previousUserValueRef.current) setUserLinkSearchText("");
      previousUserValueRef.current = "";
      return;
    }
    previousUserValueRef.current = value;
    const selected = linkOptions.find((option) => option.id === value);
    if (selected?.label) {
      setUserLinkSearchText((previous) => (previous.trim() === "" || previous === value ? selected.label : previous));
      return;
    }
    setUserLinkSearchText((previous) => (previous.trim() === "" ? value : previous));
  }, [isUserLink, value, linkOptions]);

  useEffect(() => {
    if (!isProductLink) return;
    if (!value) {
      if (previousProductValueRef.current) setProductLinkSearchText("");
      previousProductValueRef.current = "";
      return;
    }
    previousProductValueRef.current = value;
    const selected = linkOptions.find((option) => option.id === value);
    if (selected?.label) {
      setProductLinkSearchText((previous) => (previous.trim() === "" || previous === value ? selected.label : previous));
      return;
    }
    setProductLinkSearchText((previous) => (previous.trim() === "" ? value : previous));
  }, [isProductLink, value, linkOptions]);

  useEffect(() => {
    if (!isDealLink) return;
    if (!value) {
      if (previousDealValueRef.current) setDealLinkSearchText("");
      previousDealValueRef.current = "";
      return;
    }
    previousDealValueRef.current = value;
    const selected = linkOptions.find((option) => option.id === value);
    if (selected?.label) {
      setDealLinkSearchText((previous) => (previous.trim() === "" || previous === value ? selected.label : previous));
      return;
    }
    setDealLinkSearchText((previous) => (previous.trim() === "" ? value : previous));
  }, [isDealLink, value, linkOptions]);

  useEffect(() => {
    if (!isOrganizationLink) return;
    if (!value) {
      if (previousOrganizationValueRef.current) setOrganizationLinkSearchText("");
      previousOrganizationValueRef.current = "";
      return;
    }
    previousOrganizationValueRef.current = value;
    const selected = linkOptions.find((option) => option.id === value);
    if (selected?.label) {
      setOrganizationLinkSearchText((previous) => (previous.trim() === "" || previous === value ? selected.label : previous));
      return;
    }
    setOrganizationLinkSearchText((previous) => (previous.trim() === "" ? value : previous));
  }, [isOrganizationLink, value, linkOptions]);

  if (field.fieldtype === "Check") {
    return (
      <label className="flex h-11 items-center gap-3 rounded-lg border border-border-subtle bg-base-100 px-3">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={value === "1"}
          onChange={(event) => onChange(event.target.checked ? "1" : "0")}
          disabled={readOnly}
        />
        <span className="text-sm font-medium text-text-default">{field.label}</span>
      </label>
    );
  }

  if (isSelectField(field.fieldtype)) {
    const isMissingBackendOptions = field.isRuntimeFieldtype && field.options.length === 0;
    return (
      <div className="space-y-1">
        <AppSelect
          label={label}
          value={value}
          disabled={readOnly || isMissingBackendOptions}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        >
          <option value="">
            {isMissingBackendOptions ? `No backend options for ${field.label}` : `Select ${field.label}`}
          </option>
          {field.options.map((option) => (
            <option key={`${field.key}:${option}`} value={option}>
              {option}
            </option>
          ))}
        </AppSelect>
        {isMissingBackendOptions ? (
          <p className="text-xs text-error">Options unavailable from backend metadata. Please check doctype field configuration.</p>
        ) : null}
      </div>
    );
  }

  if (isLinkField(field.fieldtype)) {
    const visibleOptions = linkOptions.filter((option) => {
      const query = (
        isUserLink
          ? userLinkSearchText
          : isProductLink
            ? productLinkSearchText
            : isDealLink
              ? dealLinkSearchText
              : isOrganizationLink
                ? organizationLinkSearchText
                : value
      )
        .trim()
        .toLowerCase();
      if (!query) return true;
      return option.id.toLowerCase().includes(query) || option.label.toLowerCase().includes(query);
    });

    return (
      <div className="relative">
        <AppInput
          label={label}
          value={
            isUserLink
              ? userLinkSearchText
              : isProductLink
                ? productLinkSearchText
                : isDealLink
                  ? dealLinkSearchText
                  : isOrganizationLink
                    ? organizationLinkSearchText
                    : value
          }
          type="text"
          disabled={readOnly}
          onChange={(event) => {
            const next = event.target.value;
            if (isUserLink) {
              setUserLinkSearchText(next);
              if (!next.trim()) onChange("");
              return;
            }
            if (isProductLink) {
              setProductLinkSearchText(next);
              if (!next.trim()) onChange("");
              return;
            }
            if (isDealLink) {
              setDealLinkSearchText(next);
              if (!next.trim()) onChange("");
              return;
            }
            if (isOrganizationLink) {
              setOrganizationLinkSearchText(next);
              if (!next.trim()) onChange("");
              return;
            }
            onChange(next);
          }}
          onFocus={() => setShowLinkDropdown(true)}
          onBlur={() => {
            window.setTimeout(() => setShowLinkDropdown(false), 120);
          }}
          required={required}
          placeholder={`Search ${field.label}`}
        />
        {showLinkDropdown && !readOnly ? (
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg">
            {visibleOptions.length ? (
              visibleOptions.map((option) => (
                <button
                  key={`${field.key}:${option.id}`}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-base-200 px-3 py-2 text-left text-sm text-text-default last:border-b-0 hover:bg-primary/8"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option.id);
                    if (isUserLink) setUserLinkSearchText(option.label || option.id);
                    if (isProductLink) setProductLinkSearchText(option.label || option.id);
                    if (isDealLink) setDealLinkSearchText(option.label || option.id);
                    if (isOrganizationLink) setOrganizationLinkSearchText(option.label || option.id);
                    setShowLinkDropdown(false);
                  }}
                >
                  <span className="truncate">{option.label || option.id}</span>
                  {showIdSuffix && option.label && option.label !== option.id ? (
                    <span className="shrink-0 text-xs text-text-muted">{option.id}</span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-text-muted">No matches found.</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (isTextareaFieldType(field.fieldtype)) {
    return (
      <AppTextarea
        label={label}
        value={value}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    );
  }

  if (isLeadLocationField) {
    const visibleSuggestions = dataSuggestions.filter((option) => {
      const q = (value || "").trim().toLowerCase();
      if (!q) return true;
      const label = (option.label || "").toLowerCase();
      return label.includes(q);
    });
    return (
      <div className="relative">
        <AppInput
          label={label}
          value={value}
          type="text"
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setShowDataSuggestions(true)}
          onBlur={() => {
            window.setTimeout(() => setShowDataSuggestions(false), 120);
          }}
          required={required}
          placeholder={`Type ${field.label}`}
        />
        {showDataSuggestions && !readOnly ? (
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg">
            {visibleSuggestions.length ? (
              visibleSuggestions.map((option) => (
                <button
                  key={`${field.key}:${option.id}`}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-base-200 px-3 py-2 text-left text-sm text-text-default last:border-b-0 hover:bg-primary/8"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option.label || option.id);
                    setShowDataSuggestions(false);
                  }}
                >
                  <span className="truncate">{option.label || option.id}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-text-muted">No matches found. You can still enter a new location.</p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppInput
      label={label}
      value={value}
      type={inputTypeForField(field.fieldtype)}
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      step={
        field.fieldtype === "Int"
          ? "1"
          : isNumericFieldType(field.fieldtype)
            ? "any"
            : undefined
      }
    />
  );
}
