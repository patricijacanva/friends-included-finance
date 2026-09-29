import { NextResponse } from "next/server";
import { SubmissionError, submitWebsiteSale } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitWebsiteSale(body);

    return NextResponse.json({
      transactionId: result.transactionId,
      message: "Sale saved with Pending approval status. Google Sheets sync is pending.",
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof SubmissionError
      ? error.message
      : "Unable to save the sale. Please try again.";
    const status = error instanceof SubmissionError ? 400 : 500;

    if (!(error instanceof SubmissionError)) console.error("Sale submission failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
