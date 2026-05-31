export type ApiEnvelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: { code?: string; message?: string } | null;
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (part.startsWith(encodedName)) {
      return decodeURIComponent(part.slice(encodedName.length));
    }
  }
  return null;
}

function isMutating(method?: string): boolean {
  const m = (method || "GET").toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

async function tryRefreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildLoginRedirectPath(): string {
  if (typeof window === "undefined") return "/login";
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?redirect=${encodeURIComponent(current)}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = getCookie("crm_csrf_token");
  let baseHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {})
  };
  if (isMutating(init?.method) && csrfToken) {
    baseHeaders = { ...baseHeaders, "x-csrf-token": csrfToken };
  }

  const doRequest = () =>
    fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      headers: baseHeaders
    });

  let response = await doRequest();
  const isAuthPath = path.startsWith("/auth/login") || path.startsWith("/auth/refresh") || path.startsWith("/auth/logout");
  if (response.status === 401 && !isAuthPath) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await doRequest();
    } else if (typeof window !== "undefined") {
      // Ensure stale/invalid sessions don't trap users on protected routes.
      window.location.href = buildLoginRedirectPath();
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") {
        message = payload.detail;
      } else if (typeof payload?.error?.message === "string") {
        message = payload.error.message;
      }
    } catch {
      if (response.status >= 500) {
        message = "Service unavailable. Please verify API server and database are running.";
      }
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (payload.error) {
    throw new Error(payload.error.message || "Request failed");
  }
  return payload.data;
}

export const crmNav = [
  { key: "dashboard", label: "Dashboard", href: "/crm" },
  { key: "leads", label: "Leads", href: "/crm/leads/view/list" },
  { key: "deals", label: "Deals", href: "/crm/deals/view/list" },
  { key: "organizations", label: "Organizations", href: "/crm/organizations/view/list" },
  { key: "notes", label: "Notes", href: "/crm/notes/view/list" },
  { key: "tasks", label: "Tasks", href: "/crm/tasks/view/list" },
  { key: "expenses", label: "Expenses", href: "/crm/expenses/view/list" },
  { key: "client-payments", label: "Client Payments", href: "/crm/client-payments/view/list" },
  { key: "call-logs", label: "Call Logs", href: "/crm/call-logs/view/list" }
];
