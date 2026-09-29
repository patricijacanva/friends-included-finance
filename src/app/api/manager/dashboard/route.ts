import { NextResponse } from "next/server";
import { requireManager } from "@/lib/manager";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

type ProjectTotals = { incomeCents: number; commissionCents: number; allocatedExpenseCents: number; resultCents: number };

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");
  if (!actorEmployeeId) return NextResponse.json({ error: "Choose Svetlana as the demonstration role." }, { status: 400 });

  try {
    const { supabase } = await requireManager(actorEmployeeId);
    const [salesResult, decisionsResult, expensesResult] = await Promise.all([
      supabase.from("sales").select("transaction_id, project, amount_cents, status"),
      supabase.from("sale_commission_decisions").select("sale_id, pool_cents, richard_commission_cents, anastasia_commission_cents, jean_claude_commission_cents"),
      supabase.from("expenses").select("amount_cents, final_allocation, status"),
    ]);
    if (salesResult.error) throw salesResult.error;
    if (decisionsResult.error) throw decisionsResult.error;
    if (expensesResult.error) throw expensesResult.error;

    const projectA: ProjectTotals = { incomeCents: 0, commissionCents: 0, allocatedExpenseCents: 0, resultCents: 0 };
    const projectB: ProjectTotals = { incomeCents: 0, commissionCents: 0, allocatedExpenseCents: 0, resultCents: 0 };
    const projectFor = (project: "A" | "B") => project === "A" ? projectA : projectB;
    const salesById = new Map(salesResult.data.map((sale) => [sale.transaction_id, sale]));

    let approvedIncomeCents = 0;
    let totalCommissionCents = 0;
    let companyOverheadCents = 0;
    let awaitingAllocationCents = 0;
    let allExpenseCents = 0;

    for (const sale of salesResult.data) {
      if (sale.status === "approved") {
        projectFor(sale.project).incomeCents += sale.amount_cents;
        approvedIncomeCents += sale.amount_cents;
      }
    }

    const commissionEarned = { richardCents: 0, anastasiaCents: 0, jeanClaudeCents: 0 };
    for (const decision of decisionsResult.data) {
      const sale = salesById.get(decision.sale_id);
      if (!sale || sale.status !== "approved") continue;
      projectFor(sale.project).commissionCents += decision.pool_cents;
      totalCommissionCents += decision.pool_cents;
      commissionEarned.richardCents += decision.richard_commission_cents;
      commissionEarned.anastasiaCents += decision.anastasia_commission_cents;
      commissionEarned.jeanClaudeCents += decision.jean_claude_commission_cents;
    }

    for (const expense of expensesResult.data) {
      allExpenseCents += expense.amount_cents;
      if (expense.status === "awaiting_allocation") awaitingAllocationCents += expense.amount_cents;
      if (expense.final_allocation === "company_overhead") companyOverheadCents += expense.amount_cents;
      if (expense.final_allocation === "A" || expense.final_allocation === "B") {
        projectFor(expense.final_allocation).allocatedExpenseCents += expense.amount_cents;
      }
    }

    for (const project of [projectA, projectB]) {
      project.resultCents = project.incomeCents - project.commissionCents - project.allocatedExpenseCents;
    }

    const pendingSales = salesResult.data.filter((sale) => sale.status === "pending_approval").length;
    return NextResponse.json({
      projectA,
      projectB,
      company: {
        approvedIncomeCents,
        totalCommissionCents,
        companyOverheadCents,
        awaitingAllocationCents,
        resultCents: approvedIncomeCents - totalCommissionCents - allExpenseCents,
      },
      commissionEarned,
      pendingSales,
      awaitingExpenses: expensesResult.data.filter((expense) => expense.status === "awaiting_allocation").length,
    });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to load the financial dashboard.";
    if (!(error instanceof SubmissionError)) console.error("Unable to load dashboard", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 403 : 500 });
  }
}
