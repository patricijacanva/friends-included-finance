"use client";

import { useEffect, useState } from "react";
import { ExpenseDecisionControls, SaleDecisionControls } from "@/components/manager-decision-controls";
import { FinancialDashboard } from "@/components/financial-dashboard";
import { TelegramSetup } from "@/components/telegram-setup";

type Manager = { id: string; display_name: string };
type PendingSale = { id: string; reference: string; salesperson: string; customer: string; project: string; description: string; amountCents: number; proposedSplit: number[] };
type PendingExpense = { id: string; reference: string; reporter: string; description: string; category: string; amountCents: number; proposedAllocation: string };

function euro(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function allocationLabel(value: string) {
  return value === "company_overhead" ? "Company overhead" : `Project ${value}`;
}

export function ManagerReviewQueue({ manager }: { manager: Manager }) {
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      try {
        const response = await fetch(`/api/manager/pending?actorEmployeeId=${encodeURIComponent(manager.id)}`, { cache: "no-store" });
        const payload = (await response.json()) as { sales?: PendingSale[]; expenses?: PendingExpense[]; error?: string };
        if (!response.ok || !payload.sales || !payload.expenses) throw new Error(payload.error ?? "Unable to load pending transactions.");
        setSales(payload.sales);
        setExpenses(payload.expenses);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load pending transactions.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadQueue();
  }, [manager.id, refreshKey]);

  return (
    <section className="manager-queue" aria-labelledby="manager-queue-heading">
      <FinancialDashboard managerId={manager.id} refreshKey={refreshKey} />
      <TelegramSetup managerId={manager.id} />
      <h2 id="manager-queue-heading">Manager review queue</h2>
      <p>Review original submissions before approving or correcting them.</p>
      {isLoading ? <p>Loading pending transactions…</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!isLoading && !error && sales.length === 0 && expenses.length === 0 ? <p>No pending transactions.</p> : null}
      {sales.length > 0 ? <><h3>Pending sales</h3><div className="queue-list">{sales.map((sale) => <article className="queue-card" key={sale.id}><h4>{sale.reference} — {euro(sale.amountCents)}</h4><p>{sale.salesperson} · Customer: {sale.customer} · Project {sale.project}</p><p>{sale.description}</p><p><strong>Original split:</strong> Richard {sale.proposedSplit[0]}% / Anastasia {sale.proposedSplit[1]}% / Jean-Claude {sale.proposedSplit[2]}%</p><SaleDecisionControls managerId={manager.id} sale={sale} onSaved={() => setRefreshKey((value) => value + 1)} /></article>)}</div></> : null}
      {expenses.length > 0 ? <><h3>Expenses awaiting allocation</h3><div className="queue-list">{expenses.map((expense) => <article className="queue-card" key={expense.id}><h4>{expense.reference} — {euro(expense.amountCents)}</h4><p>{expense.reporter} · {expense.category}</p><p>{expense.description}</p><p><strong>Proposed allocation:</strong> {allocationLabel(expense.proposedAllocation)}</p><ExpenseDecisionControls managerId={manager.id} expense={expense} onSaved={() => setRefreshKey((value) => value + 1)} /></article>)}</div></> : null}
    </section>
  );
}
