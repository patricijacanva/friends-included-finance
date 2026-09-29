"use client";

import { FormEvent, useState } from "react";

type Sale = { id: string; reference: string; proposedSplit: number[] };
type Expense = { id: string; reference: string; proposedAllocation: string };

export function SaleDecisionControls({ managerId, sale, onSaved }: { managerId: string; sale: Sale; onSaved: () => void }) {
  const [split, setSplit] = useState(sale.proposedSplit.map(String));
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSaving(true); setMessage("");
    try {
      const response = await fetch("/api/manager/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sale", actorEmployeeId: managerId, saleId: sale.id, richardPercent: Number(split[0]), anastasiaPercent: Number(split[1]), jeanClaudePercent: Number(split[2]) }) });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to approve sale.");
      setMessage(payload.message ?? "Sale approved."); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to approve sale."); } finally { setIsSaving(false); }
  }
  return <form className="decision-form" onSubmit={submit}><p><strong>Final split</strong></p><div className="split-inputs"><label>Richard<input type="number" min="0" max="100" value={split[0]} onChange={(event) => setSplit((current) => [event.target.value, current[1], current[2]])} required /></label><label>Anastasia<input type="number" min="0" max="100" value={split[1]} onChange={(event) => setSplit((current) => [current[0], event.target.value, current[2]])} required /></label><label>Jean-Claude<input type="number" min="0" max="100" value={split[2]} onChange={(event) => setSplit((current) => [current[0], current[1], event.target.value])} required /></label></div><button disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Approve sale"}</button>{message ? <p className={message.includes("approved") ? "success" : "error"}>{message}</p> : null}</form>;
}

export function ExpenseDecisionControls({ managerId, expense, onSaved }: { managerId: string; expense: Expense; onSaved: () => void }) {
  const [allocation, setAllocation] = useState(expense.proposedAllocation);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSaving(true); setMessage("");
    try {
      const response = await fetch("/api/manager/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "expense", actorEmployeeId: managerId, expenseId: expense.id, finalAllocation: allocation }) });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to allocate expense.");
      setMessage(payload.message ?? "Expense allocation saved."); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to allocate expense."); } finally { setIsSaving(false); }
  }
  return <form className="decision-form" onSubmit={submit}><label htmlFor={`allocation-${expense.id}`}>Final allocation</label><select id={`allocation-${expense.id}`} value={allocation} onChange={(event) => setAllocation(event.target.value)}><option value="A">A — Respectable Relatives</option><option value="B">B — Drunk University Friends</option><option value="company_overhead">Company overhead</option></select><button disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Confirm allocation"}</button>{message ? <p className={message.includes("saved") ? "success" : "error"}>{message}</p> : null}</form>;
}
