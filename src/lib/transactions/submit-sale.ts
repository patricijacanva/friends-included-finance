import { createSupabaseServerClient } from "@/lib/supabase/server";
import { euroTextToCents } from "@/lib/money";

type SaleSubmission = {
  actorEmployeeId: string;
  reference: string;
  customer: string;
  project: "A" | "B";
  description: string;
  amount: string;
  richardPercent: number;
  anastasiaPercent: number;
  jeanClaudePercent: number;
  source: "website" | "telegram";
  submissionTelegramChatId: number | null;
};

export class SubmissionError extends Error {}

function validPercent(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export async function submitSale(input: SaleSubmission) {
  const amountCents = euroTextToCents(input.amount);

  if (!input.actorEmployeeId) throw new SubmissionError("Choose a demonstration role first.");
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,49}$/.test(input.reference.trim())) {
    throw new SubmissionError("Reference must start with a letter and use only letters, numbers, underscores, or hyphens.");
  }
  if (!input.customer.trim() || !input.description.trim()) {
    throw new SubmissionError("Customer and description are required.");
  }
  if (input.project !== "A" && input.project !== "B") {
    throw new SubmissionError("Choose Project A or Project B.");
  }
  if (!amountCents) throw new SubmissionError("Enter a sale amount greater than zero, with up to two decimal places.");

  const percentages = [input.richardPercent, input.anastasiaPercent, input.jeanClaudePercent];
  if (!percentages.every(validPercent) || percentages.reduce((total, value) => total + value, 0) !== 100) {
    throw new SubmissionError("Commission shares must each be 0 to 100 and total exactly 100.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_sale", {
    p_actor_employee_id: input.actorEmployeeId,
    p_reference: input.reference.trim(),
    p_customer: input.customer.trim(),
    p_project: input.project,
    p_description: input.description.trim(),
    p_amount_cents: amountCents,
    p_richard_percent: input.richardPercent,
    p_anastasia_percent: input.anastasiaPercent,
    p_jean_claude_percent: input.jeanClaudePercent,
    p_source: input.source,
    p_submission_telegram_chat_id: input.submissionTelegramChatId,
  });

  if (error) {
    throw new SubmissionError(error.message);
  }

  return { transactionId: data, amountCents };
}

export async function submitWebsiteSale(input: Omit<SaleSubmission, "source" | "submissionTelegramChatId">) {
  const result = await submitSale({ ...input, source: "website", submissionTelegramChatId: null });
  // Website forms display their own confirmation; only Telegram submissions
  // receive a bot submission confirmation. Keep delivery state truthful.
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("telegram_notification_state").update({ status: "not_applicable", chat_id: null, error_message: null })
    .eq("transaction_id", result.transactionId).eq("notification_kind", "submission_confirmation");
  if (error) throw error;
  return result;
}
