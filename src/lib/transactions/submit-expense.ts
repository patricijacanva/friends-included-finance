import { euroTextToCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubmissionError } from "@/lib/transactions/submit-sale";

type ExpenseSubmission = {
  actorEmployeeId: string;
  reference: string;
  description: string;
  category: "materials" | "travel" | "other";
  amount: string;
  proposedAllocation: "A" | "B" | "company_overhead";
  source: "website" | "telegram";
  submissionTelegramChatId: number | null;
};

export async function submitExpense(input: ExpenseSubmission) {
  const amountCents = euroTextToCents(input.amount);

  if (!input.actorEmployeeId) throw new SubmissionError("Choose a demonstration role first.");
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(input.reference.trim())) {
    throw new SubmissionError("Reference must start with a letter and use only letters, numbers, underscores, or hyphens.");
  }
  if (!input.description.trim()) throw new SubmissionError("Expense description is required.");
  if (!["materials", "travel", "other"].includes(input.category)) throw new SubmissionError("Choose an expense category.");
  if (!["A", "B", "company_overhead"].includes(input.proposedAllocation)) throw new SubmissionError("Choose a proposed allocation.");
  if (!amountCents) throw new SubmissionError("Enter an expense amount greater than zero, with up to two decimal places.");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_expense", {
    p_actor_employee_id: input.actorEmployeeId,
    p_reference: input.reference.trim(),
    p_description: input.description.trim(),
    p_category: input.category,
    p_amount_cents: amountCents,
    p_proposed_allocation: input.proposedAllocation,
    p_source: input.source,
    p_submission_telegram_chat_id: input.submissionTelegramChatId,
  });

  if (error) throw new SubmissionError(error.message);

  const status = input.proposedAllocation === "company_overhead" ? "allocated overhead" : "awaiting allocation";
  return { transactionId: data, message: `Expense saved with ${status} status. Google Sheets sync is pending.` };
}

export function submitWebsiteExpense(input: Omit<ExpenseSubmission, "source" | "submissionTelegramChatId">) {
  return submitExpense({ ...input, source: "website", submissionTelegramChatId: null });
}
