"use client";

import { useEffect, useMemo, useState } from "react";

import { AppAlert, AppCard, AppPageHeader, AppSelect } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

type TrendPoint = {
  label: string;
  leads?: number;
  won_deals?: number;
  collections?: number;
  expenses?: number;
};

type StagePoint = {
  stage: string;
  count: number;
  value: number;
};

type DashboardData = {
  kpis: {
    total_leads: number;
    total_deals: number;
    total_tasks: number;
    open_pipeline_value: number;
    net_collections: number;
  };
  charts: {
    lead_vs_won_trend: TrendPoint[];
    deal_stage_distribution: StagePoint[];
    collections_vs_expenses_trend: TrendPoint[];
  };
  insights: {
    conversion: {
      lead_to_deal_rate: number;
      win_rate: number;
      won_deals: number;
      closed_deals: number;
    };
    task_health: {
      open: number;
      overdue: number;
      completed: number;
    };
    pipeline_cashflow: {
      open_pipeline_value: number;
      collected_amount: number;
      expense_amount: number;
      net_collections: number;
    };
  };
};

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatPercent(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState("month");

  useEffect(() => {
    apiFetch<DashboardData>("/dashboard/metrics", { method: "POST", body: JSON.stringify({ date_preset: datePreset }) })
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [datePreset]);

  const maxLeadWon = useMemo(() => {
    const rows = data?.charts.lead_vs_won_trend || [];
    return Math.max(1, ...rows.map((row) => Math.max(Number(row.leads || 0), Number(row.won_deals || 0))));
  }, [data?.charts.lead_vs_won_trend]);

  const maxCollectionExpense = useMemo(() => {
    const rows = data?.charts.collections_vs_expenses_trend || [];
    return Math.max(1, ...rows.map((row) => Math.max(Number(row.collections || 0), Number(row.expenses || 0))));
  }, [data?.charts.collections_vs_expenses_trend]);

  const maxStageCount = useMemo(() => {
    const rows = data?.charts.deal_stage_distribution || [];
    return Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  }, [data?.charts.deal_stage_distribution]);

  return (
    <div className="space-y-4">
      <AppPageHeader
        title="Dashboard"
        subtitle="Sales and operations insights for Piriyathu CRM"
        actions={
          <AppSelect value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </AppSelect>
        }
      />

      {error ? <AppAlert tone="error">{error}</AppAlert> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <AppCard>
          <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Leads</p>
          <p className="text-2xl font-bold text-text-strong">{formatNumber(data?.kpis.total_leads || 0)}</p>
          <p className="text-xs text-text-muted">In selected range</p>
        </AppCard>
        <AppCard>
          <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Deals</p>
          <p className="text-2xl font-bold text-text-strong">{formatNumber(data?.kpis.total_deals || 0)}</p>
          <p className="text-xs text-text-muted">In selected range</p>
        </AppCard>
        <AppCard>
          <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Tasks</p>
          <p className="text-2xl font-bold text-text-strong">{formatNumber(data?.kpis.total_tasks || 0)}</p>
          <p className="text-xs text-text-muted">In selected range</p>
        </AppCard>
        <AppCard>
          <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Open Pipeline</p>
          <p className="text-2xl font-bold text-text-strong">{formatCurrency(data?.kpis.open_pipeline_value || 0)}</p>
          <p className="text-xs text-text-muted">Deal value in progress</p>
        </AppCard>
        <AppCard>
          <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Net Cashflow</p>
          <p className="text-2xl font-bold text-text-strong">{formatCurrency(data?.kpis.net_collections || 0)}</p>
          <p className="text-xs text-text-muted">Collections minus expenses</p>
        </AppCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <AppCard className="lg:col-span-3" title="Lead vs Won Trend" subtitle="Leads created vs won deals">
          {(data?.charts.lead_vs_won_trend || []).length === 0 ? (
            <p className="text-sm text-text-muted">No data available for this range.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {(data?.charts.lead_vs_won_trend || []).map((point) => {
                const leadHeight = Math.max(6, Math.round((Number(point.leads || 0) / maxLeadWon) * 84));
                const wonHeight = Math.max(6, Math.round((Number(point.won_deals || 0) / maxLeadWon) * 84));
                return (
                  <div key={point.label} className="rounded-lg border border-base-300 bg-base-100 px-2 py-2">
                    <div className="mb-2 flex h-[90px] items-end gap-1">
                      <div className="w-1/2 rounded-sm bg-primary/85" style={{ height: `${leadHeight}%` }} title={`Leads: ${point.leads || 0}`} />
                      <div className="w-1/2 rounded-sm bg-success/80" style={{ height: `${wonHeight}%` }} title={`Won: ${point.won_deals || 0}`} />
                    </div>
                    <p className="truncate text-[11px] text-text-muted">{point.label}</p>
                    <p className="text-[11px] font-medium text-text-default">
                      L: {point.leads || 0} | W: {point.won_deals || 0}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>

        <AppCard className="lg:col-span-2" title="Deal Stage Funnel" subtitle="Stage count and value distribution">
          {(data?.charts.deal_stage_distribution || []).length === 0 ? (
            <p className="text-sm text-text-muted">No stage data available.</p>
          ) : (
            <div className="space-y-2">
              {(data?.charts.deal_stage_distribution || []).map((stage) => {
                const width = Math.max(6, Math.round((Number(stage.count || 0) / maxStageCount) * 100));
                return (
                  <div key={stage.stage}>
                    <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                      <span>{stage.stage}</span>
                      <span>
                        {stage.count} • {formatCurrency(stage.value || 0)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-base-200">
                      <div className="h-2 rounded-full bg-secondary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AppCard className="lg:col-span-2" title="Collections vs Expenses" subtitle="Cash movement trend">
          {(data?.charts.collections_vs_expenses_trend || []).length === 0 ? (
            <p className="text-sm text-text-muted">No payment and expense data available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {(data?.charts.collections_vs_expenses_trend || []).map((point) => {
                const collectionHeight = Math.max(6, Math.round((Number(point.collections || 0) / maxCollectionExpense) * 84));
                const expenseHeight = Math.max(6, Math.round((Number(point.expenses || 0) / maxCollectionExpense) * 84));
                return (
                  <div key={point.label} className="rounded-lg border border-base-300 bg-base-100 px-2 py-2">
                    <div className="mb-2 flex h-[90px] items-end gap-1">
                      <div
                        className="w-1/2 rounded-sm bg-success/85"
                        style={{ height: `${collectionHeight}%` }}
                        title={`Collections: ${point.collections || 0}`}
                      />
                      <div
                        className="w-1/2 rounded-sm bg-warning/80"
                        style={{ height: `${expenseHeight}%` }}
                        title={`Expenses: ${point.expenses || 0}`}
                      />
                    </div>
                    <p className="truncate text-[11px] text-text-muted">{point.label}</p>
                    <p className="text-[11px] font-medium text-text-default">
                      C: {formatNumber(point.collections || 0)} | E: {formatNumber(point.expenses || 0)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </AppCard>

        <AppCard title="Actionable Insights" subtitle="Conversion, execution, and cashflow snapshots">
          <div className="space-y-3 text-sm text-text-default">
            <div className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Conversion</p>
              <p className="font-semibold">Lead → Deal: {formatPercent(data?.insights.conversion.lead_to_deal_rate || 0)}</p>
              <p className="font-semibold">Win Rate: {formatPercent(data?.insights.conversion.win_rate || 0)}</p>
              <p className="text-xs text-text-muted">
                Won {data?.insights.conversion.won_deals || 0} / Closed {data?.insights.conversion.closed_deals || 0}
              </p>
            </div>

            <div className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Task Health</p>
              <p>Open: {data?.insights.task_health.open || 0}</p>
              <p>Overdue: {data?.insights.task_health.overdue || 0}</p>
              <p>Completed: {data?.insights.task_health.completed || 0}</p>
            </div>

            <div className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.1em] text-text-muted">Pipeline & Cashflow</p>
              <p>Open Pipeline: {formatCurrency(data?.insights.pipeline_cashflow.open_pipeline_value || 0)}</p>
              <p>Collections: {formatCurrency(data?.insights.pipeline_cashflow.collected_amount || 0)}</p>
              <p>Expenses: {formatCurrency(data?.insights.pipeline_cashflow.expense_amount || 0)}</p>
              <p className="font-semibold">Net: {formatCurrency(data?.insights.pipeline_cashflow.net_collections || 0)}</p>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
