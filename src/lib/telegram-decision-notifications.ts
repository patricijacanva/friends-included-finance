import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage, updateTelegramNotification } from "@/lib/telegram";

function euro(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function allocationName(value: "A" | "B" | "company_overhead") {
  return value === "company_overhead" ? "Company overhead" : value === "A" ? "Respectable Relatives" : "Drunk University Friends";
}

export async function notifySaleApproval(saleId: string) {
  const supabase = createSupabaseServerClient();
  const [transactionResult, saleResult, proposalResult, decisionResult, notificationResult] = await Promise.all([
    supabase.from("transactions").select("reference, source, submitted_by_employee_id").eq("id", saleId).single(),
    supabase.from("sales").select("amount_cents").eq("transaction_id", saleId).single(),
    supabase.from("sale_commission_proposals").select("richard_percent, anastasia_percent, jean_claude_percent").eq("sale_id", saleId).single(),
    supabase.from("sale_commission_decisions").select("richard_percent, anastasia_percent, jean_claude_percent, pool_cents, richard_commission_cents, anastasia_commission_cents, jean_claude_commission_cents, split_changed").eq("sale_id", saleId).single(),
    supabase.from("telegram_notification_state").select("chat_id").eq("transaction_id", saleId).eq("notification_kind", "sale_approval").maybeSingle(),
  ]);
  const error = transactionResult.error ?? saleResult.error ?? proposalResult.error ?? decisionResult.error ?? notificationResult.error;
  if (error || !transactionResult.data || !saleResult.data || !proposalResult.data || !decisionResult.data) {
    throw error ?? new Error("Approved sale details are incomplete.");
  }
  let chatId = notificationResult.data?.chat_id ?? null;
  // Website records do not have a chat until a manager links the fictional
  // employee. Resolve that link at decision time so the manager setup can be
  // used immediately before approval, as required by the test flow.
  if (!chatId && transactionResult.data.source === "website") {
    const { data: identity } = await supabase.from("telegram_identities")
      .select("last_chat_id").eq("employee_id", transactionResult.data.submitted_by_employee_id).eq("active", true).maybeSingle();
    chatId = identity?.last_chat_id ?? null;
    if (chatId) {
      await supabase.from("telegram_notification_state").update({ chat_id: chatId, status: "pending", error_message: null })
        .eq("transaction_id", saleId).eq("notification_kind", "sale_approval");
    }
  }
  if (!chatId) return { status: "no_recipient" as const };

  const transaction = transactionResult.data;
  const sale = saleResult.data;
  const proposal = proposalResult.data;
  const decision = decisionResult.data;
  const text = [
    `Sale ${transaction.reference} approved${decision.split_changed ? " — commission split changed." : "."}`,
    `Sale ${euro(sale.amount_cents)}; total commission ${euro(decision.pool_cents)}.`,
    `Richard: ${proposal.richard_percent}% → ${decision.richard_percent}% (${euro(decision.richard_commission_cents)}).`,
    `Anastasia: ${proposal.anastasia_percent}% → ${decision.anastasia_percent}% (${euro(decision.anastasia_commission_cents)}).`,
    `Jean-Claude: ${proposal.jean_claude_percent}% → ${decision.jean_claude_percent}% (${euro(decision.jean_claude_commission_cents)}).`,
  ].join("\n");
  try {
    await sendTelegramMessage(chatId, text);
    await updateTelegramNotification(saleId, "sale_approval", true);
    return { status: "sent" as const };
  } catch (error) {
    await updateTelegramNotification(saleId, "sale_approval", false, error instanceof Error ? error.message : undefined);
    return { status: "failed" as const };
  }
}

export async function notifyExpenseAllocation(expenseId: string) {
  const supabase = createSupabaseServerClient();
  const [transactionResult, expenseResult, notificationResult] = await Promise.all([
    supabase.from("transactions").select("reference, source, submitted_by_employee_id").eq("id", expenseId).single(),
    supabase.from("expenses").select("description, amount_cents, proposed_allocation, final_allocation").eq("transaction_id", expenseId).single(),
    supabase.from("telegram_notification_state").select("chat_id").eq("transaction_id", expenseId).eq("notification_kind", "expense_allocation").maybeSingle(),
  ]);
  const error = transactionResult.error ?? expenseResult.error ?? notificationResult.error;
  if (error || !transactionResult.data || !expenseResult.data) {
    throw error ?? new Error("Allocated expense details are incomplete.");
  }
  let chatId = notificationResult.data?.chat_id ?? null;
  if (!chatId && transactionResult.data.source === "website") {
    const { data: identity } = await supabase.from("telegram_identities")
      .select("last_chat_id").eq("employee_id", transactionResult.data.submitted_by_employee_id).eq("active", true).maybeSingle();
    chatId = identity?.last_chat_id ?? null;
    if (chatId) {
      await supabase.from("telegram_notification_state").update({ chat_id: chatId, status: "pending", error_message: null })
        .eq("transaction_id", expenseId).eq("notification_kind", "expense_allocation");
    }
  }
  if (!chatId) return { status: "no_recipient" as const };
  const transaction = transactionResult.data;
  const expense = expenseResult.data;
  const changed = expense.proposed_allocation !== expense.final_allocation;
  const text = [
    `Expense ${transaction.reference} — allocation ${changed ? "changed" : "confirmed"}.`,
    `${euro(expense.amount_cents)}: ${expense.description}.`,
    `Proposed: ${allocationName(expense.proposed_allocation)}. Approved: ${allocationName(expense.final_allocation as "A" | "B" | "company_overhead")}.`,
  ].join("\n");
  try {
    await sendTelegramMessage(chatId, text);
    await updateTelegramNotification(expenseId, "expense_allocation", true);
    return { status: "sent" as const };
  } catch (error) {
    await updateTelegramNotification(expenseId, "expense_allocation", false, error instanceof Error ? error.message : undefined);
    return { status: "failed" as const };
  }
}
