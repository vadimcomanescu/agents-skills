import { describe, expect, it } from "vitest";
import {
  createInitialDossierImportState,
  currentDossierFingerprint,
  evaluateDossier,
  parseEvidenceDossierBundle,
  recordReviewerJudgment,
  upsertReviewerJudgment,
  type EvidenceDossierBundle,
  type ReviewerJudgment
} from "./evidence-dossier";

const completeBundle: EvidenceDossierBundle = {
  requestId: "request-12",
  bundleFingerprint: "bundle-v1",
  currentStateFingerprint: "state-v1",
  generatedAt: "2026-05-28T12:00:00.000Z",
  acceptanceCriteria: [
    {
      id: "AC-R12-001",
      expectedBehavior: "Invalid bundles are rejected with concrete errors.",
      claimedVerdict: "pass",
      requiredProofTypes: ["state-json", "screenshot", "manifest"],
      artifacts: [
        {
          id: "state",
          type: "state-json",
          path: "r12-state.json",
          fingerprint: "state-fingerprint",
          observedAssertions: ["Dossier status is invalid-bundle."]
        },
        {
          id: "shot",
          type: "screenshot",
          path: "r12.png",
          fingerprint: "shot-fingerprint",
          observedAssertions: []
        },
        {
          id: "manifest",
          type: "manifest",
          path: "ac-r12-001-manifest.json",
          fingerprint: "manifest-fingerprint",
          observedAssertions: []
        }
      ]
    },
    {
      id: "AC-R12-002",
      expectedBehavior: "Complete dossier renders grouped evidence.",
      claimedVerdict: "pass",
      requiredProofTypes: ["state-json", "screenshot", "manifest"],
      artifacts: [
        {
          id: "state-2",
          type: "state-json",
          path: "r12-complete.json",
          fingerprint: "state-2-fingerprint",
          observedAssertions: ["AC card shows required and present proof types."]
        },
        {
          id: "shot-2",
          type: "screenshot",
          path: "r12-complete.png",
          fingerprint: "shot-2-fingerprint",
          observedAssertions: []
        },
        {
          id: "manifest-2",
          type: "manifest",
          path: "ac-r12-002-manifest.json",
          fingerprint: "manifest-2-fingerprint",
          observedAssertions: []
        }
      ]
    }
  ]
};

function loaded(bundle: EvidenceDossierBundle = completeBundle) {
  const result = parseEvidenceDossierBundle(JSON.stringify(bundle));
  if (result.status !== "loaded") {
    throw new Error("Fixture bundle should be valid.");
  }
  return result;
}

function judgment(criterionId: string, value: "pass" | "fail" | "needs-review"): ReviewerJudgment {
  return {
    criterionId,
    judgment: value,
    note: `${value} note`,
    recordedAt: "2026-05-28T12:05:00.000Z",
    bundleFingerprint: "bundle-v1",
    currentStateFingerprint: "state-v1"
  };
}

