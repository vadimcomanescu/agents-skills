import { describe, expect, it } from "vitest";
import {
  calculateReviewVerdict,
  compareEvidenceReviewRuns,
  compareEvidenceReviewScenarios,
  getEvidenceReviewScenario,
  knownEvidenceReviewComparisonPairs,
  seededEvidenceReview,
  summarizeRequiredCriteria,
  type EvidenceReviewScenario,
  type CriterionReviewState
} from "./evidence-review";

const everyCriterionMissing: CriterionReviewState[] = seededEvidenceReview.criteria.map((criterion) => ({
  criterionId: criterion.id,
  verdict: "unreviewed",
  selectedEvidenceId: null
}));

const everyCriterionAccepted: CriterionReviewState[] = seededEvidenceReview.criteria.map((criterion, index) => ({
  criterionId: criterion.id,
  verdict: "pass",
  selectedEvidenceId: seededEvidenceReview.evidence[index]?.id ?? null
}));

function scenarioWithEvidenceChange(
  scenario: EvidenceReviewScenario,
  criterionId: string,
  selectedEvidenceId: string | null
): EvidenceReviewScenario {
  const selectedEvidence =
    seededEvidenceReview.evidence.find((evidence) => evidence.id === selectedEvidenceId) ?? null;

  return {
    ...scenario,
    states: scenario.states.map((state) =>
      state.criterionId === criterionId ? { ...state, selectedEvidenceId } : state
    ),
    criteria: scenario.criteria.map((criterion) =>
      criterion.criterionId === criterionId ? { ...criterion, selectedEvidenceId, selectedEvidence } : criterion
    )
  };
}

