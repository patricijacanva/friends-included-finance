import { NextResponse } from "next/server";
import { allocateExpense, approveSale } from "@/lib/transactions/manager-decisions";
import { SubmissionError } from "@/lib/transactions/submit-sale";
import { notifyExpenseAllocation, notifySaleApproval } from "@/lib/telegram-decision-notifications";
import { syncAndRecord } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.kind === "sale") {
      const result = await approveSale(body);
      const sync = await syncAndRecord(body.saleId);
      const notification = await notifySaleApproval(body.saleId);
      const suffix = notification.status === "sent" ? " Telegram notification sent." : notification.status === "no_recipient" ? " No Telegram recipient linked." : " Approval saved; Telegram notification failed and can be retried.";
      return NextResponse.json({ message: `${result.reference} approved. Sheets sync ${sync.status === "synced" ? "completed." : "failed."}${suffix}`, result });
    }
    if (body.kind === "expense") {
      const result = await allocateExpense(body);
      const sync = await syncAndRecord(body.expenseId);
      const notification = await notifyExpenseAllocation(body.expenseId);
      const suffix = notification.status === "sent" ? " Telegram notification sent." : notification.status === "no_recipient" ? " No Telegram recipient linked." : " Allocation saved; Telegram notification failed and can be retried.";
      return NextResponse.json({ message: `${result.reference} allocation saved. Sheets sync ${sync.status === "synced" ? "completed." : "failed."}${suffix}`, result });
    }
    throw new SubmissionError("Unknown manager decision.");
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to save the manager decision.";
    if (!(error instanceof SubmissionError)) console.error("Manager decision failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
