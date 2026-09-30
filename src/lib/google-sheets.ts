import { createSign } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SALES_HEADERS = [
  "Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount",
  "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %",
  "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %",
  "Richard commission", "Anastasia commission", "Jean-Claude commission", "Status",
];
const EXPENSE_HEADERS = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount", "Proposed allocation", "Final allocation", "Status"];

type GoogleConfig = { spreadsheetId: string; clientEmail: string; privateKey: string };

function normalizePrivateKey(value: string | undefined) {
  if (!value) return undefined;

  let privateKey = value.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    try {
      const decoded = JSON.parse(privateKey);
      if (typeof decoded === "string") privateKey = decoded;
    } catch {
      privateKey = privateKey.slice(1, -1);
    }
  }

  const pem = privateKey.match(/-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----/);
  if (pem) privateKey = pem[0];

  // Vercel values can retain one or more layers of escaped newlines. A PEM
  // key contains no literal backslashes, so collapse every such layer.
  return privateKey.replace(/\\+n/g, "\n").replace(/\\+r/g, "\r");
}

function googleConfig(): GoogleConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!spreadsheetId || !clientEmail || !privateKey) throw new Error("Google Sheets configuration is incomplete.");
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    throw new Error("Google private key is incomplete. Paste the complete private-key value from .env.local into Vercel.");
  }
  return { spreadsheetId, clientEmail, privateKey };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function googleAccessToken(config: GoogleConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(config.privateKey, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? "Google service-account authentication failed.");
  return payload.access_token;
}

async function googleRequest<T>(config: GoogleConfig, path: string, init: RequestInit = {}) {
  const accessToken = await googleAccessToken(config);
  const response = await fetch(`https://sheets.googleapis.com/v4/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Google Sheets request failed.");
  return payload;
}

async function ensureTabAndHeaders(config: GoogleConfig, tab: "Sales" | "Expenses", headers: string[]) {
  const workbook = await googleRequest<{ sheets?: Array<{ properties?: { title?: string } }> }>(config, `spreadsheets/${config.spreadsheetId}?fields=sheets.properties`);
  if (!workbook.sheets?.some((sheet) => sheet.properties?.title === tab)) {
    await googleRequest(config, `spreadsheets/${config.spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
  }
  await googleRequest(config, `spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(`${tab}!A1:${String.fromCharCode(64 + headers.length)}1`)}?valueInputOption=RAW`, {
    method: "PUT", body: JSON.stringify({ values: [headers] }),
  });
}

async function upsertRow(config: GoogleConfig, tab: "Sales" | "Expenses", headers: string[], reference: string, row: Array<string | number>) {
  await ensureTabAndHeaders(config, tab, headers);
  const column = String.fromCharCode(64 + headers.length);
  const existing = await googleRequest<{ values?: string[][] }>(config, `spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(`${tab}!A:A`)}`);
  const rowIndex = existing.values?.findIndex((values) => values[0] === reference) ?? -1;
  const range = rowIndex > 0 ? `${tab}!A${rowIndex + 1}:${column}${rowIndex + 1}` : `${tab}!A:${column}`;
  const method = rowIndex > 0 ? "PUT" : "POST";
  const suffix = rowIndex > 0 ? "?valueInputOption=USER_ENTERED" : ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS";
  await googleRequest(config, `spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`, {
    method, body: JSON.stringify({ values: [row] }),
  });
}

function money(cents: number) {
  return cents / 100;
}

export async function syncTransactionToGoogleSheets(transactionId: string) {
  const config = googleConfig();
  const supabase = createSupabaseServerClient();
  const { data: transaction, error: transactionError } = await supabase.from("transactions")
    .select("id, reference, submitted_at, submitted_by_employee_id").eq("id", transactionId).single();
  if (transactionError) throw transactionError;
  const { data: employee, error: employeeError } = await supabase.from("employees")
    .select("display_name").eq("id", transaction.submitted_by_employee_id).single();
  if (employeeError) throw employeeError;

  const { data: sale } = await supabase.from("sales")
    .select("customer, project, description, amount_cents, status").eq("transaction_id", transactionId).maybeSingle();
  if (sale) {
    const [{ data: proposal }, { data: decision }] = await Promise.all([
      supabase.from("sale_commission_proposals").select("richard_percent, anastasia_percent, jean_claude_percent").eq("sale_id", transactionId).single(),
      supabase.from("sale_commission_decisions").select("richard_percent, anastasia_percent, jean_claude_percent, richard_commission_cents, anastasia_commission_cents, jean_claude_commission_cents").eq("sale_id", transactionId).maybeSingle(),
    ]);
    if (!proposal) throw new Error("Sale commission proposal is missing.");
    await upsertRow(config, "Sales", SALES_HEADERS, transaction.reference, [
      transaction.reference, transaction.submitted_at, employee.display_name, sale.customer, sale.project, sale.description, money(sale.amount_cents),
      proposal.richard_percent, proposal.anastasia_percent, proposal.jean_claude_percent,
      decision?.richard_percent ?? "", decision?.anastasia_percent ?? "", decision?.jean_claude_percent ?? "",
      decision ? money(decision.richard_commission_cents) : 0, decision ? money(decision.anastasia_commission_cents) : 0, decision ? money(decision.jean_claude_commission_cents) : 0,
      sale.status === "approved" ? "Approved" : "Pending approval",
    ]);
    return;
  }

  const { data: expense, error: expenseError } = await supabase.from("expenses")
    .select("description, category, amount_cents, proposed_allocation, final_allocation, status").eq("transaction_id", transactionId).single();
  if (expenseError) throw expenseError;
  await upsertRow(config, "Expenses", EXPENSE_HEADERS, transaction.reference, [
    transaction.reference, transaction.submitted_at, employee.display_name, expense.description, expense.category, money(expense.amount_cents),
    expense.proposed_allocation, expense.final_allocation ?? "", expense.status === "awaiting_allocation" ? "Awaiting allocation" : expense.status === "allocated_overhead" ? "Company overhead" : "Allocated",
  ]);
}

export async function syncAndRecord(transactionId: string) {
  const supabase = createSupabaseServerClient();
  const { data: current } = await supabase.from("sheets_sync_state").select("attempt_count").eq("transaction_id", transactionId).single();
  try {
    await syncTransactionToGoogleSheets(transactionId);
    const { error } = await supabase.from("sheets_sync_state").update({
      status: "synced", attempt_count: (current?.attempt_count ?? 0) + 1, last_attempt_at: new Date().toISOString(), last_success_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString(),
    }).eq("transaction_id", transactionId);
    if (error) throw error;
    return { status: "synced" as const };
  } catch (error) {
    const { error: stateError } = await supabase.from("sheets_sync_state").update({
      status: "failed", attempt_count: (current?.attempt_count ?? 0) + 1, last_attempt_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : "Google Sheets sync failed", updated_at: new Date().toISOString(),
    }).eq("transaction_id", transactionId);
    if (stateError) console.error("Unable to record Sheets failure", stateError);
    return { status: "failed" as const };
  }
}