describe("evidence dossier", () => {
  it("starts not-loaded before a bundle is imported", () => {
    const state = createInitialDossierImportState();
    const evaluation = evaluateDossier({ importState: state, judgments: [] });

    expect(evaluation.status).toBe("not-loaded");
    expect(evaluation.blockers).toEqual(["No evidence dossier bundle loaded."]);
  });

  it("rejects invalid JSON and malformed bundles with concrete validation errors", () => {
    const invalidJson = parseEvidenceDossierBundle("{");
    expect(invalidJson.status).toBe("invalid-bundle");
    expect(invalidJson.errors).toEqual([
      expect.objectContaining({ path: "$", code: "invalid_json" })
    ]);

    const malformed = parseEvidenceDossierBundle(
      JSON.stringify({
        requestId: "",
        bundleFingerprint: "bundle",
        currentStateFingerprint: "state",
        generatedAt: "now",
        acceptanceCriteria: [
          {
            id: "AC-1",
            expectedBehavior: "x",
            claimedVerdict: "pass",
            requiredProofTypes: ["screenshot", "telepathy"],
            artifacts: [
              {
                id: "a1",
                type: "manifest",
                fingerprint: "f1",
                observedAssertions: ["Observed"]
              }
            ]
          }
        ]
      })
    );

    expect(malformed.status).toBe("invalid-bundle");
    expect(malformed.errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "$.requestId",
        "$.acceptanceCriteria[0].requiredProofTypes[1]",
        "$.acceptanceCriteria[0].artifacts[0].path"
      ])
    );
  });

  it("does not mark artifact metadata alone as complete proof", () => {
    const bundle: EvidenceDossierBundle = {
      ...completeBundle,
      acceptanceCriteria: [
        {
          id: "AC-R12-003",
          expectedBehavior: "Metadata-only artifacts do not pass.",
          claimedVerdict: "pass",
          requiredProofTypes: ["state-json", "screenshot"],
          artifacts: [
            {
              id: "metadata-only",
              type: "state-json",
              path: "r12-metadata.json",
              fingerprint: "f",
              observedAssertions: []
            }
          ]
        }
      ]
    };

    const evaluation = evaluateDossier({ importState: loaded(bundle), judgments: [] });

    expect(evaluation.status).toBe("incomplete");
    expect(evaluation.criteria[0]?.completeProof).toBe(false);
    expect(evaluation.criteria[0]?.blockers).toEqual([
      "Missing proof type: screenshot",
      "Missing observed assertions.",
      "Missing reviewer judgment."
    ]);
  });

  it("blocks pass for incomplete ACs but allows fail and needs-review", () => {
    const bundle: EvidenceDossierBundle = {
      ...completeBundle,
      acceptanceCriteria: [
        {
          ...completeBundle.acceptanceCriteria[0]!,
          requiredProofTypes: ["state-json", "trace"],
          artifacts: completeBundle.acceptanceCriteria[0]!.artifacts.filter((artifact) => artifact.type === "state-json")
        }
      ]
    };
    const importState = loaded(bundle);

    expect(
      recordReviewerJudgment({
        mode: "reviewer",
        importState,
        currentJudgments: [],
        criterionId: "AC-R12-001",
        judgment: "pass",
        note: "should not pass",
        recordedAt: "2026-05-28T12:06:00.000Z"
      })
    ).toEqual(
      expect.objectContaining({
        accepted: false,
        reason: "Pass is blocked until required proof types and observed assertions are present."
      })
    );

    expect(
      recordReviewerJudgment({
        mode: "reviewer",
        importState,
        currentJudgments: [],
        criterionId: "AC-R12-001",
        judgment: "fail",
        note: "missing trace",
        recordedAt: "2026-05-28T12:06:00.000Z"
      })
    ).toEqual(expect.objectContaining({ accepted: true }));

    expect(
      recordReviewerJudgment({
        mode: "reviewer",
        importState,
        currentJudgments: [],
        criterionId: "AC-R12-001",
        judgment: "needs-review",
        note: "needs trace",
        recordedAt: "2026-05-28T12:06:00.000Z"
      })
    ).toEqual(expect.objectContaining({ accepted: true }));
  });

  it("enforces reviewer-only judgment recording", () => {
    const result = recordReviewerJudgment({
      mode: "operator",
      importState: loaded(),
      currentJudgments: [],
      criterionId: "AC-R12-001",
      judgment: "pass",
      note: "operator should not judge",
      recordedAt: "2026-05-28T12:06:00.000Z"
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("Reviewer judgments can only be recorded in reviewer mode.");
  });

  it("computes strict status precedence", () => {
    const importState = loaded();

    expect(evaluateDossier({ importState, judgments: [] }).status).toBe("incomplete");
    expect(evaluateDossier({ importState, judgments: [judgment("AC-R12-001", "fail")] }).status).toBe("failed");
    expect(evaluateDossier({ importState, judgments: [judgment("AC-R12-001", "needs-review"), judgment("AC-R12-002", "pass")] }).status).toBe("needs-review");
    expect(evaluateDossier({ importState, judgments: [judgment("AC-R12-001", "pass"), judgment("AC-R12-002", "pass")] }).status).toBe("passed");
    expect(
      evaluateDossier({
        importState,
        judgments: [judgment("AC-R12-001", "pass"), judgment("AC-R12-002", "pass")],
        currentStateFingerprint: "state-v2"
      }).status
    ).toBe("stale");
  });

  it("preserves stale judgments with original note and fingerprints", () => {
    const importState = loaded();
    const stale = evaluateDossier({
      importState,
      judgments: [judgment("AC-R12-001", "pass"), judgment("AC-R12-002", "pass")],
      currentStateFingerprint: "state-v2"
    });

    expect(stale.status).toBe("stale");
    expect(stale.criteria[0]?.reviewerJudgment).toEqual(
      expect.objectContaining({
        judgment: "pass",
        note: "pass note",
        bundleFingerprint: "bundle-v1",
        currentStateFingerprint: "state-v1",
        stale: true
      })
    );
  });

  it("upserts reviewer judgments without mutating imported bundle state", () => {
    const importState = loaded();
    const attempt = recordReviewerJudgment({
      mode: "reviewer",
      importState,
      currentJudgments: [],
      criterionId: "AC-R12-001",
      judgment: "pass",
      note: "reviewed",
      recordedAt: "2026-05-28T12:06:00.000Z"
    });

    expect(attempt.accepted).toBe(true);
    if (!attempt.accepted) {
      throw new Error("expected accepted judgment");
    }

    const nextJudgments = upsertReviewerJudgment([], attempt.judgment);
    expect(nextJudgments).toHaveLength(1);
    expect(importState.bundle.acceptanceCriteria[0]?.artifacts[0]?.observedAssertions).toEqual([
      "Dossier status is invalid-bundle."
    ]);
  });

  it("creates deterministic current fingerprints from bundle identity and salt", () => {
    expect(currentDossierFingerprint(completeBundle, "same")).toBe(currentDossierFingerprint(completeBundle, "same"));
    expect(currentDossierFingerprint(completeBundle, "same")).not.toBe(currentDossierFingerprint(completeBundle, "changed"));
  });
});
