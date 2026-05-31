import Link from "next/link";

import { AppButton, AppCard } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background p-6">
      <AppCard className="max-w-lg text-center" title="Page Not Found" subtitle="The requested Piriyathu CRM route does not exist.">
        <Link href="/crm"><AppButton variant="outline">Return Home</AppButton></Link>
      </AppCard>
    </main>
  );
}
