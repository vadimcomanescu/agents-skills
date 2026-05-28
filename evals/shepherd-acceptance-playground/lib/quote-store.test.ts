import { describe, expect, it } from "vitest";
import { createQuote, filterQuotes, seededQuotes, summarizeQuotes } from "./quote-store";

describe("quote acceptance state", () => {
  it("should summarize seeded quote statuses for dashboard proof", () => {
    expect(summarizeQuotes(seededQuotes)).toEqual({
      total: 3,
      draft: 1,
      sent: 1,
      accepted: 1
    });
  });

  it("should filter quotes by status without losing seeded data", () => {
    expect(filterQuotes(seededQuotes, "sent")).toEqual([
      { id: "q-101", customer: "Lumen Bakery", amount: 1800, status: "sent" }
    ]);
  });

  it("should create draft quotes with stable IDs from existing state", () => {
    expect(createQuote({ customer: "  Delta Shop  ", amount: 2500 }, seededQuotes)).toEqual({
      id: "q-103",
      customer: "Delta Shop",
      amount: 2500,
      status: "draft"
    });
  });

  it("should reject state changes without a customer", () => {
    expect(() => createQuote({ customer: " ", amount: 2500 }, seededQuotes)).toThrow("Customer is required");
  });
});
