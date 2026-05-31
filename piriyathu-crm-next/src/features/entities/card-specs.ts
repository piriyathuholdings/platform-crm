export type CardTone = "neutral" | "primary" | "secondary" | "success" | "warning" | "error";

export type ModuleCardSpec = {
  id: string;
  title: string;
  subtitle: string;
  priority: number;
  tone?: CardTone;
};

export const MODULE_CARD_SPECS: Record<string, ModuleCardSpec[]> = {
  leads: [
    { id: "total_leads", title: "Total Leads", subtitle: "Visible in current scope", priority: 1, tone: "primary" },
    { id: "new_this_week", title: "New This Week", subtitle: "Created in last 7 days", priority: 2, tone: "success" },
    { id: "qualified_ratio", title: "Qualified Ratio", subtitle: "Qualification and beyond", priority: 3, tone: "secondary" },
    { id: "aging_leads", title: "Aging Leads", subtitle: "No updates in 14+ days", priority: 4, tone: "warning" },
    { id: "top_source", title: "Top Source", subtitle: "Most productive acquisition channel", priority: 5, tone: "neutral" }
  ],
  deals: [
    { id: "open_pipeline", title: "Open Pipeline", subtitle: "Open deal value", priority: 1, tone: "primary" },
    { id: "weighted_pipeline", title: "Weighted Pipeline", subtitle: "Value weighted by probability", priority: 2, tone: "secondary" },
    { id: "win_rate", title: "Win Rate", subtitle: "Won over closed deals", priority: 3, tone: "success" },
    { id: "stuck_deals", title: "Stuck Deals", subtitle: "No updates in 14+ days", priority: 4, tone: "warning" },
    { id: "forecast_month", title: "Forecast (30 Days)", subtitle: "Expected closure value", priority: 5, tone: "neutral" }
  ],
  organizations: [
    { id: "total_orgs", title: "Total Organizations", subtitle: "Visible in current scope", priority: 1, tone: "primary" },
    { id: "new_this_period", title: "New (30 Days)", subtitle: "Recently created organizations", priority: 2, tone: "success" },
    { id: "orgs_with_open_deals", title: "With Open Deals", subtitle: "Organizations in pipeline", priority: 3, tone: "secondary" },
    { id: "deep_relationships", title: "3+ Contacts", subtitle: "Relationship depth", priority: 4, tone: "neutral" },
    { id: "stale_orgs", title: "Stale Organizations", subtitle: "No updates in 30+ days", priority: 5, tone: "warning" }
  ],
  tasks: [
    { id: "open_tasks", title: "Open Tasks", subtitle: "Pending execution", priority: 1, tone: "primary" },
    { id: "overdue_tasks", title: "Overdue", subtitle: "Due date elapsed", priority: 2, tone: "error" },
    { id: "due_this_week", title: "Due This Week", subtitle: "Upcoming commitments", priority: 3, tone: "warning" },
    { id: "completion_rate", title: "Completion Rate", subtitle: "Closed over total tasks", priority: 4, tone: "success" },
    { id: "assignee_load", title: "Top Assignee Load", subtitle: "Highest open workload", priority: 5, tone: "neutral" }
  ],
  notes: [
    { id: "notes_total", title: "Notes Total", subtitle: "Visible notes", priority: 1, tone: "primary" },
    { id: "new_this_period", title: "New (30 Days)", subtitle: "Recently created notes", priority: 2, tone: "success" },
    { id: "linked_ratio", title: "Linked Ratio", subtitle: "Attached to lead/deal/contact/org", priority: 3, tone: "secondary" },
    { id: "orphan_notes", title: "Orphan Notes", subtitle: "No linked CRM entity", priority: 4, tone: "warning" },
    { id: "followups_due", title: "Follow-ups Due", subtitle: "Follow-up date reached", priority: 5, tone: "neutral" }
  ],
  expenses: [
    { id: "total_expense", title: "Expense Total (30 Days)", subtitle: "Recorded amount", priority: 1, tone: "primary" },
    { id: "approved_ratio", title: "Approved Ratio", subtitle: "Approved over submitted", priority: 2, tone: "success" },
    { id: "pending_count", title: "Pending", subtitle: "Awaiting review", priority: 3, tone: "warning" },
    { id: "top_scope", title: "Top Scope", subtitle: "Company vs deal", priority: 4, tone: "secondary" },
    { id: "high_value_count", title: "High Value Items", subtitle: "Amount >= 10,000", priority: 5, tone: "neutral" }
  ],
  "client-payments": [
    { id: "collected_30d", title: "Collected (30 Days)", subtitle: "Total posted amount", priority: 1, tone: "primary" },
    { id: "pending_payments", title: "Pending Payments", subtitle: "Awaiting confirmation", priority: 2, tone: "warning" },
    { id: "on_time_ratio", title: "On-time Ratio", subtitle: "Processed in 30 days", priority: 3, tone: "success" },
    { id: "overdue_like", title: "Overdue / Failed", subtitle: "Payment risk indicator", priority: 4, tone: "error" },
    { id: "average_payment", title: "Average Payment", subtitle: "Mean transaction amount", priority: 5, tone: "secondary" }
  ],
  "call-logs": [
    { id: "calls_total", title: "Total Calls", subtitle: "Visible call logs", priority: 1, tone: "primary" },
    { id: "connected_ratio", title: "Connected Ratio", subtitle: "Completed over all calls", priority: 2, tone: "success" },
    { id: "open_followups", title: "Open Follow-ups", subtitle: "Scheduled/next action required", priority: 3, tone: "warning" },
    { id: "calls_this_week", title: "Calls This Week", subtitle: "Recent outreach", priority: 4, tone: "secondary" },
    { id: "top_owner_volume", title: "Top Owner Volume", subtitle: "Highest call ownership", priority: 5, tone: "neutral" }
  ]
};

export function getModuleCardSpecs(entity: string): ModuleCardSpec[] {
  return MODULE_CARD_SPECS[entity] || [];
}
