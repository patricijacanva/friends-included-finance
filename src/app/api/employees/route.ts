import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Read-only data for the later Demonstration role selector.
 * All mutation and permission checks remain server-side in later routes.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("employees")
      .select("id, code, display_name, role")
      .eq("active", true)
      .order("display_name");

    if (error) {
      console.error("Unable to read employees", error);
      return NextResponse.json({ error: "Unable to load employees." }, { status: 500 });
    }

    return NextResponse.json({ employees: data });
  } catch (error) {
    console.error("Employee endpoint configuration error", error);
    return NextResponse.json({ error: "Server configuration is incomplete." }, { status: 500 });
  }
}
