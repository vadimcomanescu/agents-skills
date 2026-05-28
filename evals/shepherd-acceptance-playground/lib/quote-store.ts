export type QuoteStatus = "draft" | "sent" | "accepted";

export type Quote = {
  id: string;
  customer: string;
  amount: number;
  status: QuoteStatus;
};

export type QuoteInput = {
  customer: string;
  amount: number;
};

export const seededQuotes: Quote[] = [
  { id: "q-100", customer: "Northstar Studio", amount: 4200, status: "draft" },
  { id: "q-101", customer: "Lumen Bakery", amount: 1800, status: "sent" },
  { id: "q-102", customer: "Harbor Clinic", amount: 7600, status: "accepted" }
];

export function summarizeQuotes(quotes: Quote[]) {
  return {
    total: quotes.length,
    draft: quotes.filter((quote) => quote.status === "draft").length,
    sent: quotes.filter((quote) => quote.status === "sent").length,
    accepted: quotes.filter((quote) => quote.status === "accepted").length
  };
}

export function filterQuotes(quotes: Quote[], status: QuoteStatus | "all") {
  if (status === "all") {
    return quotes;
  }
  return quotes.filter((quote) => quote.status === status);
}

export function createQuote(input: QuoteInput, existing: Quote[]): Quote {
  const customer = input.customer.trim();
  if (!customer) {
    throw new Error("Customer is required");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be positive");
  }
  return {
    id: `q-${100 + existing.length}`,
    customer,
    amount: Math.round(input.amount),
    status: "draft"
  };
}
