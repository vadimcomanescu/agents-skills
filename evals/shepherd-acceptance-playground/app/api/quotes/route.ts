import { NextResponse } from "next/server";
import { createQuote, seededQuotes, type Quote } from "../../../lib/quote-store";

export async function GET() {
  return NextResponse.json({
    quotes: seededQuotes,
    summary: {
      seeded: true,
      count: seededQuotes.length
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { customer?: string; amount?: number; existing?: Quote[] };
  const existing = Array.isArray(body.existing) ? body.existing : seededQuotes;
  const quote = createQuote({ customer: body.customer ?? "", amount: Number(body.amount) }, existing);
  return NextResponse.json({
    created: quote,
    quotes: [...existing, quote]
  });
}
