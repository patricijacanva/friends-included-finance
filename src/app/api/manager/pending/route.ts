import { NextResponse } from "next/server";
import { requireManager } from "@/lib/manager";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

type TransactionInfo = { id: string; reference: string; submitted_at: string; submitted_by_employee_id: string };

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");
  if (!actorEmployeeId) return NextResponse.json({ error: "Choose Svetlana as the demonstration role." }, { status: 400 });

  try {
    const { supabase } = await requireManager(actorEmployeeId);
    const [salesResult, expensesResult] = await Promise.all([
      supabase.from("sales").select("transaction_id, customer, project, description, amount_cents").eq("status", "pending_approval"),
      supabase.from("expenses").select("transaction_id, description, category, amount_cents, proposed_allocation").eq("status", "awaiting_allocation"),
    ]);
    if (salesResult.error) throw salesResult.error;
    if (expensesResult.error) throw expensesResult.error;

    const saleIds = salesResult.data.map((sale) => sale.transaction_id);
    const expenseIds = expensesResult.data.map((expense) => expense.transaction_id);
    const allTransactionIds = [...saleIds, ...expenseIds];

    const transactionsResult = allTransactionIds.length > 0
      ? await supabase.from("transactions").select("id, reference, submitted_at, submitted_by_employee_id").in("id", allTransactionIds)
      : { data: [], error: null };
    if (transactionsResult.error) throw transactionsResult.error;

    const transactions = new Map((transactionsResult.data as TransactionInfo[]).map((transaction) => [transaction.id, transaction]));
    const submitterIds = [...new Set((transactionsResult.data as TransactionInfo[]).map((transaction) => transaction.submitted_by_employee_id))];
    const employeesResult = submitterIds.length > 0
      ? await supabase.from("employees").select("id, display_name").in("id", submitterIds)
      : { data: [], error: null };
    if (employeesResult.error) throw employeesResult.error;
    const employeeNames = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee.display_name]));

    const proposalsResult = saleIds.length > 0
      ? await supabase.from("sale_commission_proposals").select("sale_id, richard_percent, anastasia_percent, jean_claude_percent").in("sale_id", saleIds)
      : { data: [], error: null };
    if (proposalsResult.error) throw proposalsResult.error;
    const proposals = new Map((proposalsResult.data ?? []).map((proposal) => [proposal.sale_id, proposal]));

    return NextResponse.json({
      sales: salesResult.data.flatMap((sale) => {
        const transaction = transactions.get(sale.transaction_id);
        const proposal = proposals.get(sale.transaction_id);
        if (!transaction || !proposal) return [];
        return [{
          id: sale.transaction_id,
          reference: transaction.reference,
          salesperson: employeeNames.get(transaction.submitted_by_employee_id) ?? "Unknown employee",
          customer: sale.customer,
          project: sale.project,
          description: sale.description,
          amountCents: sale.amount_cents,
          proposedSplit: [proposal.richard_percent, proposal.anastasia_percent, proposal.jean_claude_percent],
        }];
      }),
      expenses: expensesResult.data.flatMap((expense) => {
        const transaction = transactions.get(expense.transaction_id);
        if (!transaction) return [];
        return [{
          id: expense.transaction_id,
          reference: transaction.reference,
          reporter: employeeNames.get(transaction.submitted_by_employee_id) ?? "Unknown employee",
          description: expense.description,
          category: expense.category,
          amountCents: expense.amount_cents,
          proposedAllocation: expense.proposed_allocation,
        }];
      }),
    });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to load pending transactions.";
    if (!(error instanceof SubmissionError)) console.error("Unable to load manager queue", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 403 : 500 });
  }
}
