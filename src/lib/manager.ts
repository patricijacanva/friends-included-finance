import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export async function requireManager(employeeId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, display_name, role, active")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !data || !data.active || data.role !== "manager") {
    throw new SubmissionError("Only Svetlana can view or decide pending transactions.");
  }

  return { supabase, manager: data };
}
