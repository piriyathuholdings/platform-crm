"use client";

import { useCallback, useEffect, useState } from "react";

import { AppAlert, AppBadge, AppButton, AppCard, AppEmptyState, AppPageHeader } from "@/components/ui";
import { useAsyncFeedback } from "@/hooks/useAsyncFeedback";
import { apiFetch } from "@/lib/api-client";

type NotificationItem = {
  id: string;
  event: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const { error, setError, runAction } = useAsyncFeedback();

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: NotificationItem[] }>("/notifications");
      setItems(data.items || []);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function markAllRead() {
    await runAction(async () => {
      await apiFetch("/notifications/mark-read", {
        method: "POST",
        body: JSON.stringify({ all: true })
      });
      await reload();
    });
  }

  return (
    <div className="space-y-5">
      <AppPageHeader
        title="Notifications"
        subtitle="Operational alerts and workflow updates"
        actions={<AppButton variant="outline" onClick={markAllRead}>Mark all read</AppButton>}
      />
      {error ? <AppAlert tone="error">{error}</AppAlert> : null}
      <div className="space-y-3">
        {items.length === 0 ? <AppEmptyState description="No notifications right now." /> : null}
        {items.map((item) => (
          <AppCard key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-strong">{item.subject}</p>
                <p className="mt-1 text-sm text-text-muted">{item.message}</p>
              </div>
              <div className="text-right">
                <AppBadge tone={item.is_read ? "neutral" : "primary"}>{item.is_read ? "Read" : "Unread"}</AppBadge>
                <p className="mt-1 text-xs text-text-muted">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            </div>
          </AppCard>
        ))}
      </div>
    </div>
  );
}
