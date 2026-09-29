import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");
  if (!actorEmployeeId) return NextResponse.json({ error: "Choose a demonstration role first." }, { status: 400 });

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id,
        reference,
        submitted_at,
        expenses!inner (description, amount_cents, proposed_allocation, final_allocation, status),
        sheets_sync_state (status)
      `)
      .eq("submitted_by_employee_id", actorEmployeeId)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    const expenses = data.flatMap((transaction) => {
      const relatedExpenses = transaction.expenses as unknown as {
        description: string;
        amount_cents: number;
        proposed_allocation: "A" | "B" | "company_overhead";
        final_allocation: "A" | "B" | "company_overhead" | null;
        status: "awaiting_allocation" | "allocated_project" | "allocated_overhead";
      } | Array<{
        description: string;
        amount_cents: number;
        proposed_allocation: "A" | "B" | "company_overhead";
        final_allocation: "A" | "B" | "company_overhead" | null;
        status: "awaiting_allocation" | "allocated_project" | "allocated_overhead";
      }>;
      const expense = Array.isArray(relatedExpenses) ? relatedExpenses[0] : relatedExpenses;
      if (!expense) return [];
      const sync = transaction.sheets_sync_state as unknown as { status: "pending" | "failed" | "synced" } | Array<{ status: "pending" | "failed" | "synced" }> | null;

      return [{
        id: transaction.id,
        reference: transaction.reference,
        amountCents: expense.amount_cents,
        proposedAllocation: expense.proposed_allocation,
        finalAllocation: expense.final_allocation,
        status: expense.status,
        syncStatus: Array.isArray(sync) ? sync[0]?.status ?? "pending" : sync?.status ?? "pending",
      }];
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Unable to load submitted expenses", error);
    return NextResponse.json({ error: "Unable to load submitted expenses." }, { status: 500 });
  }
}
