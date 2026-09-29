"use client";

import { useEffect, useState } from "react";
import { SaleEntryForm } from "@/components/sale-entry-form";
import { SalesRecordList } from "@/components/sales-record-list";
import { ExpenseEntryForm } from "@/components/expense-entry-form";
import { ExpenseRecordList } from "@/components/expense-record-list";
import { ManagerReviewQueue } from "@/components/manager-review-queue";

type Employee = {
  id: string;
  code: string;
  display_name: string;
  role: "manager" | "salesperson" | "expense_reporter";
};

const roleLabel: Record<Employee["role"], string> = {
  manager: "Manager",
  salesperson: "Salesperson",
  expense_reporter: "Expense reporter",
};

export function DemonstrationRoleSelector() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [expensesRefreshKey, setExpensesRefreshKey] = useState(0);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const response = await fetch("/api/employees", { cache: "no-store" });
        const payload = (await response.json()) as { employees?: Employee[]; error?: string };

        if (!response.ok || !payload.employees) {
          throw new Error(payload.error ?? "Unable to load demonstration roles.");
        }

        setEmployees(payload.employees);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load demonstration roles.");
      }
    }

    void loadEmployees();
  }, []);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  return (
    <section aria-labelledby="demonstration-role-heading" className="role-selector">
      <h2 id="demonstration-role-heading">Demonstration role</h2>
      <p>Select a fictional employee to prepare the correct website workspace.</p>

      <label htmlFor="demonstration-role">Employee</label>
      <select
        id="demonstration-role"
        value={selectedEmployeeId}
        onChange={(event) => setSelectedEmployeeId(event.target.value)}
      >
        <option value="">Choose a role</option>
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.display_name} — {roleLabel[employee.role]}
          </option>
        ))}
      </select>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {selectedEmployee ? (
        <p className="selection" aria-live="polite">
          Selected: {selectedEmployee.display_name} ({roleLabel[selectedEmployee.role]}).
        </p>
      ) : null}
      {selectedEmployee?.role === "salesperson" ? (
        <>
          <SaleEntryForm employee={selectedEmployee} onSaved={() => setSalesRefreshKey((current) => current + 1)} />
          <SalesRecordList employee={selectedEmployee} refreshKey={salesRefreshKey} />
        </>
      ) : null}
      {selectedEmployee?.role === "expense_reporter" ? (
        <>
          <ExpenseEntryForm employee={selectedEmployee} onSaved={() => setExpensesRefreshKey((current) => current + 1)} />
          <ExpenseRecordList employee={selectedEmployee} refreshKey={expensesRefreshKey} />
        </>
      ) : null}
      {selectedEmployee?.role === "manager" ? <ManagerReviewQueue manager={selectedEmployee} /> : null}
      <p className="security-note">
        This selector is for the assignment demonstration only. Future server actions verify the selected employee and role again.
      </p>
    </section>
  );
}
