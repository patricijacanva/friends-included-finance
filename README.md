# Friends Included Finance

Course homework project for Friends Included Ltd. This is a Next.js and Supabase finance system for sales, expenses, manager decisions, Telegram submissions, and Google Sheets synchronization.

## What it does

- Salespeople submit Project A or B sales with a proposed commission split.
- Kevin submits expenses with a proposed project or company-overhead allocation.
- Svetlana approves sales, may change their commission split, and confirms expense allocations.
- The dashboard calculates approved income, commission expense, allocated expenses, and company/project results from Supabase data.
- Telegram and website submissions use the same server-side transaction functions.
- Sales and expenses are synchronized to separate Google Sheets tabs. A failed sync can be retried without creating a duplicate transaction.
- Telegram users receive submission confirmations and decision notifications when their linked transaction is approved or allocated.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Add your own values to `.env.local`; never commit this file.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Required environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
# For Vercel, use this single-line alternative instead of the normal private key:
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64=
```

All secrets belong only in `.env.local` locally and in Vercel Environment Variables. No secret is placed in browser code or GitHub.

## Deployment checklist

1. Push the `main` branch to GitHub.
2. Add the environment variables in Vercel for **Production**.
3. Share the Google Sheet with the service-account email as an **Editor**.
4. Set the Telegram webhook to `/api/telegram/webhook` with the configured webhook secret.
5. Redeploy after changing any Vercel environment variable.

## Telegram commands

```text
/start
/sale REF | Customer | A or B | Description | Amount | Richard % | Anastasia % | Jean-Claude %
/expense REF | Description | Materials, Travel, or Other | Amount | A, B, or Company overhead
```

The manager must link a Telegram account to an employee before that account can submit transactions.
