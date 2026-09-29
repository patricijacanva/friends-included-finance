"use client";

import { useCallback, useEffect, useState } from "react";

type Employee = { id: string; display_name: string; code: string };
type TelegramChat = { chatId: number; userId: number; lastSeenAt: string; mappedEmployee: Employee | null };

export function TelegramSetup({ managerId }: { managerId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/manager/telegram?actorEmployeeId=${encodeURIComponent(managerId)}`, { cache: "no-store" });
    const payload = (await response.json()) as { employees?: Employee[]; chats?: TelegramChat[]; error?: string };
    if (!response.ok || !payload.employees || !payload.chats) throw new Error(payload.error ?? "Unable to load Telegram setup.");
    setEmployees(payload.employees); setChats(payload.chats);
    setSelected(Object.fromEntries(payload.chats.map((chat) => [chat.userId, chat.mappedEmployee?.id ?? ""])));
  }, [managerId]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        await load();
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load Telegram setup.");
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [load]);

  async function link(chat: TelegramChat) {
    const employeeId = selected[chat.userId];
    if (!employeeId) { setMessage("Choose an employee first."); return; }
    const response = await fetch("/api/manager/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorEmployeeId: managerId, telegramUserId: chat.userId, employeeId, chatId: chat.chatId }) });
    const payload = (await response.json()) as { message?: string; error?: string };
    setMessage(response.ok ? payload.message ?? "Telegram identity linked." : payload.error ?? "Unable to link Telegram identity.");
    if (response.ok) await load();
  }

  return <section className="telegram-setup" aria-labelledby="telegram-setup-heading"><h2 id="telegram-setup-heading">Telegram manager setup</h2><p>Each person must send <code>/start</code> to the bot before their private chat appears here.</p>{message ? <p className={message.includes("linked") ? "success" : "error"}>{message}</p> : null}{chats.length === 0 ? <p>No private Telegram chats have started the bot yet.</p> : <div className="table-wrap"><table><thead><tr><th>Telegram user ID</th><th>Last seen</th><th>Employee</th><th></th></tr></thead><tbody>{chats.map((chat) => <tr key={chat.chatId}><td>{chat.userId}</td><td>{new Date(chat.lastSeenAt).toLocaleString()}</td><td><select value={selected[chat.userId] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [chat.userId]: event.target.value }))}><option value="">Choose employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.display_name}</option>)}</select></td><td><button type="button" onClick={() => link(chat)}>Link</button></td></tr>)}</tbody></table></div>}</section>;
}
