import { describe, expect, it } from "vitest";
import { seededEvidenceReview } from "./evidence-review";
import {
  createDefaultEvidenceExplorerQuery,
  evidenceExplorerFixtureManifest,
  filterEvidenceExplorerRows,
  queryEvidenceExplorer,
  resetEvidenceExplorerQuery,
  toEvidenceExplorerRows,
  type EvidenceExplorerQuery
} from "./evidence-explorer";
import type { EvidenceImportResult } from "./evidence-import";
import type { EvidenceVerificationState } from "./evidence-verification";

const mixedImportResult: EvidenceImportResult = {
  acceptedRows: [
    {
      id: "imp-001-payment-replay",
      title: "Replay: payment confirmation imported",
      kind: "browser",
      criterionId: "criterion-payment",
      source: "trace/payment-confirmation.zip"
    },
    {
      id: "imp-002-summary-api",
      title: "API order summary totals",
      kind: "api",
      criterionId: "criterion-summary",
      source: "api/orders/summary.json"
    },
    {
      id: "imp-003-recovery-test",
      title: "Recovery path unit proof",
      kind: "test",
      criterionId: "criterion-recovery",
      source: "vitest/recovery-path.log"
    },
    {
      id: "imp-004-payment-api",
      title: "Payment gateway status",
      kind: "api",
      criterionId: "criterion-payment",
      source: "api/payments/status.json"
    },
    {
      id: "imp-005-summary-browser",
      title: "Summary screenshot totals",
      kind: "browser",
      criterionId: "criterion-summary",
      source: "screenshots/summary-totals.png"
    },
    {
      id: "imp-006-recovery-test",
      title: "Recovery path unit proof",
      kind: "test",
      criterionId: "criterion-recovery",
      source: "vitest/recovery-path-retry.log"
    }
  ],
  rejectedRows: [
    {
      lineNumber: 8,
      rawValues: ["rejected-secret-token", "Rejected secret only", "browser", "criterion-payment", ""],
      rawText: "rejected-secret-token,Rejected secret only,browser,criterion-payment,",
      reasons: [
        {
          code: "missing_source",
          message: "Evidence source is required."
        }
      ]
    }
  ]
};

const verificationState: EvidenceVerificationState = {
  "imp-001-payment-replay": {
    rowId: "imp-001-payment-replay",
    status: "verified",
    attemptCount: 1,
    retryAvailable: false,
    statusCode: "source_verified",
    message: "Imported evidence source verified.",
    updatedAt: "2026-05-28T08:00:00.000Z"
  },
  "imp-002-summary-api": {
    rowId: "imp-002-summary-api",
    status: "failed",
    attemptCount: 1,
    retryAvailable: true,
    statusCode: "source_unreachable_once",
    message: "Verification failed.",
    updatedAt: "2026-05-28T08:01:00.000Z"
  },
  "imp-003-recovery-test": {
    rowId: "imp-003-recovery-test",
    status: "checking",
    attemptCount: 1,
    retryAvailable: false,
    statusCode: "verification_checking",
    message: "Checking imported evidence source.",
    updatedAt: "2026-05-28T08:02:00.000Z"
  },
  "imp-004-payment-api": {
    rowId: "imp-004-payment-api",
    status: "unverified",
    attemptCount: 0,
    retryAvailable: false,
    statusCode: "verification_pending",
    message: "Imported evidence is waiting for verification.",
    updatedAt: null
  },
  "imp-005-summary-browser": {
    rowId: "imp-005-summary-browser",
    status: "verified",
    attemptCount: 1,
    retryAvailable: false,
    statusCode: "source_verified",
    message: "Imported evidence source verified.",
    updatedAt: "2026-05-28T08:03:00.000Z"
  },
  "imp-006-recovery-test": {
    rowId: "imp-006-recovery-test",
    status: "failed",
    attemptCount: 1,
    retryAvailable: true,
    statusCode: "source_unreachable_once",
    message: "Verification failed.",
    updatedAt: "2026-05-28T08:04:00.000Z"
  }
};

function rowIds(query: Partial<EvidenceExplorerQuery> = {}) {
  return queryEvidenceExplorer({
    rows: explorerRows,
    query: {
      ...createDefaultEvidenceExplorerQuery(),
      ...query
    }
  }).rows.map((row) => row.id);
}

