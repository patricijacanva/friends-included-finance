import { NextResponse } from "next/server";
import { findLinkedTelegramEmployee, recordTelegramChat, sendTelegramMessage, TelegramMessage, updateSubmissionNotification } from "@/lib/telegram";
import { submitSale } from "@/lib/transactions/submit-sale";
import { submitExpense } from "@/lib/transactions/submit-expense";

export const dynamic = "force-dynamic";

function helpText() {
  return [
    "Friends Included bot commands:",
    "/sale REF | Customer | A or B | Description | Amount | Richard % | Anastasia % | Jean-Claude %",
    "/expense REF | Description | Materials, Travel, or Other | Amount | A, B, or Company overhead",
    "Use /start before asking Svetlana to link your Telegram account.",
  ].join("\n");
}

function partsAfterCommand(text: string) {
  return text.replace(/^\/\w+(?:@\w+)?\s*/i, "").split("|").map((part) => part.trim());
}

function expenseAllocation(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "a") return "A" as const;
  if (normalized === "b") return "B" as const;
  if (["company overhead", "overhead", "company_overhead"].includes(normalized)) return "company_overhead" as const;
  return null;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  let incomingMessage: TelegramMessage | undefined;
  try {
    const update = await request.json() as { message?: TelegramMessage };
    const message = update.message;
    incomingMessage = message;
    if (!message?.from || !message.text) return NextResponse.json({ ok: true });
    if (message.chat.type !== "private") {
      await sendTelegramMessage(message.chat.id, "Please use this bot in a private chat.");
      return NextResponse.json({ ok: true });
    }
    const sender = await recordTelegramChat(message);
    if (!sender) return NextResponse.json({ ok: true });
    const text = message.text.trim();
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      await sendTelegramMessage(sender.chatId, `Your Telegram account is ready. Ask Svetlana to link it in Manager setup.\n\n${helpText()}`);
      return NextResponse.json({ ok: true });
    }
    if (/^\/help(?:@\w+)?(?:\s|$)/i.test(text)) {
      await sendTelegramMessage(sender.chatId, helpText());
      return NextResponse.json({ ok: true });
    }

    const employee = await findLinkedTelegramEmployee(sender.userId);
    if (!employee) {
      await sendTelegramMessage(sender.chatId, "Your Telegram account is not linked to an employee. Ask Svetlana to link it in Manager setup.");
      return NextResponse.json({ ok: true });
    }

    if (/^\/sale(?:@\w+)?\s+/i.test(text)) {
      const parts = partsAfterCommand(text);
      if (parts.length !== 8) throw new Error("Use: /sale REF | Customer | A or B | Description | Amount | Richard % | Anastasia % | Jean-Claude %");
      const result = await submitSale({
        actorEmployeeId: employee.id, reference: parts[0], customer: parts[1], project: parts[2].toUpperCase() as "A" | "B", description: parts[3], amount: parts[4],
        richardPercent: Number(parts[5]), anastasiaPercent: Number(parts[6]), jeanClaudePercent: Number(parts[7]), source: "telegram", submissionTelegramChatId: sender.chatId,
      });
      const confirmation = `Sale ${parts[0].toUpperCase()} recorded. Amount €${(result.amountCents / 100).toFixed(2)}. Project ${parts[2].toUpperCase()}. Status: Pending approval.`;
      try { await sendTelegramMessage(sender.chatId, confirmation); await updateSubmissionNotification(result.transactionId, true); }
      catch (deliveryError) { await updateSubmissionNotification(result.transactionId, false, deliveryError instanceof Error ? deliveryError.message : undefined); }
      return NextResponse.json({ ok: true });
    }

    if (/^\/expense(?:@\w+)?\s+/i.test(text)) {
      const parts = partsAfterCommand(text);
      const allocation = parts[4] ? expenseAllocation(parts[4]) : null;
      if (parts.length !== 5 || !allocation) throw new Error("Use: /expense REF | Description | Materials, Travel, or Other | Amount | A, B, or Company overhead");
      const result = await submitExpense({
        actorEmployeeId: employee.id, reference: parts[0], description: parts[1], category: parts[2].toLowerCase() as "materials" | "travel" | "other", amount: parts[3], proposedAllocation: allocation,
        source: "telegram", submissionTelegramChatId: sender.chatId,
      });
      const status = allocation === "company_overhead" ? "Company overhead" : "Awaiting allocation";
      try { await sendTelegramMessage(sender.chatId, `Expense ${parts[0].toUpperCase()} recorded. Amount €${(result.transactionId ? Number(parts[3].replace(',', '.')).toFixed(2) : parts[3])}. Proposed allocation: ${allocation === "company_overhead" ? "Company overhead" : `Project ${allocation}`}. Status: ${status}.`); await updateSubmissionNotification(result.transactionId, true); }
      catch (deliveryError) { await updateSubmissionNotification(result.transactionId, false, deliveryError instanceof Error ? deliveryError.message : undefined); }
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(sender.chatId, helpText());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process that submission.";
    try {
      if (incomingMessage?.chat?.id) await sendTelegramMessage(incomingMessage.chat.id, `Submission not recorded: ${message}`);
    } catch { /* The webhook response remains successful so Telegram does not duplicate an already handled update. */ }
    return NextResponse.json({ ok: true });
  }
}
