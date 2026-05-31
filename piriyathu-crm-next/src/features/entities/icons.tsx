import type { SVGProps } from "react";

export type IconKey =
  | "dashboard"
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
  | "call-logs"
  | "documents"
  | "settings"
  | "notifications"
  | "search";

function IconBase({ children, className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function EntityIcon({ icon, className = "h-4 w-4" }: { icon: IconKey; className?: string }) {
  switch (icon) {
    case "dashboard":
      return (
        <IconBase className={className}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </IconBase>
      );
    case "products":
      return (
        <IconBase className={className}>
          <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
          <path d="M3 12.5 12 17l9-4.5" />
          <path d="M3 17.5 12 22l9-4.5" />
        </IconBase>
      );
    case "user-product-access":
      return (
        <IconBase className={className}>
          <circle cx="8" cy="8" r="3" />
          <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="m14 13 2 2 5-5" />
        </IconBase>
      );
    case "leads":
      return (
        <IconBase className={className}>
          <path d="M4 12h7" />
          <path d="m8 8 4 4-4 4" />
          <path d="M14 5h6v14h-6" />
        </IconBase>
      );
    case "deals":
      return (
        <IconBase className={className}>
          <path d="M3 7h18" />
          <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M10 14h4" />
        </IconBase>
      );
    case "contacts":
      return (
        <IconBase className={className}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </IconBase>
      );
    case "organizations":
      return (
        <IconBase className={className}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </IconBase>
      );
    case "tasks":
      return (
        <IconBase className={className}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 12 3 3 7-7" />
        </IconBase>
      );
    case "notes":
      return (
        <IconBase className={className}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v5h4" />
          <path d="M9 13h6M9 17h6" />
        </IconBase>
      );
    case "expenses":
      return (
        <IconBase className={className}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 12h.01M17 12h.01" />
        </IconBase>
      );
    case "client-payments":
      return (
        <IconBase className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18" />
          <path d="M8 14h3" />
        </IconBase>
      );
    case "call-logs":
      return (
        <IconBase className={className}>
          <path d="M5 4h4l2 5-2.5 2.5a14.5 14.5 0 0 0 4 4L15 13l5 2v4a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
        </IconBase>
      );
    case "documents":
      return (
        <IconBase className={className}>
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M15 2v5h5" />
          <path d="M9 13h6M9 17h6" />
        </IconBase>
      );
    case "settings":
      return (
        <IconBase className={className}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9" />
        </IconBase>
      );
    case "notifications":
      return (
        <IconBase className={className}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </IconBase>
      );
    case "search":
      return (
        <IconBase className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </IconBase>
      );
    default:
      return (
        <IconBase className={className}>
          <circle cx="12" cy="12" r="9" />
        </IconBase>
      );
  }
}

export function navIconForKey(key: string): IconKey {
  const known = new Set<IconKey>([
    "dashboard",
    "products",
    "user-product-access",
    "leads",
    "deals",
    "contacts",
    "organizations",
    "tasks",
    "notes",
    "expenses",
    "client-payments",
    "call-logs",
    "documents",
    "settings",
    "notifications",
    "search"
  ]);
  if (known.has(key as IconKey)) return key as IconKey;
  return "dashboard";
}
