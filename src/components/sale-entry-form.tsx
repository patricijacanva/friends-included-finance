"use client";

import { FormEvent, useState } from "react";

type Salesperson = {
  id: string;
  display_name: string;
};

type FormValues = {
  reference: string;
  customer: string;
  project: "A" | "B";
  description: string;
  amount: string;
  richardPercent: string;
  anastasiaPercent: string;
  jeanClaudePercent: string;
};

const initialValues: FormValues = {
  reference: "",
  customer: "",
  project: "A",
  description: "",
  amount: "",
  richardPercent: "",
  anastasiaPercent: "",
  jeanClaudePercent: "",
};

export function SaleEntryForm({ employee, onSaved }: { employee: Salesperson; onSaved: () => void }) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorEmployeeId: employee.id,
          ...values,
          richardPercent: Number(values.richardPercent),
          anastasiaPercent: Number(values.anastasiaPercent),
          jeanClaudePercent: Number(values.jeanClaudePercent),
        }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) throw new Error(payload.error ?? "Unable to save the sale.");

      setMessage(payload.message ?? "Sale saved.");
      setValues(initialValues);
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the sale.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="transaction-form" aria-labelledby="sale-entry-heading">
      <h2 id="sale-entry-heading">Enter a sale</h2>
      <p>Submitting as {employee.display_name}. The sale will remain pending until Svetlana approves it.</p>
      <form onSubmit={submit}>
        <label htmlFor="sale-reference">Reference</label>
        <input id="sale-reference" value={values.reference} onChange={(event) => updateValue("reference", event.target.value)} required />

        <label htmlFor="sale-customer">Customer</label>
        <input id="sale-customer" value={values.customer} onChange={(event) => updateValue("customer", event.target.value)} required />

        <label htmlFor="sale-project">Project</label>
        <select id="sale-project" value={values.project} onChange={(event) => updateValue("project", event.target.value as "A" | "B")}> 
          <option value="A">A — Respectable Relatives</option>
          <option value="B">B — Drunk University Friends</option>
        </select>

        <label htmlFor="sale-description">Description</label>
        <textarea id="sale-description" value={values.description} onChange={(event) => updateValue("description", event.target.value)} required />

        <label htmlFor="sale-amount">Amount in euros</label>
        <input id="sale-amount" inputMode="decimal" placeholder="1000.00" value={values.amount} onChange={(event) => updateValue("amount", event.target.value)} required />

        <fieldset>
          <legend>Proposed commission split</legend>
          <p>Richard, Anastasia, and Jean-Claude must total exactly 100%.</p>
          <label htmlFor="sale-richard">Richard percentage</label>
          <input id="sale-richard" type="number" min="0" max="100" step="1" value={values.richardPercent} onChange={(event) => updateValue("richardPercent", event.target.value)} required />
          <label htmlFor="sale-anastasia">Anastasia percentage</label>
          <input id="sale-anastasia" type="number" min="0" max="100" step="1" value={values.anastasiaPercent} onChange={(event) => updateValue("anastasiaPercent", event.target.value)} required />
          <label htmlFor="sale-jean-claude">Jean-Claude percentage</label>
          <input id="sale-jean-claude" type="number" min="0" max="100" step="1" value={values.jeanClaudePercent} onChange={(event) => updateValue("jeanClaudePercent", event.target.value)} required />
        </fieldset>

        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save pending sale"}</button>
      </form>
      {message ? <p className={message.startsWith("Sale saved") ? "success" : "error"} role="status">{message}</p> : null}
    </section>
  );
}
