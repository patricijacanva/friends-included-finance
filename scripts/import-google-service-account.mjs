import fs from "node:fs";
import path from "node:path";

const credentialPath = process.argv[2];
if (!credentialPath) {
  console.error("Usage: node scripts/import-google-service-account.mjs /path/to/service-account.json");
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
  console.error("This file does not look like a Google service-account JSON key.");
  process.exit(1);
}

const envPath = path.resolve(".env.local");
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
const replacementKeys = new Set([
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SERVICE_ACCOUNT_PROJECT_ID",
]);
const retained = existing.filter((line) => ![...replacementKeys].some((key) => line.startsWith(`${key}=`)));
retained.push(`GOOGLE_SERVICE_ACCOUNT_EMAIL=${credentials.client_email}`);
retained.push(`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=${JSON.stringify(credentials.private_key)}`);
retained.push(`GOOGLE_SERVICE_ACCOUNT_PROJECT_ID=${credentials.project_id}`);
fs.writeFileSync(envPath, `${retained.filter(Boolean).join("\n")}\n`, { mode: 0o600 });
console.log("Google service-account settings were added to .env.local.");
