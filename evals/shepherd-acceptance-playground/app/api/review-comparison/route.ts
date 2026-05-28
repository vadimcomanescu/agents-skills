import { NextResponse } from "next/server";
import {
  compareEvidenceReviewScenarios,
  knownEvidenceReviewComparisonPairs
} from "../../../lib/evidence-review";

export async function GET(request: Request) {
  const pair = new URL(request.url).searchParams.get("pair") ?? "";
  const comparison = compareEvidenceReviewScenarios(pair);

  if (!comparison) {
    return NextResponse.json(
      {
        error: "Unknown review comparison pair.",
        pair,
        knownPairs: knownEvidenceReviewComparisonPairs
      },
      { status: 400 }
    );
  }

  return NextResponse.json(comparison);
}
