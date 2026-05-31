import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = process.env.ACCESS_COOKIE_NAME || "crm_access_token";
const CRM_ENTITY_ALLOWLIST = new Set([
  "products",
  "user-product-access",
  "leads",
  "deals",
  "contacts",
  "organizations",
  "notes",
  "tasks",
  "expenses",
  "client-payments",
  "call-logs",
  "notifications",
  "documents",
  "search",
  "settings"
]);

function hasValidSession(req: NextRequest): boolean {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const sid = req.cookies.get("sid")?.value;
  const userId = req.cookies.get("user_id")?.value;

  if (accessToken) return true;
  if (sid && sid !== "Guest") return true;
  if (userId && userId !== "Guest") return true;
  return false;
}

function isSafeRedirectPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAuthenticated = hasValidSession(req);

  if (pathname.startsWith("/crm")) {
    if (!isAuthenticated) {
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.searchParams.set("redirect", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }

    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const segment = parts[1];
      const reserved = new Set(["admin"]);
      if (!reserved.has(segment) && segment !== "crm" && !CRM_ENTITY_ALLOWLIST.has(segment)) {
        const notFound = req.nextUrl.clone();
        notFound.pathname = "/not-found";
        return NextResponse.rewrite(notFound);
      }
    }
  }

  if (pathname === "/login" && isAuthenticated) {
    const redirect = req.nextUrl.searchParams.get("redirect");
    const nextPath = redirect && isSafeRedirectPath(redirect) ? redirect : "/crm";
    const target = req.nextUrl.clone();
    target.pathname = nextPath;
    target.search = "";
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/login"]
};
