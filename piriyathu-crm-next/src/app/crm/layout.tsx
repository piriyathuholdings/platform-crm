import { redirect } from "next/navigation";

import CrmShellClient from "@/components/shell/CrmShellClient";
import { getServerSessionData } from "@/lib/server-session";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSessionData().catch(() => null);
  if (!session) {
    redirect("/login");
  }

  const { me, boot } = session;
  return (
    <CrmShellClient me={me} boot={boot}>
      {children}
    </CrmShellClient>
  );
}
