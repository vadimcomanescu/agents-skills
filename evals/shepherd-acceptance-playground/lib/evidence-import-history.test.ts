import { describe, expect, it } from "vitest";
import {
  applyEvidenceImport,
  createInitialImportHistoryState,
  currentImportResult,
  exportableAcceptedRows,
  importHistoryStateForJson,
  undoEvidenceImport
} from "./evidence-import-history";
import type { EvidenceImportResult } from "./evidence-import";

function importResult(
  acceptedIds: string[],
  rejectedLineNumbers: number[] = []
): EvidenceImportResult {
  return {
    acceptedRows: acceptedIds.map((id) => ({
      id,
      title: `Title ${id}`,
      kind: "browser",
      criterionId: "criterion-payment",
      source: `${id}.json`
    })),
    rejectedRows: rejectedLineNumbers.map((lineNumber) => ({
      lineNumber,
      rawValues: [`bad-${lineNumber}`],
      rawText: `bad-${lineNumber}`,
      reasons: [
        {
          code: "missing_id",
          message: "Evidence id is required."
        }
      ]
    }))
  };
}

function acceptedIds(result: EvidenceImportResult | null) {
  return result?.acceptedRows.map((row) => row.id) ?? [];
}

function rejectedLines(result: EvidenceImportResult | null) {
  return result?.rejectedRows.map((row) => row.lineNumber) ?? [];
}

