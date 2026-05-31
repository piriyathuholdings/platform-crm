"use client";

import { useSearchParams } from "next/navigation";

import { AppCard, AppPageHeader } from "@/components/ui";
import { NEXUS_SCREEN_MAP } from "@/features/nexus/screen-map";

export default function SearchPage() {
  const params = useSearchParams();
  const q = params.get("q") || "";

  const results = NEXUS_SCREEN_MAP.filter((item) => item.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <AppPageHeader title="Search Results" subtitle={q ? `Showing matches for "${q}"` : "Try searching a module, page, or flow."} />
      <AppCard>
        <div className="space-y-2">
          {results.map((item) => (
            <div key={item.stitchScreen} className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-sm font-semibold text-text-strong">{item.title}</p>
              <p className="text-xs text-text-muted">{item.route}</p>
            </div>
          ))}
          {results.length === 0 ? <p className="text-sm text-text-muted">No route-level matches found.</p> : null}
        </div>
      </AppCard>
    </div>
  );
}
