"use client";

import { useEffect, useState } from "react";

type Employee = { id: string };
type Expense = {
  id: string; reference: string; amountCents: number; proposedAllocation: string; finalAllocation: string | null;
  status: "awaiting_allocation" | "allocated_project" | "allocated_overhead"; syncStatus: "pending" | "failed" | "synced";
};

function euro(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function allocationLabel(value: string | null) {
  if (!value) return "—";
  return value === "company_overhead" ? "Company overhead" : `Project ${value}`;
}

export function ExpenseRecordList({ employee, refreshKey }: { employee: Employee; refreshKey: number }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function retry(transactionId: string) {
    setRetryingId(transactionId); setError("");
    try {
      const response = await fetch("/api/sheets/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorEmployeeId: employee.id, transactionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to retry synchronization.");
      setExpenses((current) => current.map((expense) => expense.id === transactionId ? { ...expense, syncStatus: "synced" } : expense));
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Unable to retry synchronization."); }
    finally { setRetryingId(null); }
  }

  useEffect(() => {
    async function loadExpenses() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/expenses/mine?actorEmployeeId=${encodeURIComponent(employee.id)}`, { cache: "no-store" });
        const payload = (await response.json()) as { expenses?: Expense[]; error?: string };
        if (!response.ok || !payload.expenses) throw new Error(payload.error ?? "Unable to load submitted expenses.");
        setExpenses(payload.expenses);
        setError("");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load submitted expenses.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadExpenses();
  }, [employee.id, refreshKey]);

  return (
    <section className="records" aria-labelledby="submitted-expenses-heading">
      <h2 id="submitted-expenses-heading">Your submitted expenses</h2>
      {isLoading ? <p>Loading expenses…</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!isLoading && !error && expenses.length === 0 ? <p>No expenses submitted yet.</p> : null}
      {!isLoading && !error && expenses.length > 0 ? <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Proposed</th><th>Final</th><th>Status</th><th>Sheets</th><th>Action</th></tr></thead><tbody>
        {expenses.map((expense) => <tr key={expense.id}><td>{expense.reference}</td><td>{euro(expense.amountCents)}</td><td>{allocationLabel(expense.proposedAllocation)}</td><td>{allocationLabel(expense.finalAllocation)}</td><td>{expense.status === "awaiting_allocation" ? "Awaiting allocation" : expense.status === "allocated_overhead" ? "Company overhead" : "Allocated"}</td><td>{expense.syncStatus === "pending" ? "Sync pending" : expense.syncStatus === "failed" ? "Sync failed" : "Synced"}</td><td>{expense.syncStatus === "synced" ? "—" : <button type="button" onClick={() => void retry(expense.id)} disabled={retryingId === expense.id}>{retryingId === expense.id ? "Retrying…" : "Retry sync"}</button>}</td></tr>)}
      </tbody></table></div> : null}
    </section>
  );
}
