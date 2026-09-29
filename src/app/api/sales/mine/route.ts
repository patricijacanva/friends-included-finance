import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");

  if (!actorEmployeeId) {
    return NextResponse.json({ error: "Choose a demonstration role first." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id,
        reference,
        submitted_at,
        sales!inner (project, description, amount_cents, status),
        sheets_sync_state (status)
      `)
      .eq("submitted_by_employee_id", actorEmployeeId)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    const sales = data.flatMap((transaction) => {
      const relatedSales = transaction.sales as unknown as {
        project: "A" | "B";
        description: string;
        amount_cents: number;
        status: "pending_approval" | "approved";
      } | Array<{
        project: "A" | "B";
        description: string;
        amount_cents: number;
        status: "pending_approval" | "approved";
      }>;
      const sale = Array.isArray(relatedSales) ? relatedSales[0] : relatedSales;
      if (!sale) return [];

      const relatedSyncStates = transaction.sheets_sync_state as unknown as Array<{ status: "pending" | "failed" | "synced" }> | { status: "pending" | "failed" | "synced" } | null;
      const syncStatus = Array.isArray(relatedSyncStates)
        ? relatedSyncStates[0]?.status
        : relatedSyncStates?.status;

      return [{
        id: transaction.id,
        reference: transaction.reference,
        submittedAt: transaction.submitted_at,
        project: sale.project,
        description: sale.description,
        amountCents: sale.amount_cents,
        status: sale.status,
        syncStatus: syncStatus ?? "pending",
      }];
    });

    return NextResponse.json({ sales });
  } catch (error) {
    console.error("Unable to load submitted sales", error);
    return NextResponse.json({ error: "Unable to load submitted sales." }, { status: 500 });
  }
}
