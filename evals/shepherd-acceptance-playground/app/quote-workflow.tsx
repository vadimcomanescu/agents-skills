"use client";

import { useMemo, useState } from "react";
import type { Quote, QuoteStatus } from "../lib/quote-store";
import { filterQuotes, summarizeQuotes } from "../lib/quote-store";

type Props = {
  initialQuotes: Quote[];
};

export default function QuoteWorkflow({ initialQuotes }: Props) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("2500");
  const [apiProof, setApiProof] = useState("");
  const visibleQuotes = useMemo(() => filterQuotes(quotes, status), [quotes, status]);
  const summary = summarizeQuotes(quotes);

  async function createQuoteAction() {
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customer, amount: Number(amount), existing: quotes })
    });
    const payload = await response.json();
    if (!response.ok) {
      setApiProof(JSON.stringify(payload, null, 2));
      return;
    }
    setQuotes(payload.quotes);
    setCustomer("");
    setApiProof(JSON.stringify(payload, null, 2));
  }

  return (
    <section className="grid">
      <div className="panel">
        <h2>Quotes</h2>
        <label htmlFor="status-filter">
          Status filter
          <select id="status-filter" aria-label="Status filter" value={status} onChange={(event) => setStatus(event.target.value as QuoteStatus | "all")}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
          </select>
        </label>
        <div className="quote-list" aria-live="polite">
          {visibleQuotes.map((quote) => (
            <article className="quote" key={quote.id}>
              <div>
                <strong>{quote.customer}</strong>
                <div>${quote.amount.toLocaleString()}</div>
              </div>
              <div className="status">{quote.status}</div>
            </article>
          ))}
        </div>
      </div>

      <aside className="panel">
        <h2>Create quote</h2>
        <div className="form">
          <label htmlFor="customer">
            Customer
            <input id="customer" data-testid="customer-input" aria-label="Customer" value={customer} onChange={(event) => setCustomer(event.target.value)} />
          </label>
          <label htmlFor="amount">
            Amount
            <input id="amount" data-testid="amount-input" aria-label="Amount" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <button type="button" onClick={createQuoteAction}>Create draft quote</button>
        </div>
        <h3>API proof</h3>
        <div className="api-proof" data-testid="api-proof">
          {apiProof || JSON.stringify({ total: summary.total, draft: summary.draft }, null, 2)}
        </div>
      </aside>
    </section>
  );
}
