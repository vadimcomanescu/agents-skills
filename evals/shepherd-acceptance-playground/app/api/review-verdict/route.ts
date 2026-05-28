import { NextResponse } from "next/server";
import { getEvidenceReviewScenario, knownEvidenceReviewScenarios } from "../../../lib/evidence-review";

export async function GET(request: Request) {
  const scenarioName = new URL(request.url).searchParams.get("scenario") ?? "";
  const scenario = getEvidenceReviewScenario(scenarioName);

  if (!scenario) {
    return NextResponse.json(
      {
        error: "Unknown review verdict scenario.",
        scenario: scenarioName,
        knownScenarios: knownEvidenceReviewScenarios
      },
      { status: 400 }
    );
  }

  return NextResponse.json(scenario);
}