describe("evidence review verdict", () => {
  it("should block the final verdict while required criteria have no verdict", () => {
    const result = calculateReviewVerdict(seededEvidenceReview.criteria, everyCriterionMissing);

    expect(result).toEqual({
      status: "blocked",
      reasons: [
        "Payment confirmation has no criterion verdict.",
        "Order summary has no criterion verdict.",
        "Recovery path has no criterion verdict."
      ],
      failedCriterionIds: [],
      missingCriterionIds: ["criterion-payment", "criterion-summary", "criterion-recovery"],
      missingEvidenceCriterionIds: []
    });
  });

  it("should keep the final verdict blocked when a passing required criterion has no selected evidence", () => {
    const result = calculateReviewVerdict(seededEvidenceReview.criteria, [
      { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: null },
      { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
      { criterionId: "criterion-recovery", verdict: "pass", selectedEvidenceId: "evidence-recovery" }
    ]);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("Payment confirmation is marked PASS but has no selected evidence.");
    expect(result.missingEvidenceCriterionIds).toEqual(["criterion-payment"]);
  });

  it("should reject the final verdict when any required criterion fails", () => {
    const result = calculateReviewVerdict(seededEvidenceReview.criteria, [
      { criterionId: "criterion-payment", verdict: "fail", selectedEvidenceId: "evidence-payment" },
      { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
      { criterionId: "criterion-recovery", verdict: "fail", selectedEvidenceId: "evidence-recovery" }
    ]);

    expect(result).toEqual({
      status: "rejected",
      reasons: ["Payment confirmation is marked FAIL.", "Recovery path is marked FAIL."],
      failedCriterionIds: ["criterion-payment", "criterion-recovery"],
      missingCriterionIds: [],
      missingEvidenceCriterionIds: []
    });
  });

  it("should accept the final verdict only when every required criterion passes with selected evidence", () => {
    const result = calculateReviewVerdict(seededEvidenceReview.criteria, everyCriterionAccepted);

    expect(result).toEqual({
      status: "accepted",
      reasons: ["Every required criterion passed with selected evidence."],
      failedCriterionIds: [],
      missingCriterionIds: [],
      missingEvidenceCriterionIds: []
    });
  });

  it("should expose the initial deterministic scenario as blocked without selected evidence", () => {
    const scenario = getEvidenceReviewScenario("initial");

    expect(scenario).not.toBeNull();
    expect(scenario?.scenario).toBe("initial");
    expect(scenario?.verdict.status).toBe("blocked");
    expect(scenario?.verdict.missingCriterionIds).toEqual([
      "criterion-payment",
      "criterion-summary",
      "criterion-recovery"
    ]);
    expect(scenario?.criteria.every((criterion) => criterion.selectedEvidence === null)).toBe(true);
  });

  it("should expose the missing-evidence deterministic scenario as blocked by missing evidence", () => {
    const scenario = getEvidenceReviewScenario("missing-evidence");

    expect(scenario).not.toBeNull();
    expect(scenario?.criteria).toContainEqual(
      expect.objectContaining({
        criterionId: "criterion-payment",
        verdict: "pass",
        selectedEvidenceId: null,
        selectedEvidence: null
      })
    );
    expect(scenario?.verdict.status).toBe("blocked");
    expect(scenario?.verdict.missingEvidenceCriterionIds).toEqual(["criterion-payment"]);
  });

  it("should expose the failed deterministic scenario as rejected by failed criteria", () => {
    const scenario = getEvidenceReviewScenario("failed");

    expect(scenario).not.toBeNull();
    expect(scenario?.verdict).toEqual({
      status: "rejected",
      reasons: ["Payment confirmation is marked FAIL.", "Recovery path is marked FAIL."],
      failedCriterionIds: ["criterion-payment", "criterion-recovery"],
      missingCriterionIds: [],
      missingEvidenceCriterionIds: []
    });
  });

  it("should expose the accepted deterministic scenario as accepted with selected evidence per criterion", () => {
    const scenario = getEvidenceReviewScenario("accepted");

    expect(scenario).not.toBeNull();
    expect(scenario?.verdict).toEqual({
      status: "accepted",
      reasons: ["Every required criterion passed with selected evidence."],
      failedCriterionIds: [],
      missingCriterionIds: [],
      missingEvidenceCriterionIds: []
    });
    expect(scenario?.criteria.every((criterion) => criterion.verdict === "pass")).toBe(true);
    expect(scenario?.criteria.every((criterion) => criterion.selectedEvidence !== null)).toBe(true);
  });

  it("should reject unknown deterministic scenarios without creating a verdict", () => {
    expect(getEvidenceReviewScenario("surprise")).toBeNull();
  });
});

describe("evidence review comparison", () => {
  it("should compare the failed-to-accepted pair with structured verdict and criterion movement", () => {
    const comparison = compareEvidenceReviewScenarios("failed-to-accepted");

    expect(comparison).not.toBeNull();
    expect(comparison?.pair).toBe("failed-to-accepted");
    expect(comparison?.previousScenario).toBe("failed");
    expect(comparison?.currentScenario).toBe("accepted");
    expect(comparison?.verdictChange).toEqual({
      previous: "rejected",
      current: "accepted",
      changed: true
    });
    expect(comparison?.criterionChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criterionId: "criterion-payment",
          title: "Payment confirmation",
          previousVerdict: "fail",
          currentVerdict: "pass"
        }),
        expect.objectContaining({
          criterionId: "criterion-recovery",
          title: "Recovery path",
          previousVerdict: "fail",
          currentVerdict: "pass"
        })
      ])
    );
  });

  it("should compare the unresolved-missing-evidence pair with a named missing-evidence blocker", () => {
    const comparison = compareEvidenceReviewScenarios("unresolved-missing-evidence");

    expect(comparison).not.toBeNull();
    expect(comparison?.pair).toBe("unresolved-missing-evidence");
    expect(comparison?.currentScenario).toBe("missing-evidence");
    expect(comparison?.verdictChange.current).toBe("blocked");
    expect(comparison?.remainingBlockers).toContainEqual({
      criterionId: "criterion-payment",
      title: "Payment confirmation",
      type: "missing evidence",
      currentVerdict: "pass"
    });
  });

  it("should compute added evidence as a separate evidence-change branch", () => {
    const comparison = compareEvidenceReviewScenarios("unresolved-missing-evidence");

    expect(comparison?.evidenceChanges.added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criterionId: "criterion-summary",
          title: "Order summary",
          currentEvidenceId: "evidence-summary"
        }),
        expect.objectContaining({
          criterionId: "criterion-recovery",
          title: "Recovery path",
          currentEvidenceId: "evidence-recovery"
        })
      ])
    );
  });

  it("should compute replaced evidence as a separate evidence-change branch", () => {
    const previous = getEvidenceReviewScenario("accepted");
    const current = getEvidenceReviewScenario("accepted");

    expect(previous).not.toBeNull();
    expect(current).not.toBeNull();

    const comparison = compareEvidenceReviewRuns({
      pair: "unit-replaced-evidence",
      previousScenario: previous!,
      currentScenario: scenarioWithEvidenceChange(current!, "criterion-payment", "evidence-summary")
    });

    expect(comparison.evidenceChanges.replaced).toEqual([
      {
        criterionId: "criterion-payment",
        title: "Payment confirmation",
        previousEvidenceId: "evidence-payment",
        previousEvidenceTitle: "Replay: successful payment",
        currentEvidenceId: "evidence-summary",
        currentEvidenceTitle: "Screenshot: checkout summary"
      }
    ]);
  });

  it("should compute removed evidence as a separate evidence-change branch", () => {
    const previous = getEvidenceReviewScenario("accepted");
    const current = getEvidenceReviewScenario("accepted");

    expect(previous).not.toBeNull();
    expect(current).not.toBeNull();

    const comparison = compareEvidenceReviewRuns({
      pair: "unit-removed-evidence",
      previousScenario: previous!,
      currentScenario: scenarioWithEvidenceChange(current!, "criterion-recovery", null)
    });

    expect(comparison.evidenceChanges.removed).toEqual([
      {
        criterionId: "criterion-recovery",
        title: "Recovery path",
        previousEvidenceId: "evidence-recovery",
        previousEvidenceTitle: "API proof: declined-card recovery"
      }
    ]);
  });

  it("should leave no-change evidence categories empty without generated prose fields", () => {
    const comparison = compareEvidenceReviewScenarios("failed-to-accepted");

    expect(comparison?.evidenceChanges).toEqual({
      added: [],
      replaced: [],
      removed: []
    });
    expect(Object.keys(comparison ?? {})).toEqual([
      "pair",
      "previousScenario",
      "currentScenario",
      "verdictChange",
      "criterionChanges",
      "evidenceChanges",
      "remainingBlockers"
    ]);
    expect(comparison).not.toHaveProperty("generatedParagraph");
    expect(comparison).not.toHaveProperty("aiExplanation");
    expect(comparison).not.toHaveProperty("llmSummary");
  });

  it("should reject unknown comparison pairs without creating comparison categories", () => {
    expect(compareEvidenceReviewScenarios("surprise")).toBeNull();
    expect(knownEvidenceReviewComparisonPairs).toEqual(["failed-to-accepted", "unresolved-missing-evidence"]);
  });
});

