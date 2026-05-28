import { describe, expect, it } from "vitest";
import { createDefaultEvidenceExplorerQuery, type EvidenceExplorerRow } from "./evidence-explorer";
import {
  buildHandoffPack,
  canonicalJson,
  compareHandoffPackFingerprints,
  evaluateHandoffPack,
  fingerprintHandoffSources,
  type HandoffPackSourceState
} from "./evidence-handoff-pack";
import type { EvidenceImportHistoryJson } from "./evidence-import-history";
import type { EvidenceVerificationState } from "./evidence-verification";

const importHistory: EvidenceImportHistoryJson = {
  current: {
    acceptedRows: [
      {
        id: "r11-payment",
        title: "Payment trace",
        kind: "browser",
        criterionId: "criterion-payment",
        source: "trace/payment.zip"
      },
      {
        id: "r11-summary",
        title: "Summary API",
        kind: "api",
        criterionId: "criterion-summary",
        source: "api/summary.json"
      }
    ],
    rejectedRows: [
      {
        lineNumber: 4,
        rawValues: ["", "Missing id", "test", "criterion-recovery", "recovery.log"],
        rawText: ",Missing id,test,criterion-recovery,recovery.log",
        reasons: [
          {
            code: "missing_id",
            message: "Evidence id is required."
          }
        ]
      }
    ]
  },
  canUndo: true,
  historyEntries: [
    {
      id: "import-1",
      actionType: "import",
      acceptedCount: 2,
      rejectedCount: 1,
      acceptedEvidenceIds: ["r11-payment", "r11-summary"],
      rejectedLineNumbers: [4],
      status: "active"
    }
  ]
};

const verificationState: EvidenceVerificationState = {
  "r11-payment": {
    rowId: "r11-payment",
    status: "verified",
    attemptCount: 2,
    retryAvailable: false,
    statusCode: "source_verified",
    message: "Imported evidence source verified.",
    startedAt: "2026-05-28T09:00:00.000Z",
    completedAt: "2026-05-28T09:00:01.000Z",
    updatedAt: "2026-05-28T09:00:01.000Z"
  },
  "r11-summary": {
    rowId: "r11-summary",
    status: "unverified",
    attemptCount: 0,
    retryAvailable: false,
    statusCode: "verification_pending",
    message: "Imported evidence is waiting for verification.",
    updatedAt: null
  },
  "removed-row": {
    rowId: "removed-row",
    status: "failed",
    attemptCount: 1,
    retryAvailable: true,
    statusCode: "source_unreachable_once",
    message: "Removed row should not affect retained verification fingerprint.",
    updatedAt: "2026-05-28T09:00:02.000Z"
  }
};

const explorerRows: EvidenceExplorerRow[] = [
  {
    id: "r11-summary",
    title: "Summary API",
    kind: "api",
    criterionId: "criterion-summary",
    source: "api/summary.json",
    origin: "imported",
    verificationStatus: "unverified"
  },
  {
    id: "r11-payment",
    title: "Payment trace",
    kind: "browser",
    criterionId: "criterion-payment",
    source: "trace/payment.zip",
    origin: "imported",
    verificationStatus: "verified"
  }
];

const sourceState: HandoffPackSourceState = {
  importState: importHistory.current,
  importHistory,
  verificationState,
  explorerQuery: {
    ...createDefaultEvidenceExplorerQuery(),
    search: "r11",
    origin: "imported",
    sortField: "title",
    sortDirection: "asc"
  },
  explorerRows,
  exportJson: JSON.stringify({
    evidenceRows: [
      { id: "r11-payment", verificationStatus: "verified" },
      { id: "r11-summary", verificationStatus: "unverified" }
    ]
  })
};

function withSource(overrides: Partial<HandoffPackSourceState>): HandoffPackSourceState {
  return {
    ...sourceState,
    ...overrides
  };
}

