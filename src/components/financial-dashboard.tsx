"use client";

import { useEffect, useState } from "react";

type Dashboard = {
  projectA: Totals; projectB: Totals;
  company: { approvedIncomeCents: number; totalCommissionCents: number; companyOverheadCents: number; awaitingAllocationCents: number; resultCents: number };
  commissionEarned: { richardCents: number; anastasiaCents: number; jeanClaudeCents: number };
  pendingSales: number; awaitingExpenses: number;
};
type Totals = { incomeCents: number; commissionCents: number; allocatedExpenseCents: number; resultCents: number };

function euro(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function ProjectTable({ name, totals }: { name: string; totals: Totals }) {
  return <section className="dashboard-card"><h3>{name}</h3><dl><dt>Approved income</dt><dd>{euro(totals.incomeCents)}</dd><dt>Commission expense</dt><dd>{euro(totals.commissionCents)}</dd><dt>Allocated project expenses</dt><dd>{euro(totals.allocatedExpenseCents)}</dd><dt>Result</dt><dd><strong>{euro(totals.resultCents)}</strong></dd></dl></section>;
}

export function FinancialDashboard({ managerId, refreshKey }: { managerId: string; refreshKey: number }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(`/api/manager/dashboard?actorEmployeeId=${encodeURIComponent(managerId)}`, { cache: "no-store" });
        const payload = (await response.json()) as Dashboard & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the financial dashboard.");
        setDashboard(payload); setError("");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load the financial dashboard.");
      }
    }
    void loadDashboard();
  }, [managerId, refreshKey]);

  return <section className="dashboard" aria-labelledby="dashboard-heading"><h2 id="dashboard-heading">Financial dashboard</h2>{error ? <p className="error" role="alert">{error}</p> : null}{!dashboard && !error ? <p>Loading financial results…</p> : null}{dashboard ? <><div className="dashboard-grid"><ProjectTable name="Project A — Respectable Relatives" totals={dashboard.projectA} /><ProjectTable name="Project B — Drunk University Friends" totals={dashboard.projectB} /><section className="dashboard-card"><h3>Company</h3><dl><dt>Company overhead</dt><dd>{euro(dashboard.company.companyOverheadCents)}</dd><dt>Expenses awaiting allocation</dt><dd>{euro(dashboard.company.awaitingAllocationCents)}</dd><dt>Total company result</dt><dd><strong>{euro(dashboard.company.resultCents)}</strong></dd></dl></section></div><section className="dashboard-card"><h3>Commission earned</h3><dl><dt>Richard</dt><dd>{euro(dashboard.commissionEarned.richardCents)}</dd><dt>Anastasia</dt><dd>{euro(dashboard.commissionEarned.anastasiaCents)}</dd><dt>Jean-Claude</dt><dd>{euro(dashboard.commissionEarned.jeanClaudeCents)}</dd><dt>Total</dt><dd><strong>{euro(dashboard.company.totalCommissionCents)}</strong></dd></dl></section><p className="dashboard-summary">Pending sales: {dashboard.pendingSales} · Expenses awaiting allocation: {dashboard.awaitingExpenses}</p></> : null}</section>;
}
