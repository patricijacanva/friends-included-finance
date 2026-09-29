"use client";

import { FormEvent, useState } from "react";

type Employee = { id: string; display_name: string };

const initialValues = { reference: "", description: "", category: "materials", amount: "", proposedAllocation: "A" };

export function ExpenseEntryForm({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorEmployeeId: employee.id, ...values }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save the expense.");
      setMessage(payload.message ?? "Expense saved.");
      setValues(initialValues);
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the expense.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="transaction-form" aria-labelledby="expense-entry-heading">
      <h2 id="expense-entry-heading">Enter an expense</h2>
      <p>Submitting as {employee.display_name}. Project expenses await Svetlana’s allocation; company overhead is allocated immediately.</p>
      <form onSubmit={submit}>
        <label htmlFor="expense-reference">Reference</label>
        <input id="expense-reference" value={values.reference} onChange={(event) => setValues((current) => ({ ...current, reference: event.target.value }))} required />
        <label htmlFor="expense-description">Description</label>
        <textarea id="expense-description" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} required />
        <label htmlFor="expense-category">Category</label>
        <select id="expense-category" value={values.category} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))}>
          <option value="materials">Materials</option><option value="travel">Travel</option><option value="other">Other</option>
        </select>
        <label htmlFor="expense-amount">Amount in euros</label>
        <input id="expense-amount" inputMode="decimal" placeholder="120.00" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} required />
        <label htmlFor="expense-allocation">Proposed allocation</label>
        <select id="expense-allocation" value={values.proposedAllocation} onChange={(event) => setValues((current) => ({ ...current, proposedAllocation: event.target.value }))}>
          <option value="A">A — Respectable Relatives</option><option value="B">B — Drunk University Friends</option><option value="company_overhead">Company overhead</option>
        </select>
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save expense"}</button>
      </form>
      {message ? <p className={message.startsWith("Expense saved") ? "success" : "error"} role="status">{message}</p> : null}
    </section>
  );
}
