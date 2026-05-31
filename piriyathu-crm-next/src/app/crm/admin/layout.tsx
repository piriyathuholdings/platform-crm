import { redirect } from "next/navigation";

import { getServerSessionData } from "@/lib/server-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const { me, boot } = await getServerSessionData();
    const roles = boot.roles?.length ? boot.roles : me.roles || [];
    if (!roles.includes("BUSINESS_ADMIN")) {
      redirect("/forbidden");
    }
    return <>{children}</>;
  } catch {
    redirect("/login?redirect=/crm/admin/users");
  }
}
