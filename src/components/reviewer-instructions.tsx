type ReviewerInstructionsProps = { googleSheetsUrl: string | null };

const telegramBotUrl = "https://t.me/friendsincluded_yourname_bot";
const githubUrl = "https://github.com/patricijacanva/friends-included-finance";

export function ReviewerInstructions({ googleSheetsUrl }: ReviewerInstructionsProps) {
  return <section className="reviewer-instructions" aria-labelledby="reviewer-instructions-heading">
    <h2 id="reviewer-instructions-heading">Reviewer links and quick test guide</h2>
    <p><a href={telegramBotUrl} target="_blank" rel="noreferrer">Open the Telegram bot</a> · {googleSheetsUrl ? <a href={googleSheetsUrl} target="_blank" rel="noreferrer">Open the Viewer transaction ledger</a> : "Viewer transaction ledger link is being configured."} · <a href={githubUrl} target="_blank" rel="noreferrer">Open the GitHub repository</a></p>
    <ol>
      <li>To test Telegram, open the bot and send <code>/start</code>. On this page choose Svetlana as the Demonstration role, open Telegram manager setup, choose your started chat, choose a fictional employee, and select Link.</li>
      <li>Select Richard, Anastasia, Jean-Claude, or Kevin to enter website transactions. Select Svetlana to review pending transactions, inspect original proposals, and approve or correct final decisions.</li>
      <li>In Svetlana’s workspace, Assignment test evidence shows the real S01–S05 and E01–E07 records, their original proposals, final decisions, delivery state, and remaining pending items. The financial dashboard includes all saved records; the evidence section states the separate effect of retained practice data.</li>
      <li>The Google Sheet is a Viewer-only copy. A submission, approval, allocation, or retry updates the existing row with the same reference rather than creating another row.</li>
    </ol>
  </section>;
}
