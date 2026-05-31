import Link from "next/link";

import { AppButton, AppCard, AppPageHeader } from "@/components/ui";
import { EntityIcon } from "@/features/entities/icons";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <AppPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <EntityIcon icon="settings" className="h-5 w-5 text-primary" />
            CRM Settings
          </span>
        }
        subtitle="Piriyathu CRM configuration shortcuts"
      />

      <AppCard title="Administration" subtitle="Business and product administration tasks">
        <div className="flex flex-wrap gap-2">
          <Link href="/crm/admin/users">
            <AppButton size="sm" variant="outline" type="button">
              Manage Users
            </AppButton>
          </Link>
          <Link href="/crm/admin/products">
            <AppButton size="sm" variant="outline" type="button">
              Manage Products
            </AppButton>
          </Link>
          <Link href="/crm/admin/user-product-access">
            <AppButton size="sm" variant="outline" type="button">
              Manage Product User Access
            </AppButton>
          </Link>
        </div>
      </AppCard>
    </div>
  );
}
