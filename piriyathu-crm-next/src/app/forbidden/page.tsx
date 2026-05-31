import Link from "next/link";

import { AppButton, AppCard } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background p-6">
      <AppCard className="max-w-lg text-center" title="Access Denied" subtitle="You do not have permission to access this workspace.">
        <Link href="/crm"><AppButton>Back to Dashboard</AppButton></Link>
      </AppCard>
    </main>
  );
}
