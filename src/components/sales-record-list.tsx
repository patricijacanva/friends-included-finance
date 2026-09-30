"use client";

import { useEffect, useState } from "react";

type Salesperson = {
  id: string;
  display_name: string;
};

type SaleRecord = {
  id: string;
  reference: string;
  submittedAt: string;
  project: "A" | "B";
  description: string;
  amountCents: number;
  status: "pending_approval" | "approved";
  syncStatus: "pending" | "failed" | "synced";
};

function euro(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function SalesRecordList({ employee, refreshKey }: { employee: Salesperson; refreshKey: number }) {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function retry(transactionId: string) {
    setRetryingId(transactionId); setError("");
    try {
      const response = await fetch("/api/sheets/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorEmployeeId: employee.id, transactionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to retry synchronization.");
      setSales((current) => current.map((sale) => sale.id === transactionId ? { ...sale, syncStatus: "synced" } : sale));
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Unable to retry synchronization."); }
    finally { setRetryingId(null); }
  }

  useEffect(() => {
    async function loadSales() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/sales/mine?actorEmployeeId=${encodeURIComponent(employee.id)}`, { cache: "no-store" });
        const payload = (await response.json()) as { sales?: SaleRecord[]; error?: string };
        if (!response.ok || !payload.sales) throw new Error(payload.error ?? "Unable to load submitted sales.");
        setSales(payload.sales);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load submitted sales.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadSales();
  }, [employee.id, refreshKey]);

  return (
    <section className="records" aria-labelledby="submitted-sales-heading">
      <h2 id="submitted-sales-heading">Your submitted sales</h2>
      {isLoading ? <p>Loading sales…</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!isLoading && !error && sales.length === 0 ? <p>No sales submitted yet.</p> : null}
      {!isLoading && !error && sales.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Reference</th><th>Project</th><th>Amount</th><th>Status</th><th>Sheets</th><th>Action</th></tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.reference}</td>
                  <td>{sale.project}</td>
                  <td>{euro(sale.amountCents)}</td>
                  <td>{sale.status === "pending_approval" ? "Pending approval" : "Approved"}</td>
                  <td>{sale.syncStatus === "pending" ? "Sync pending" : sale.syncStatus === "failed" ? "Sync failed" : "Synced"}</td>
                  <td>{sale.syncStatus === "synced" ? "—" : <button type="button" onClick={() => void retry(sale.id)} disabled={retryingId === sale.id}>{retryingId === sale.id ? "Retrying…" : "Retry sync"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
