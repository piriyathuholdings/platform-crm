"use client";

import { AppBadge, AppCard, AppPageHeader } from "@/components/ui";

const docs = [
  { name: "Master Service Agreement.pdf", owner: "Legal", status: "Approved" },
  { name: "Q2 Proposal - Techflow.pdf", owner: "Sales", status: "Pending" },
  { name: "Implementation Plan.docx", owner: "PMO", status: "In Review" },
  { name: "Security Checklist.xlsx", owner: "Security", status: "Approved" }
];

export default function DocumentsPage() {
  return (
    <div className="space-y-5">
      <AppPageHeader title="Document Library" subtitle="Store and track customer-facing collateral and internal docs." />
      <AppCard>
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.name} className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-text-strong">{doc.name}</p>
                <p className="text-xs text-text-muted">Owner: {doc.owner}</p>
              </div>
              <AppBadge tone={doc.status === "Approved" ? "success" : "warning"}>{doc.status}</AppBadge>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}
