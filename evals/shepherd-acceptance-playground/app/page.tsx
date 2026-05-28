import { seededQuotes, summarizeQuotes } from "../lib/quote-store";
import EvidenceReviewWorkflow from "./evidence-review-workflow";
import QuoteWorkflow from "./quote-workflow";

export default function Page() {
  const summary = summarizeQuotes(seededQuotes);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Shepherd acceptance playground</div>
          <h1>Quote Control</h1>
        </div>
        <p>Browser, replay, state/API, stale-proof, and no-extra-behavior eval target.</p>
      </header>

      <section className="metrics" aria-label="Seeded quote status counts">
        <div className="metric">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="metric">
          <span>Draft</span>
          <strong>{summary.draft}</strong>
        </div>
        <div className="metric">
          <span>Sent</span>
          <strong>{summary.sent}</strong>
        </div>
        <div className="metric">
          <span>Accepted</span>
          <strong>{summary.accepted}</strong>
        </div>
      </section>

      <QuoteWorkflow initialQuotes={seededQuotes} />
      <EvidenceReviewWorkflow />
    </main>
  );
}
