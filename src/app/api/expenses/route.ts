import { NextResponse } from "next/server";
import { SubmissionError } from "@/lib/transactions/submit-sale";
import { submitWebsiteExpense } from "@/lib/transactions/submit-expense";
import { syncAndRecord } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await submitWebsiteExpense(await request.json());
    const sync = await syncAndRecord(result.transactionId);
    return NextResponse.json({ ...result, message: `${result.message} Sync ${sync.status === "synced" ? "completed." : "failed; use retry after checking setup."}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to save the expense. Please try again.";
    if (!(error instanceof SubmissionError)) console.error("Expense submission failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
