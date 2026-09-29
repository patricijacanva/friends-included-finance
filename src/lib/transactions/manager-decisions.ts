import { requireManager } from "@/lib/manager";
import { SubmissionError } from "@/lib/transactions/submit-sale";

function validateSplit(values: number[]) {
  return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 100)
    && values.reduce((sum, value) => sum + value, 0) === 100;
}

export async function approveSale(input: { actorEmployeeId: string; saleId: string; richardPercent: number; anastasiaPercent: number; jeanClaudePercent: number }) {
  if (!validateSplit([input.richardPercent, input.anastasiaPercent, input.jeanClaudePercent])) {
    throw new SubmissionError("Commission shares must each be 0 to 100 and total exactly 100.");
  }
  const { supabase } = await requireManager(input.actorEmployeeId);
  const { data, error } = await supabase.rpc("approve_sale", {
    p_actor_employee_id: input.actorEmployeeId, p_sale_id: input.saleId,
    p_richard_percent: input.richardPercent, p_anastasia_percent: input.anastasiaPercent, p_jean_claude_percent: input.jeanClaudePercent,
  });
  if (error) throw new SubmissionError(error.message);
  return data as { reference: string; poolCents: number };
}

export async function allocateExpense(input: { actorEmployeeId: string; expenseId: string; finalAllocation: "A" | "B" | "company_overhead" }) {
  if (!["A", "B", "company_overhead"].includes(input.finalAllocation)) throw new SubmissionError("Choose a final allocation.");
  const { supabase } = await requireManager(input.actorEmployeeId);
  const { data, error } = await supabase.rpc("allocate_expense", {
    p_actor_employee_id: input.actorEmployeeId, p_expense_id: input.expenseId, p_final_allocation: input.finalAllocation,
  });
  if (error) throw new SubmissionError(error.message);
  return data as { reference: string };
}