const explorerRows = toEvidenceExplorerRows({
  seededReview: seededEvidenceReview,
  importResult: mixedImportResult,
  verificationState
});

describe("evidence explorer rows", () => {
  it("should combine seeded and accepted imported rows while excluding rejected rows", () => {
    expect(explorerRows).toHaveLength(9);
    expect(explorerRows.map((row) => row.id)).toEqual([
      "imp-002-summary-api",
      "evidence-recovery",
      "imp-004-payment-api",
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "imp-001-payment-replay",
      "evidence-payment",
      "evidence-summary",
      "imp-005-summary-browser"
    ]);
    expect(explorerRows).not.toContainEqual(expect.objectContaining({ id: "rejected-secret-token" }));
    expect(explorerRows).toContainEqual({
      id: "evidence-payment",
      title: "Replay: successful payment",
      kind: "browser",
      criterionId: "criterion-payment",
      source: "seeded:evidence-payment",
      origin: "seeded",
      verificationStatus: "not-applicable"
    });
    expect(explorerRows).toContainEqual({
      id: "imp-002-summary-api",
      title: "API order summary totals",
      kind: "api",
      criterionId: "criterion-summary",
      source: "api/orders/summary.json",
      origin: "imported",
      verificationStatus: "failed"
    });
  });

  it("should prove the mixed fixture thresholds used by request 10", () => {
    expect(evidenceExplorerFixtureManifest(explorerRows, mixedImportResult)).toEqual({
      seededRowCount: 3,
      acceptedImportedRowCount: 6,
      rejectedImportedRowCount: 1,
      kindCount: 3,
      criterionCount: 3,
      concreteVerificationStatusCount: 4,
      hasEvidenceIdTieBreakerFixture: true
    });
  });
});

describe("evidence explorer search and filters", () => {
  it("should trim and case-normalize search for each approved field", () => {
    expect(rowIds({ search: "  PAYMENT-CONFIRMATION  " })).toEqual(["imp-001-payment-replay"]);
    expect(rowIds({ search: "screenshot totals" })).toEqual(["imp-005-summary-browser"]);
    expect(rowIds({ search: "CRITERION-RECOVERY" })).toEqual([
      "evidence-recovery",
      "imp-003-recovery-test",
      "imp-006-recovery-test"
    ]);
    expect(rowIds({ search: "api/orders" })).toEqual(["imp-002-summary-api"]);
    expect(rowIds({ search: "   " })).toEqual(rowIds());
  });

  it("should not search rejected row raw text", () => {
    expect(rowIds({ search: "rejected-secret-token" })).toEqual([]);
  });

  it("should filter each family and intersect combined filters", () => {
    expect(rowIds({ origin: "seeded" })).toEqual(["evidence-recovery", "evidence-payment", "evidence-summary"]);
    expect(rowIds({ kind: "api" })).toEqual(["imp-002-summary-api", "evidence-recovery", "imp-004-payment-api"]);
    expect(rowIds({ criterionId: "criterion-summary" })).toEqual([
      "imp-002-summary-api",
      "evidence-summary",
      "imp-005-summary-browser"
    ]);
    expect(rowIds({ verificationStatus: "unverified" })).toEqual(["imp-004-payment-api"]);
    expect(rowIds({ verificationStatus: "checking" })).toEqual(["imp-003-recovery-test"]);
    expect(rowIds({ verificationStatus: "failed" })).toEqual(["imp-002-summary-api", "imp-006-recovery-test"]);
    expect(rowIds({ verificationStatus: "verified" })).toEqual([
      "imp-001-payment-replay",
      "imp-005-summary-browser"
    ]);
    expect(rowIds({ origin: "imported", kind: "test", criterionId: "criterion-recovery" })).toEqual([
      "imp-003-recovery-test",
      "imp-006-recovery-test"
    ]);
  });

  it("should return exact empty-state membership without mutating the query", () => {
    const query: EvidenceExplorerQuery = {
      ...createDefaultEvidenceExplorerQuery(),
      search: "no matching evidence",
      origin: "imported"
    };

    const result = queryEvidenceExplorer({ rows: explorerRows, query });

    expect(result.rows).toEqual([]);
    expect(result.query).toEqual(query);
  });
});