describe("evidence import history", () => {
  it("should create visible import entries from accepted and rejected import result state", () => {
    const state = applyEvidenceImport(createInitialImportHistoryState(), importResult(["s1-a", "s1-b"], [4, 7]));
    const json = importHistoryStateForJson(state);

    expect(json.canUndo).toBe(true);
    expect(json.current.acceptedRows.map((row) => row.id)).toEqual(["s1-a", "s1-b"]);
    expect(json.current.rejectedRows.map((row) => row.lineNumber)).toEqual([4, 7]);
    expect(json.historyEntries).toEqual([
      {
        id: "import-1",
        actionType: "import",
        acceptedCount: 2,
        rejectedCount: 2,
        acceptedEvidenceIds: ["s1-a", "s1-b"],
        rejectedLineNumbers: [4, 7],
        status: "active"
      }
    ]);
  });

  it("should restore S2 then S1 with two consecutive undo actions from S3", () => {
    const s1 = importResult(["s1-payment"], [2]);
    const s2 = importResult(["s2-summary", "s2-recovery"], [3, 5]);
    const s3 = importResult(["s3-payment", "s3-summary", "s3-recovery"], [6]);
    const atS3 = [s1, s2, s3].reduce(applyEvidenceImport, createInitialImportHistoryState());

    const afterFirstUndo = undoEvidenceImport(atS3);
    expect(acceptedIds(currentImportResult(afterFirstUndo))).toEqual(["s2-summary", "s2-recovery"]);
    expect(rejectedLines(currentImportResult(afterFirstUndo))).toEqual([3, 5]);
    expect(exportableAcceptedRows(afterFirstUndo).map((row) => row.id)).toEqual(["s2-summary", "s2-recovery"]);

    const afterSecondUndo = undoEvidenceImport(afterFirstUndo);
    expect(acceptedIds(currentImportResult(afterSecondUndo))).toEqual(["s1-payment"]);
    expect(rejectedLines(currentImportResult(afterSecondUndo))).toEqual([2]);
    expect(exportableAcceptedRows(afterSecondUndo).map((row) => row.id)).toEqual(["s1-payment"]);
  });

  it("should keep empty-history undo as a no-op and undo the first import to the initial base state", () => {
    const initial = createInitialImportHistoryState();
    const emptyUndo = undoEvidenceImport(initial);

    expect(importHistoryStateForJson(emptyUndo)).toEqual(importHistoryStateForJson(initial));

    const afterFirstImport = applyEvidenceImport(initial, importResult(["first-import"], []));
    const baseState = undoEvidenceImport(afterFirstImport);

    expect(currentImportResult(baseState)).toBeNull();
    expect(exportableAcceptedRows(baseState)).toEqual([]);
    expect(importHistoryStateForJson(baseState).historyEntries).toEqual([
      expect.objectContaining({
        id: "import-1",
        status: "undone",
        acceptedEvidenceIds: ["first-import"]
      })
    ]);
  });

  it("should restore previous state and accepted-only export after a mixed import undo", () => {
    const previous = importResult(["prev-payment", "prev-summary"], [8]);
    const mixed = importResult(["mixed-new"], [3, 6]);
    const afterMixed = applyEvidenceImport(applyEvidenceImport(createInitialImportHistoryState(), previous), mixed);
    const restored = undoEvidenceImport(afterMixed);

    expect(acceptedIds(currentImportResult(restored))).toEqual(["prev-payment", "prev-summary"]);
    expect(rejectedLines(currentImportResult(restored))).toEqual([8]);
    expect(exportableAcceptedRows(restored).map((row) => row.id)).toEqual(["prev-payment", "prev-summary"]);
  });

  it("should restore previous state and export rows after an all-invalid import undo", () => {
    const previous = importResult(["prev-valid"], [9]);
    const allInvalid = importResult([], [2, 3, 4]);
    const afterInvalid = applyEvidenceImport(applyEvidenceImport(createInitialImportHistoryState(), previous), allInvalid);

    expect(currentImportResult(afterInvalid)?.acceptedRows).toEqual([]);
    expect(importHistoryStateForJson(afterInvalid).historyEntries.at(-1)).toEqual(
      expect.objectContaining({
        acceptedCount: 0,
        rejectedCount: 3,
        rejectedLineNumbers: [2, 3, 4],
        status: "active"
      })
    );

    const restored = undoEvidenceImport(afterInvalid);
    expect(acceptedIds(currentImportResult(restored))).toEqual(["prev-valid"]);
    expect(rejectedLines(currentImportResult(restored))).toEqual([9]);
    expect(exportableAcceptedRows(restored).map((row) => row.id)).toEqual(["prev-valid"]);
  });

  it("should remove forward history when importing again after undo", () => {
    const s1 = importResult(["s1"], [2]);
    const s2 = importResult(["s2"], [3]);
    const s3 = importResult(["s3-forward"], [4]);
    const s4 = importResult(["s4-branch"], [5]);
    const atS3 = [s1, s2, s3].reduce(applyEvidenceImport, createInitialImportHistoryState());
    const undoneToS2 = undoEvidenceImport(atS3);

    expect(importHistoryStateForJson(undoneToS2).historyEntries.map((entry) => entry.status)).toEqual([
      "active",
      "active",
      "undone"
    ]);

    const afterBranchImport = applyEvidenceImport(undoneToS2, s4);
    const branchJson = importHistoryStateForJson(afterBranchImport);

    expect(branchJson.historyEntries.map((entry) => entry.acceptedEvidenceIds)).toEqual([["s1"], ["s2"], ["s4-branch"]]);
    expect(JSON.stringify(branchJson)).not.toContain("s3-forward");
    expect(branchJson.historyEntries.map((entry) => entry.status)).toEqual(["active", "active", "active"]);

    const backToS2 = undoEvidenceImport(afterBranchImport);
    const backToS1 = undoEvidenceImport(backToS2);
    expect(acceptedIds(currentImportResult(backToS2))).toEqual(["s2"]);
    expect(acceptedIds(currentImportResult(backToS1))).toEqual(["s1"]);
  });

  it("should retain only the current import plus two prior import states in the undo path", () => {
    const s1 = importResult(["s1"], [2]);
    const s2 = importResult(["s2"], [3]);
    const s3 = importResult(["s3"], [4]);
    const s4 = importResult(["s4"], [5]);
    const state = [s1, s2, s3, s4].reduce(applyEvidenceImport, createInitialImportHistoryState());

    expect(importHistoryStateForJson(state).historyEntries.map((entry) => entry.acceptedEvidenceIds)).toEqual([
      ["s2"],
      ["s3"],
      ["s4"]
    ]);

    const backToS3 = undoEvidenceImport(state);
    const backToS2 = undoEvidenceImport(backToS3);
    const noFurtherImportUndo = undoEvidenceImport(backToS2);
    expect(acceptedIds(currentImportResult(backToS3))).toEqual(["s3"]);
    expect(acceptedIds(currentImportResult(backToS2))).toEqual(["s2"]);
    expect(acceptedIds(currentImportResult(noFurtherImportUndo))).toEqual(["s2"]);
  });
});