describe("evidence handoff pack canonical fingerprints", () => {
  it("should canonicalize object keys while preserving order-sensitive arrays", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(canonicalJson(["r11-summary", "r11-payment"])).not.toBe(
      canonicalJson(["r11-payment", "r11-summary"])
    );
  });

  it("should build a fresh pack with required provenance fields and embedded export JSON", () => {
    const pack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "operator",
      packId: "pack-r11-001",
      generatedAt: "2026-05-28T09:05:00.000Z"
    });

    expect(pack).toEqual(
      expect.objectContaining({
        packId: "pack-r11-001",
        generatedAt: "2026-05-28T09:05:00.000Z",
        modeAtGeneration: "operator",
        embeddedExportJson: sourceState.exportJson,
        isStale: false,
        staleCategories: []
      })
    );
    expect(pack.importSummary).toEqual({
      acceptedCount: 2,
      rejectedCount: 1,
      acceptedIds: ["r11-payment", "r11-summary"],
      rejectedLineNumbers: [4]
    });
    expect(pack.importHistorySummary.entries).toEqual(importHistory.historyEntries);
    expect(pack.verificationStatusMap).toEqual({
      "r11-payment": expect.objectContaining({ status: "verified", attemptCount: 2 }),
      "r11-summary": expect.objectContaining({ status: "unverified", attemptCount: 0 })
    });
    expect(pack.verificationStatusMap["removed-row"]).toBeUndefined();
    expect(pack.explorerQuery).toEqual(sourceState.explorerQuery);
    expect(pack.explorerResultIds).toEqual(["r11-summary", "r11-payment"]);
  });

  it("should keep source fingerprints independent from pack id generated time and current mode", () => {
    const operatorPack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "operator",
      packId: "pack-a",
      generatedAt: "2026-05-28T09:05:00.000Z"
    });
    const reviewerPack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "reviewer",
      packId: "pack-b",
      generatedAt: "2026-05-28T09:06:00.000Z"
    });

    expect(operatorPack.sourceFingerprints).toEqual(reviewerPack.sourceFingerprints);
    expect(evaluateHandoffPack(operatorPack, sourceState)).toEqual({
      isStale: false,
      staleCategories: [],
      packFingerprints: operatorPack.sourceFingerprints,
      currentFingerprints: operatorPack.sourceFingerprints
    });
  });

  it("should report exact stale categories for isolated source changes", () => {
    const pack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "operator",
      packId: "pack-r11-001",
      generatedAt: "2026-05-28T09:05:00.000Z"
    });
    const baseline = pack.sourceFingerprints;

    const importChanged = fingerprintHandoffSources(
      withSource({
        importState: {
          acceptedRows: sourceState.importState?.acceptedRows.slice(0, 1) ?? [],
          rejectedRows: sourceState.importState?.rejectedRows ?? []
        }
      })
    );
    expect(compareHandoffPackFingerprints(baseline, importChanged)).toEqual(["import"]);

    const importHistoryChanged = fingerprintHandoffSources({
      ...sourceState,
      importHistory: {
        ...importHistory,
        canUndo: false
      }
    });
    expect(compareHandoffPackFingerprints(baseline, importHistoryChanged)).toEqual(["importHistory"]);

    const verificationChanged = fingerprintHandoffSources({
      ...sourceState,
      verificationState: {
        ...verificationState,
        "r11-summary": {
          ...verificationState["r11-summary"],
          status: "checking",
          attemptCount: 1,
          statusCode: "verification_checking",
          updatedAt: "2026-05-28T09:07:00.000Z"
        }
      }
    });
    expect(compareHandoffPackFingerprints(baseline, verificationChanged)).toEqual(["verification"]);

    const explorerChanged = fingerprintHandoffSources({
      ...sourceState,
      explorerRows: [...explorerRows].reverse()
    });
    expect(compareHandoffPackFingerprints(baseline, explorerChanged)).toEqual(["explorer"]);

    const exportChanged = fingerprintHandoffSources({
      ...sourceState,
      exportJson: JSON.stringify({ evidenceRows: [] })
    });
    expect(compareHandoffPackFingerprints(baseline, exportChanged)).toEqual(["export"]);
  });

  it("should avoid fake verification staleness for import membership changes without retained-row metadata changes", () => {
    const pack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "operator",
      packId: "pack-r11-001",
      generatedAt: "2026-05-28T09:05:00.000Z"
    });
    const nextImportState = {
      acceptedRows: sourceState.importState?.acceptedRows.slice(0, 1) ?? [],
      rejectedRows: sourceState.importState?.rejectedRows ?? []
    };
    const changedState = {
      ...sourceState,
      importState: nextImportState,
      verificationState: {
        "r11-payment": verificationState["r11-payment"]
      }
    };

    expect(evaluateHandoffPack(pack, changedState).staleCategories).toEqual(["import"]);
  });

  it("should report combined verification and export staleness when both retained-row metadata and export payload change", () => {
    const pack = buildHandoffPack({
      sourceState,
      modeAtGeneration: "operator",
      packId: "pack-r11-001",
      generatedAt: "2026-05-28T09:05:00.000Z"
    });
    const status = evaluateHandoffPack(
      pack,
      withSource({
        verificationState: {
          ...verificationState,
          "r11-summary": {
            ...verificationState["r11-summary"],
            status: "verified",
            attemptCount: 1,
            statusCode: "source_verified",
            updatedAt: "2026-05-28T09:07:00.000Z"
          }
        },
        exportJson: JSON.stringify({
          evidenceRows: [
            { id: "r11-payment", verificationStatus: "verified" },
            { id: "r11-summary", verificationStatus: "verified" }
          ]
        })
      })
    );

    expect(status.isStale).toBe(true);
    expect(status.staleCategories).toEqual(["verification", "export"]);
  });
});
