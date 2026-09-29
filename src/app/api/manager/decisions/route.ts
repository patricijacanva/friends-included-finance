import { NextResponse } from "next/server";
import { allocateExpense, approveSale } from "@/lib/transactions/manager-decisions";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.kind === "sale") {
      const result = await approveSale(body);
      return NextResponse.json({ message: `${result.reference} approved.`, result });
    }
    if (body.kind === "expense") {
      const result = await allocateExpense(body);
      return NextResponse.json({ message: `${result.reference} allocation saved.`, result });
    }
    throw new SubmissionError("Unknown manager decision.");
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to save the manager decision.";
    if (!(error instanceof SubmissionError)) console.error("Manager decision failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
