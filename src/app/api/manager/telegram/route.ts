import { NextResponse } from "next/server";
import { requireManager } from "@/lib/manager";
import { SubmissionError } from "@/lib/transactions/submit-sale";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actorEmployeeId = new URL(request.url).searchParams.get("actorEmployeeId");
  if (!actorEmployeeId) return NextResponse.json({ error: "Choose Svetlana as the demonstration role." }, { status: 400 });
  try {
    const { supabase } = await requireManager(actorEmployeeId);
    const [chatsResult, identitiesResult, employeesResult] = await Promise.all([
      supabase.from("telegram_chats").select("telegram_chat_id, telegram_user_id, last_seen_at").eq("is_private_chat", true).order("last_seen_at", { ascending: false }),
      supabase.from("telegram_identities").select("telegram_user_id, employee_id"),
      supabase.from("employees").select("id, code, display_name").eq("active", true).order("display_name"),
    ]);
    if (chatsResult.error) throw chatsResult.error;
    if (identitiesResult.error) throw identitiesResult.error;
    if (employeesResult.error) throw employeesResult.error;
    const identityByUser = new Map(identitiesResult.data.map((identity) => [identity.telegram_user_id, identity.employee_id]));
    const employeesById = new Map(employeesResult.data.map((employee) => [employee.id, employee]));
    return NextResponse.json({
      employees: employeesResult.data,
      chats: chatsResult.data.map((chat) => ({
        chatId: chat.telegram_chat_id,
        userId: chat.telegram_user_id,
        lastSeenAt: chat.last_seen_at,
        mappedEmployee: employeesById.get(identityByUser.get(chat.telegram_user_id) ?? "") ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to load Telegram setup.";
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { actorEmployeeId?: string; telegramUserId?: number; employeeId?: string; chatId?: number };
    if (!body.actorEmployeeId || !body.telegramUserId || !body.employeeId || !body.chatId) throw new SubmissionError("Choose a Telegram chat and employee.");
    const { supabase } = await requireManager(body.actorEmployeeId);
    const { error } = await supabase.rpc("link_telegram_identity", {
      p_actor_employee_id: body.actorEmployeeId,
      p_telegram_user_id: body.telegramUserId,
      p_employee_id: body.employeeId,
      p_telegram_chat_id: body.chatId,
    });
    if (error) throw new SubmissionError(error.message);
    return NextResponse.json({ message: "Telegram identity linked." });
  } catch (error) {
    const message = error instanceof SubmissionError ? error.message : "Unable to link Telegram identity.";
    if (!(error instanceof SubmissionError)) console.error("Telegram linking failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof SubmissionError ? 400 : 500 });
  }
}