describe("evidence explorer sorting and reset", () => {
  it("should sort every field in both directions with id tie-breaker", () => {
    expect(rowIds({ sortField: "title", sortDirection: "asc" })).toEqual([
      "imp-002-summary-api",
      "evidence-recovery",
      "imp-004-payment-api",
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "imp-001-payment-replay",
      "evidence-payment",
      "evidence-summary",
      "imp-005-summary-browser"
    ]);
    expect(rowIds({ sortField: "title", sortDirection: "desc" })).toEqual([
      "imp-005-summary-browser",
      "evidence-summary",
      "evidence-payment",
      "imp-001-payment-replay",
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "imp-004-payment-api",
      "evidence-recovery",
      "imp-002-summary-api"
    ]);
    expect(rowIds({ sortField: "criterionId", sortDirection: "asc" })).toEqual([
      "evidence-payment",
      "imp-001-payment-replay",
      "imp-004-payment-api",
      "evidence-recovery",
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "evidence-summary",
      "imp-002-summary-api",
      "imp-005-summary-browser"
    ]);
    expect(rowIds({ sortField: "criterionId", sortDirection: "desc" })).toEqual([
      "evidence-summary",
      "imp-002-summary-api",
      "imp-005-summary-browser",
      "evidence-recovery",
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "evidence-payment",
      "imp-001-payment-replay",
      "imp-004-payment-api"
    ]);
    expect(rowIds({ sortField: "kind", sortDirection: "asc" })).toEqual([
      "evidence-recovery",
      "imp-002-summary-api",
      "imp-004-payment-api",
      "evidence-payment",
      "evidence-summary",
      "imp-001-payment-replay",
      "imp-005-summary-browser",
      "imp-003-recovery-test",
      "imp-006-recovery-test"
    ]);
    expect(rowIds({ sortField: "kind", sortDirection: "desc" })).toEqual([
      "imp-003-recovery-test",
      "imp-006-recovery-test",
      "evidence-payment",
      "evidence-summary",
      "imp-001-payment-replay",
      "imp-005-summary-browser",
      "evidence-recovery",
      "imp-002-summary-api",
      "imp-004-payment-api"
    ]);
    expect(rowIds({ sortField: "origin", sortDirection: "asc" })).toEqual([
      "imp-001-payment-replay",
      "imp-002-summary-api",
      "imp-003-recovery-test",
      "imp-004-payment-api",
      "imp-005-summary-browser",
      "imp-006-recovery-test",
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary"
    ]);
    expect(rowIds({ sortField: "origin", sortDirection: "desc" })).toEqual([
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary",
      "imp-001-payment-replay",
      "imp-002-summary-api",
      "imp-003-recovery-test",
      "imp-004-payment-api",
      "imp-005-summary-browser",
      "imp-006-recovery-test"
    ]);
  });

  it("should use the approved verification status order and exact reverse", () => {
    expect(rowIds({ sortField: "verificationStatus", sortDirection: "asc" })).toEqual([
      "imp-003-recovery-test",
      "imp-002-summary-api",
      "imp-006-recovery-test",
      "imp-004-payment-api",
      "imp-001-payment-replay",
      "imp-005-summary-browser",
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary"
    ]);
    expect(rowIds({ sortField: "verificationStatus", sortDirection: "desc" })).toEqual([
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary",
      "imp-001-payment-replay",
      "imp-005-summary-browser",
      "imp-004-payment-api",
      "imp-002-summary-api",
      "imp-006-recovery-test",
      "imp-003-recovery-test"
    ]);
  });

  it("should clear to default controls and the initial ordered full result set", () => {
    const dirtyQuery: EvidenceExplorerQuery = {
      search: "payment",
      origin: "imported",
      kind: "api",
      criterionId: "criterion-payment",
      verificationStatus: "unverified",
      sortField: "verificationStatus",
      sortDirection: "desc"
    };

    const resetQuery = resetEvidenceExplorerQuery(dirtyQuery);

    expect(resetQuery).toEqual(createDefaultEvidenceExplorerQuery());
    expect(filterEvidenceExplorerRows(explorerRows, resetQuery).map((row) => row.id)).toEqual(rowIds());
    expect(resetEvidenceExplorerQuery(resetQuery)).toEqual(resetQuery);
  });
});
