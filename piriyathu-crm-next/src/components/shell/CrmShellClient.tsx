"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppButton } from "@/components/ui";
import { EntityIcon, navIconForKey } from "@/features/entities/icons";
import { apiFetch, crmNav } from "@/lib/api-client";
import type { ServerMe, ServerShellBoot } from "@/lib/server-session";

type CrmShellClientProps = {
  me: ServerMe;
  boot: ServerShellBoot;
  children: React.ReactNode;
};

const ENTITY_KEYS = new Set([
  "leads",
  "deals",
  "organizations",
  "tasks",
  "notes",
  "expenses",
  "client-payments",
  "call-logs"
]);
const HIDDEN_SIDEBAR_KEYS = new Set(["products", "user-product-access", "documents", "settings"]);

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isNavActive(pathname: string, href: string): boolean {
  const p = normalizePath(pathname);
  const h = normalizePath(href);

  if (h === "/crm") return p === "/crm";

  const entityList = /^\/crm\/([^/]+)\/view\/list$/.exec(h);
  if (entityList) {
    const ent = entityList[1];
    return p === h || p.startsWith(`/crm/${ent}/`);
  }

  return p === h || p.startsWith(`${h}/`);
}

export default function CrmShellClient({ me, boot, children }: CrmShellClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchText, setSearchText] = useState("");

  const navItems = boot.sidebar_items?.length
    ? boot.sidebar_items
    : crmNav.map((item) => ({ key: item.key, label: item.label, route: item.href }));

  const groupedNav = useMemo(() => {
    const filteredNav = navItems.filter((item) => !HIDDEN_SIDEBAR_KEYS.has(item.key));
    const workspace = filteredNav.filter((item) => !ENTITY_KEYS.has(item.key) && item.key !== "notifications");
    const entities = filteredNav.filter((item) => ENTITY_KEYS.has(item.key));
    return { workspace, entities };
  }, [navItems]);

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // noop
    }
    router.push("/login");
    router.refresh();
  }

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    router.push(`/crm/search?q=${encodeURIComponent(q)}`);
  }

  const notificationsActive = isNavActive(pathname, "/crm/notifications");
  const settingsActive = isNavActive(pathname, "/crm/settings");

  function NavLink({ href, label, iconKey }: { href: string; label: string; iconKey: string }) {
    const active = isNavActive(pathname, href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 rounded-lg border-l-4 px-3 py-2 text-sm font-medium transition ${
          active
            ? "border-primary bg-sidebar-elevated text-white shadow-sm"
            : "border-transparent text-slate-300 hover:bg-sidebar-elevated/80 hover:text-white"
        }`}
      >
        <EntityIcon icon={navIconForKey(iconKey)} className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-app-background text-text-default">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-white/10 bg-sidebar-base p-3 lg:sticky lg:top-0 lg:h-svh lg:w-[252px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-content">P</div>
            <div>
              <p className="font-display text-base font-semibold tracking-tight text-white">Piriyathu CRM</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Sales Workspace</p>
              <p className="mt-0.5 text-xs text-slate-300">{me.full_name || "User"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</p>
              <nav className="space-y-1">
                {groupedNav.workspace.map((item) => (
                  <NavLink key={item.key} href={item.route} label={item.label} iconKey={item.key} />
                ))}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">CRM Modules</p>
              <nav className="space-y-1">
                {groupedNav.entities.map((item) => (
                  <NavLink key={item.key} href={item.route} label={item.label} iconKey={item.key} />
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/95 px-3 py-2 backdrop-blur md:px-4">
            <div className="flex w-full flex-wrap items-center gap-2 md:gap-2.5">
              <form className="min-w-[160px] max-w-md flex-1" onSubmit={submitSearch}>
                <div className="relative">
                  <EntityIcon icon="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    className="h-8 w-full rounded-md border border-base-300 bg-base-100 pl-8 pr-3 text-sm text-text-default outline-none transition-[box-shadow,border-color] focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Search leads, deals, tasks"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
              </form>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Link
                  href="/crm/notifications"
                  className={`btn btn-ghost btn-square h-9 w-9 rounded-md border border-base-300 ${notificationsActive ? "bg-primary/10 text-primary" : ""}`}
                  aria-label="Notifications"
                >
                  <EntityIcon icon="notifications" className="h-5 w-5" />
                </Link>

                <Link
                  href="/crm/settings"
                  className={`btn btn-ghost btn-square h-9 w-9 rounded-md border border-base-300 ${settingsActive ? "bg-primary/10 text-primary" : ""}`}
                  aria-label="Settings"
                >
                  <EntityIcon icon="settings" className="h-5 w-5" />
                </Link>

                <AppButton variant="outline" size="sm" type="button" onClick={logout}>
                  Logout
                </AppButton>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-4">{children}</main>
        </section>
      </div>
    </div>
  );
}
