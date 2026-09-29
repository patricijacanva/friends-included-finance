import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TelegramMessage = {
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
};

function telegramEnvironment() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !webhookSecret) throw new Error("Telegram environment variables are missing.");
  return { token, webhookSecret };
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const { token } = telegramEnvironment();
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error("Telegram rejected the message delivery.");
}

export async function recordTelegramChat(message: TelegramMessage) {
  if (!message.from || message.chat.type !== "private") return null;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("telegram_chats").upsert({
    telegram_chat_id: message.chat.id,
    telegram_user_id: message.from.id,
    last_seen_at: new Date().toISOString(),
    is_private_chat: true,
  }, { onConflict: "telegram_chat_id" });
  if (error) throw error;
  await supabase.from("telegram_identities").update({ last_chat_id: message.chat.id }).eq("telegram_user_id", message.from.id).eq("active", true);
  return { userId: message.from.id, chatId: message.chat.id };
}

export async function findLinkedTelegramEmployee(telegramUserId: number) {
  const supabase = createSupabaseServerClient();
  const { data: identity, error } = await supabase.from("telegram_identities")
    .select("employee_id, active").eq("telegram_user_id", telegramUserId).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!identity) return null;
  const { data: employee, error: employeeError } = await supabase.from("employees")
    .select("id, display_name, role, active").eq("id", identity.employee_id).maybeSingle();
  if (employeeError) throw employeeError;
  return employee?.active ? employee : null;
}

export async function updateSubmissionNotification(transactionId: string, delivered: boolean, errorMessage?: string) {
  const supabase = createSupabaseServerClient();
  const update = delivered
    ? { status: "sent", sent_at: new Date().toISOString(), last_attempt_at: new Date().toISOString(), error_message: null }
    : { status: "failed", last_attempt_at: new Date().toISOString(), error_message: errorMessage ?? "Telegram delivery failed" };
  const { error } = await supabase.from("telegram_notification_state")
    .update(update).eq("transaction_id", transactionId).eq("notification_kind", "submission_confirmation");
  if (error) throw error;
}
