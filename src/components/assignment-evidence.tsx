"use client";

import { useEffect, useState } from "react";

type Sale = {
  id: string; reference: string; source: "website" | "telegram"; submitter: string; customer: string; project: string; amountCents: number; status: "pending_approval" | "approved";
  proposedSplit: number[]; finalSplit: number[] | null; commissionCents: number[] | null; splitChanged: boolean | null; sheetsStatus: string; submissionNotification: string; decisionNotification: string;
};
type Expense = {
  id: string; reference: string; source: "website" | "telegram"; submitter: string; amountCents: number; category: string; status: string;
  proposedAllocation: string; finalAllocation: string | null; allocationChanged: boolean | null; automatic: boolean; sheetsStatus: string; submissionNotification: string; decisionNotification: string;
};
type Evidence = { sales: Sale[]; expenses: Expense[]; practice: { salesCount: number; expensesCount: number; companyResultCents: number }; error?: string };

function euro(cents: number) { return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100); }
function split(values: number[] | null) { return values ? `${values[0]} / ${values[1]} / ${values[2]}%` : "—"; }
function allocation(value: string | null) { return value === null ? "—" : value === "company_overhead" ? "Company overhead" : `Project ${value}`; }
function status(value: string) { return value.replaceAll("_", " "); }

export function AssignmentEvidence({ managerId, refreshKey }: { managerId: string; refreshKey: number }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/manager/assignment-evidence?actorEmployeeId=${encodeURIComponent(managerId)}`, { cache: "no-store" });
        const payload = await response.json() as Evidence;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load assignment evidence.");
        setEvidence(payload); setError("");
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load assignment evidence."); }
    }
    void load();
  }, [managerId, refreshKey]);

  return <section className="assignment-evidence" aria-labelledby="assignment-evidence-heading">
    <h2 id="assignment-evidence-heading">Assignment test evidence</h2>
    <p>This section reads the saved Supabase records for the required references only: S01–S05 and E01–E07. It does not calculate from pre-filled expected results.</p>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {!evidence && !error ? <p>Loading required test records…</p> : null}
    {evidence ? <>
      <p className="practice-note">Additional practice records are retained separately: {evidence.practice.salesCount} sale(s), {evidence.practice.expensesCount} expense(s). They remain in the live dashboard, with an actual combined company-result effect of {euro(evidence.practice.companyResultCents)}.</p>
      <h3>Sales S01–S05</h3>
      <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Source</th><th>Original split R / A / J</th><th>Final split R / A / J</th><th>Commission R / A / J</th><th>Status</th><th>Sheets</th><th>Telegram</th></tr></thead><tbody>
        {evidence.sales.length === 0 ? <tr><td colSpan={8}>No required sales have been saved yet.</td></tr> : evidence.sales.map((sale) => <tr key={sale.id}><td>{sale.reference}</td><td>{sale.source}</td><td>{split(sale.proposedSplit)}</td><td>{split(sale.finalSplit)}{sale.splitChanged === true ? " (changed)" : ""}</td><td>{sale.commissionCents ? sale.commissionCents.map(euro).join(" / ") : "€0.00 / €0.00 / €0.00"}</td><td>{status(sale.status)}</td><td>{status(sale.sheetsStatus)}</td><td>Submit: {status(sale.submissionNotification)}; decision: {status(sale.decisionNotification)}</td></tr>)}
      </tbody></table></div>
      <h3>Expenses E01–E07</h3>
      <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Source</th><th>Original proposal</th><th>Final allocation</th><th>Status</th><th>Sheets</th><th>Telegram</th></tr></thead><tbody>
        {evidence.expenses.length === 0 ? <tr><td colSpan={7}>No required expenses have been saved yet.</td></tr> : evidence.expenses.map((expense) => <tr key={expense.id}><td>{expense.reference}</td><td>{expense.source}</td><td>{allocation(expense.proposedAllocation)}</td><td>{allocation(expense.finalAllocation)}{expense.allocationChanged === true ? " (changed)" : ""}</td><td>{status(expense.status)}</td><td>{status(expense.sheetsStatus)}</td><td>Submit: {status(expense.submissionNotification)}; decision: {status(expense.decisionNotification)}</td></tr>)}
      </tbody></table></div>
    </> : null}
  </section>;
}
