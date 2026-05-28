import { describe, expect, it } from "vitest";
import {
  annotateAcceptedRowsWithVerification,
  beginEvidenceVerification,
  deterministicFailOnceEvidenceId,
  resolveEvidenceVerification,
  syncEvidenceVerificationState,
  type EvidenceVerificationState
} from "./evidence-verification";
import type { AcceptedEvidenceImportRow } from "./evidence-import";

const failOnceRow: AcceptedEvidenceImportRow = {
  id: deterministicFailOnceEvidenceId,
  title: "Request 08 payment proof",
  kind: "browser",
  criterionId: "criterion-payment",
  source: "r08-payment.json"
};

const summaryRow: AcceptedEvidenceImportRow = {
  id: "r08-summary-proof",
  title: "Request 08 summary proof",
  kind: "api",
  criterionId: "criterion-summary",
  source: "r08-summary.json"
};

describe("imported evidence verification state", () => {
  it("should initialize accepted imported rows as unverified and exclude absent rejected or seeded ids", () => {
    const state = syncEvidenceVerificationState([failOnceRow, summaryRow], {
      "seeded-evidence-payment": {
        rowId: "seeded-evidence-payment",
        status: "verified",
        attemptCount: 1,
        retryAvailable: false,
        statusCode: "source_verified",
        message: "Imported evidence verified.",
        updatedAt: "2026-05-28T09:00:00.000Z"
      }
    });

    expect(Object.keys(state)).toEqual(["r08-fail-once-payment", "r08-summary-proof"]);
    expect(state["r08-fail-once-payment"]).toEqual({
      rowId: "r08-fail-once-payment",
      status: "unverified",
      attemptCount: 0,
      retryAvailable: false,
      statusCode: "verification_pending",
      message: "Imported evidence is waiting for verification.",
      updatedAt: null
    });
    expect(state["seeded-evidence-payment"]).toBeUndefined();
  });

  it("should deterministically fail the first fail-once attempt and verify the retry", () => {
    const initialized = syncEvidenceVerificationState([failOnceRow]);
    const firstChecking = beginEvidenceVerification(initialized, failOnceRow.id, "2026-05-28T09:00:00.000Z");

    expect(firstChecking[failOnceRow.id]).toEqual(
      expect.objectContaining({
        status: "checking",
        attemptCount: 1,
        retryAvailable: false,
        statusCode: "verification_checking"
      })
    );

    const failed = resolveEvidenceVerification(firstChecking, failOnceRow.id, "2026-05-28T09:00:00.600Z");

    expect(failed[failOnceRow.id]).toEqual(
      expect.objectContaining({
        status: "failed",
        attemptCount: 1,
        retryAvailable: true,
        statusCode: "source_unreachable_once",
        message: "Verification failed for the imported payment source. Retry is available."
      })
    );

    const retryChecking = beginEvidenceVerification(failed, failOnceRow.id, "2026-05-28T09:00:01.000Z");
    const verified = resolveEvidenceVerification(retryChecking, failOnceRow.id, "2026-05-28T09:00:01.600Z");

    expect(retryChecking[failOnceRow.id]).toEqual(
      expect.objectContaining({
        status: "checking",
        attemptCount: 2,
        retryAvailable: false,
        statusCode: "verification_checking"
      })
    );
    expect(verified[failOnceRow.id]).toEqual(
      expect.objectContaining({
        status: "verified",
        attemptCount: 2,
        retryAvailable: false,
        statusCode: "source_verified",
        message: "Imported evidence source verified."
      })
    );
  });

  it("should verify non-fail-once rows on the first completed attempt", () => {
    const initialized = syncEvidenceVerificationState([summaryRow]);
    const checking = beginEvidenceVerification(initialized, summaryRow.id, "2026-05-28T09:00:00.000Z");
    const verified = resolveEvidenceVerification(checking, summaryRow.id, "2026-05-28T09:00:00.600Z");

    expect(verified[summaryRow.id]).toEqual(
      expect.objectContaining({
        status: "verified",
        attemptCount: 1,
        retryAvailable: false,
        statusCode: "source_verified",
        message: "Imported evidence source verified."
      })
    );
  });

  it("should ignore duplicate verification actions while checking without changing unrelated rows", () => {
    const initialized = syncEvidenceVerificationState([failOnceRow, summaryRow]);
    const firstChecking = beginEvidenceVerification(initialized, failOnceRow.id, "2026-05-28T09:00:00.000Z");
    const duplicate = beginEvidenceVerification(firstChecking, failOnceRow.id, "2026-05-28T09:00:00.100Z");

    expect(duplicate).toEqual(firstChecking);
    expect(duplicate[summaryRow.id]).toEqual(initialized[summaryRow.id]);
  });

  it("should annotate accepted-row export with verification status while preserving source fields", () => {
    const initialized = syncEvidenceVerificationState([failOnceRow, summaryRow]);
    const checking = beginEvidenceVerification(initialized, failOnceRow.id, "2026-05-28T09:00:00.000Z");

    expect(annotateAcceptedRowsWithVerification([failOnceRow, summaryRow], checking)).toEqual([
      {
        id: "r08-fail-once-payment",
        title: "Request 08 payment proof",
        kind: "browser",
        criterionId: "criterion-payment",
        source: "r08-payment.json",
        verificationStatus: "checking"
      },
      {
        id: "r08-summary-proof",
        title: "Request 08 summary proof",
        kind: "api",
        criterionId: "criterion-summary",
        source: "r08-summary.json",
        verificationStatus: "unverified"
      }
    ]);
  });

  it("should prune absent rows and preserve active entries without mutating import rows", () => {
    const importedRows = [failOnceRow, summaryRow];
    const initialized = syncEvidenceVerificationState(importedRows);
    const checking = beginEvidenceVerification(initialized, failOnceRow.id, "2026-05-28T09:00:00.000Z");
    const synced = syncEvidenceVerificationState([summaryRow], checking);

    expect(synced).toEqual<EvidenceVerificationState>({
      [summaryRow.id]: initialized[summaryRow.id]
    });
    expect(importedRows).toEqual([failOnceRow, summaryRow]);
  });
});
