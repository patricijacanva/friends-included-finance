import { DemonstrationRoleSelector } from "@/components/demonstration-role-selector";
import { ReviewerInstructions } from "@/components/reviewer-instructions";

export default function Home() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const googleSheetsUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing` : null;
  return (
    <main>
      <h1>Friends Included Finance</h1>
      <p>Internal finance system for Friends Included Ltd.</p>
      <ReviewerInstructions googleSheetsUrl={googleSheetsUrl} />
      <DemonstrationRoleSelector />
    </main>
  );
}
