import { NextResponse } from "next/server";
import { requireManager } from "@/lib/manager";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

const isRequiredTestReference = (reference: string) => /^(S0[1-5]|E0[1-7])$/.test(reference);

type Transaction = { id: string; reference: string; source: "website" | "telegram"; submitted_by_employee_id: string };

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");
  if (!actorEmployeeId) return NextResponse.json({ error: "Choose Svetlana as the demonstration role." }, { status: 400 });

  try {
    const { supabase } = await requireManager(actorEmployeeId);
    const [transactionsResult, employeesResult, salesResult, expensesResult, proposalsResult, decisionsResult, allocationsResult, sheetsResult, notificationsResult] = await Promise.all([
      supabase.from("transactions").select("id, reference, source, submitted_by_employee_id"),
      supabase.from("employees").select("id, display_name"),
      supabase.from("sales").select("transaction_id, customer, project, description, amount_cents, status"),
      supabase.from("expenses").select("transaction_id, description, category, amount_cents, proposed_allocation, final_allocation, status"),
      supabase.from("sale_commission_proposals").select("sale_id, richard_percent, anastasia_percent, jean_claude_percent"),
      supabase.from("sale_commission_decisions").select("sale_id, richard_percent, anastasia_percent, jean_claude_percent, pool_cents, richard_commission_cents, anastasia_commission_cents, jean_claude_commission_cents, split_changed"),
      supabase.from("expense_allocation_decisions").select("expense_id, allocation_changed, automatic"),
      supabase.from("sheets_sync_state").select("transaction_id, status"),
      supabase.from("telegram_notification_state").select("transaction_id, notification_kind, status"),
    ]);

    const error = transactionsResult.error ?? employeesResult.error ?? salesResult.error ?? expensesResult.error ?? proposalsResult.error ?? decisionsResult.error ?? allocationsResult.error ?? sheetsResult.error ?? notificationsResult.error;
    if (error) throw error;

    const transactions = transactionsResult.data as Transaction[];
    const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    const employeeName = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee.display_name]));
    const proposalBySale = new Map((proposalsResult.data ?? []).map((proposal) => [proposal.sale_id, proposal]));
    const decisionBySale = new Map((decisionsResult.data ?? []).map((decision) => [decision.sale_id, decision]));
    const allocationByExpense = new Map((allocationsResult.data ?? []).map((allocation) => [allocation.expense_id, allocation]));
    const sheetsByTransaction = new Map((sheetsResult.data ?? []).map((state) => [state.transaction_id, state.status]));
    const notificationsByTransaction = new Map<string, Map<string, string>>();
    for (const notification of notificationsResult.data ?? []) {
      const states = notificationsByTransaction.get(notification.transaction_id) ?? new Map<string, string>();
      states.set(notification.notification_kind, notification.status);
      notificationsByTransaction.set(notification.transaction_id, states);
    }

    const sales = (salesResult.data ?? []).flatMap((sale) => {
      const transaction = transactionById.get(sale.transaction_id);
      const proposal = proposalBySale.get(sale.transaction_id);
      if (!transaction || !proposal) return [];
      const decision = decisionBySale.get(sale.transaction_id);
      const notifications = notificationsByTransaction.get(sale.transaction_id);
      return [{
        id: sale.transaction_id,
        reference: transaction.reference,
        source: transaction.source,
        submitter: employeeName.get(transaction.submitted_by_employee_id) ?? "Unknown employee",
        customer: sale.customer,
        project: sale.project,
        amountCents: sale.amount_cents,
        status: sale.status,
        proposedSplit: [proposal.richard_percent, proposal.anastasia_percent, proposal.jean_claude_percent],
        finalSplit: decision ? [decision.richard_percent, decision.anastasia_percent, decision.jean_claude_percent] : null,
        commissionCents: decision ? [decision.richard_commission_cents, decision.anastasia_commission_cents, decision.jean_claude_commission_cents] : null,
        splitChanged: decision?.split_changed ?? null,
        sheetsStatus: sheetsByTransaction.get(sale.transaction_id) ?? "pending",
        submissionNotification: notifications?.get("submission_confirmation") ?? "not_applicable",
        decisionNotification: notifications?.get("sale_approval") ?? "not_required",
      }];
    }).sort((a, b) => a.reference.localeCompare(b.reference));

    const expenses = (expensesResult.data ?? []).flatMap((expense) => {
      const transaction = transactionById.get(expense.transaction_id);
      if (!transaction) return [];
      const allocation = allocationByExpense.get(expense.transaction_id);
      const notifications = notificationsByTransaction.get(expense.transaction_id);
      return [{
        id: expense.transaction_id,
        reference: transaction.reference,
        source: transaction.source,
        submitter: employeeName.get(transaction.submitted_by_employee_id) ?? "Unknown employee",
        amountCents: expense.amount_cents,
        category: expense.category,
        status: expense.status,
        proposedAllocation: expense.proposed_allocation,
        finalAllocation: expense.final_allocation,
        allocationChanged: allocation?.allocation_changed ?? null,
        automatic: allocation?.automatic ?? false,
        sheetsStatus: sheetsByTransaction.get(expense.transaction_id) ?? "pending",
        submissionNotification: notifications?.get("submission_confirmation") ?? "not_applicable",
        decisionNotification: notifications?.get("expense_allocation") ?? "not_required",
      }];
    }).sort((a, b) => a.reference.localeCompare(b.reference));

    const officialSales = sales.filter((sale) => isRequiredTestReference(sale.reference));
    const officialExpenses = expenses.filter((expense) => isRequiredTestReference(expense.reference));
    const practiceSales = sales.filter((sale) => !isRequiredTestReference(sale.reference));
    const practiceExpenses = expenses.filter((expense) => !isRequiredTestReference(expense.reference));
    const companyResult = (rows: typeof sales, expenseRows: typeof expenses) => {
      const income = rows.filter((sale) => sale.status === "approved").reduce((total, sale) => total + sale.amountCents, 0);
      const commission = rows.reduce((total, sale) => total + (sale.commissionCents?.reduce((sum, cents) => sum + cents, 0) ?? 0), 0);
      const expense = expenseRows.reduce((total, item) => total + item.amountCents, 0);
      return income - commission - expense;
    };

    return NextResponse.json({
      sales: officialSales,
      expenses: officialExpenses,
      practice: {
        salesCount: practiceSales.length,
        expensesCount: practiceExpenses.length,
        companyResultCents: companyResult(practiceSales, practiceExpenses),
      },
    });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to load assignment evidence.";
    if (!(error instanceof SubmissionError)) console.error("Unable to load assignment evidence", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 403 : 500 });
  }
}
