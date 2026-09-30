import { NextResponse } from "next/server";
import { syncAndRecord } from "@/lib/google-sheets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { actorEmployeeId, transactionId } = await request.json() as { actorEmployeeId?: string; transactionId?: string };
    if (!actorEmployeeId || !transactionId) throw new SubmissionError("Choose an employee and transaction to retry.");

    const supabase = createSupabaseServerClient();
    const [{ data: actor, error: actorError }, { data: transaction, error: transactionError }] = await Promise.all([
      supabase.from("employees").select("id, role, active").eq("id", actorEmployeeId).maybeSingle(),
      supabase.from("transactions").select("id, submitted_by_employee_id").eq("id", transactionId).maybeSingle(),
    ]);
    if (actorError || !actor || !actor.active) throw new SubmissionError("Choose an active employee first.");
    if (transactionError || !transaction) throw new SubmissionError("This transaction no longer exists.");
    if (transaction.submitted_by_employee_id !== actor.id && actor.role !== "manager") {
      throw new SubmissionError("You can retry only your own submissions.");
    }

    const sync = await syncAndRecord(transaction.id);
    if (sync.status !== "synced") throw new SubmissionError("Google Sheets retry failed. Check the saved sync status.");
    return NextResponse.json({ message: "Google Sheets synchronization completed." });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to retry Google Sheets synchronization.";
    if (!(error instanceof SubmissionError)) console.error("Google Sheets retry failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
