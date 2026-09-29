import { NextResponse } from "next/server";
import { SubmissionError } from "@/lib/transactions/submit-sale";
import { submitWebsiteExpense } from "@/lib/transactions/submit-expense";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await submitWebsiteExpense(await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to save the expense. Please try again.";
    if (!(error instanceof SubmissionError)) console.error("Expense submission failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
