import { cookies, headers } from "next/headers";

export type ServerMe = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
};

export type ServerShellBoot = {
  user_profile?: {
    id?: string | null;
    email?: string | null;
    full_name?: string | null;
  };
  sidebar_items?: { key: string; label: string; route: string }[];
  roles?: string[];
};

type Envelope<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: { message?: string } | null;
};

function cookieHeaderValue(): string {
  const cookieStore = cookies();
  return cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
}

function resolveApiBase(): string {
  if (process.env.WEB_INTERNAL_BASE_URL) return process.env.WEB_INTERNAL_BASE_URL;
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "127.0.0.1:3000";
  return `${proto}://${host}`;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBase()}/api/v1${path}`, {
    headers: {
      Cookie: cookieHeaderValue(),
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const payload = (await response.json()) as Envelope<T>;
  if (payload.error) {
    throw new Error(payload.error.message || "Request failed");
  }
  return payload.data;
}

export async function getServerSessionData() {
  const me = await fetchApi<ServerMe>("/auth/me");
  const boot = await fetchApi<ServerShellBoot>("/shell/boot");
  return { me, boot };
}