describe("required criteria status summary", () => {
  it("should count every required criterion as unreviewed in the initial state", () => {
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, everyCriterionMissing);

    expect(summary).toEqual({
      requiredTotal: 3,
      passingCount: 0,
      failingCount: 0,
      unreviewedCount: 3,
      missingEvidenceCount: 0,
      passingCriterionIds: [],
      failingCriterionIds: [],
      unreviewedCriterionIds: ["criterion-payment", "criterion-summary", "criterion-recovery"],
      missingEvidenceCriterionIds: []
    });
  });

  it("should move a criterion into passing once it is marked pass with selected evidence", () => {
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, [
      { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: "evidence-payment" },
      { criterionId: "criterion-summary", verdict: "unreviewed", selectedEvidenceId: null },
      { criterionId: "criterion-recovery", verdict: "unreviewed", selectedEvidenceId: null }
    ]);

    expect(summary.passingCount).toBe(1);
    expect(summary.passingCriterionIds).toEqual(["criterion-payment"]);
    expect(summary.unreviewedCount).toBe(2);
    expect(summary.failingCount).toBe(0);
    expect(summary.missingEvidenceCount).toBe(0);
  });

  it("should classify a passing criterion without evidence as missing evidence, not passing", () => {
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, [
      { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: null },
      { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
      { criterionId: "criterion-recovery", verdict: "fail", selectedEvidenceId: "evidence-recovery" }
    ]);

    expect(summary.missingEvidenceCriterionIds).toEqual(["criterion-payment"]);
    expect(summary.failingCriterionIds).toEqual(["criterion-recovery"]);
    expect(summary.passingCriterionIds).toEqual(["criterion-summary"]);
    expect(summary.unreviewedCount).toBe(0);
  });

  it("should count every required criterion as passing in the accepted state", () => {
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, everyCriterionAccepted);

    expect(summary.passingCount).toBe(3);
    expect(summary.passingCriterionIds).toEqual(["criterion-payment", "criterion-summary", "criterion-recovery"]);
    expect(summary.failingCount).toBe(0);
    expect(summary.unreviewedCount).toBe(0);
    expect(summary.missingEvidenceCount).toBe(0);
  });

  it("should partition required criteria so the four buckets always sum to the required total", () => {
    const mixed: CriterionReviewState[] = [
      { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: "evidence-payment" },
      { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: null },
      { criterionId: "criterion-recovery", verdict: "fail", selectedEvidenceId: "evidence-recovery" }
    ];
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, mixed);

    expect(summary.requiredTotal).toBe(seededEvidenceReview.criteria.filter((criterion) => criterion.required).length);
    expect(
      summary.passingCount + summary.failingCount + summary.unreviewedCount + summary.missingEvidenceCount
    ).toBe(summary.requiredTotal);
  });

  it("should agree with the final verdict classification for the same review state", () => {
    const states: CriterionReviewState[] = [
      { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: null },
      { criterionId: "criterion-summary", verdict: "unreviewed", selectedEvidenceId: null },
      { criterionId: "criterion-recovery", verdict: "fail", selectedEvidenceId: "evidence-recovery" }
    ];
    const summary = summarizeRequiredCriteria(seededEvidenceReview.criteria, states);
    const verdict = calculateReviewVerdict(seededEvidenceReview.criteria, states);

    expect(summary.unreviewedCriterionIds).toEqual(verdict.missingCriterionIds);
    expect(summary.failingCriterionIds).toEqual(verdict.failedCriterionIds);
    expect(summary.missingEvidenceCriterionIds).toEqual(verdict.missingEvidenceCriterionIds);
  });
});
