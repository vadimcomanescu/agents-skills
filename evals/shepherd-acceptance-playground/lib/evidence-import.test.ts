import { describe, expect, it } from "vitest";
import { seededEvidenceReview } from "./evidence-review";
import {
  parseEvidenceCsv,
  serializeAcceptedEvidence,
  validateEvidenceCsvInput,
  type EvidenceImportReasonCode
} from "./evidence-import";

const validHeader = "id,title,kind,criterionId,source";

function reasonCodes(csv: string): EvidenceImportReasonCode[] {
  return parseEvidenceCsv(csv, seededEvidenceReview).rejectedRows.flatMap((row) =>
    row.reasons.map((reason) => reason.code)
  );
}

describe("evidence CSV import", () => {
  it("should accept one fully valid row under the approved five-column header", () => {
    const result = parseEvidenceCsv(
      `${validHeader}\nimport-payment,Imported payment proof,browser,criterion-payment,trace.zip`,
      seededEvidenceReview
    );

    expect(result.acceptedRows).toEqual([
      {
        id: "import-payment",
        title: "Imported payment proof",
        kind: "browser",
        criterionId: "criterion-payment",
        source: "trace.zip"
      }
    ]);
    expect(result.rejectedRows).toEqual([]);
  });

  it("should partially accept valid rows and reject invalid rows in the same import", () => {
    const result = parseEvidenceCsv(
      [
        validHeader,
        "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
        ",Missing id proof,test,criterion-summary,state.json",
        "import-recovery,Imported recovery proof,api,criterion-recovery,recovery.json"
      ].join("\n"),
      seededEvidenceReview
    );

    expect(result.acceptedRows.map((row) => row.id)).toEqual(["import-payment", "import-recovery"]);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0]).toEqual({
      lineNumber: 3,
      rawValues: ["", "Missing id proof", "test", "criterion-summary", "state.json"],
      rawText: ",Missing id proof,test,criterion-summary,state.json",
      reasons: [
        {
          code: "missing_id",
          message: "Evidence id is required."
        }
      ]
    });
  });

  it("should report every approved invalid reason code with line numbers and raw row values", () => {
    const result = parseEvidenceCsv(
      [
        validHeader,
        ",Missing id proof,browser,criterion-payment,trace.zip",
        "missing-title,,browser,criterion-payment,trace.zip",
        "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip",
        "missing-criterion,Missing criterion proof,browser,,trace.zip",
        "unknown-criterion,Unknown criterion proof,browser,criterion-surprise,trace.zip",
        "evidence-payment,Seeded duplicate proof,browser,criterion-payment,trace.zip",
        "missing-source,Missing source proof,browser,criterion-payment,",
        "wrong-columns,Wrong columns,browser,criterion-payment,trace.zip,extra"
      ].join("\n"),
      seededEvidenceReview
    );

    expect(result.acceptedRows).toEqual([]);
    expect(result.rejectedRows.map((row) => row.lineNumber)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.rejectedRows[7]?.rawText).toBe("wrong-columns,Wrong columns,browser,criterion-payment,trace.zip,extra");
    expect(result.rejectedRows[7]?.rawValues).toEqual([
      "wrong-columns",
      "Wrong columns",
      "browser",
      "criterion-payment",
      "trace.zip",
      "extra"
    ]);
    expect(result.rejectedRows.map((row) => row.reasons[0]?.code)).toEqual([
      "missing_id",
      "missing_title",
      "unknown_kind",
      "missing_criterion_id",
      "unknown_criterion_id",
      "duplicate_id",
      "missing_source",
      "wrong_column_count"
    ]);
  });

  it("should reject duplicate ids from any earlier non-empty import row id", () => {
    const result = parseEvidenceCsv(
      [
        validHeader,
        "batch-dup,Unknown criterion proof,browser,criterion-surprise,trace.zip",
        "batch-dup,Otherwise valid duplicate,browser,criterion-payment,trace-2.zip",
        "malformed-dup,Wrong columns,browser,criterion-payment,trace.zip,extra",
        "malformed-dup,Duplicate after wrong columns,browser,criterion-payment,trace-3.zip"
      ].join("\n"),
      seededEvidenceReview
    );

    expect(result.acceptedRows).toEqual([]);
    expect(result.rejectedRows[0]?.reasons.map((reason) => reason.code)).toEqual(["unknown_criterion_id"]);
    expect(result.rejectedRows[1]?.reasons.map((reason) => reason.code)).toEqual(["duplicate_id"]);
    expect(result.rejectedRows[2]?.reasons.map((reason) => reason.code)).toEqual(["wrong_column_count"]);
    expect(result.rejectedRows[3]?.reasons.map((reason) => reason.code)).toEqual(["duplicate_id"]);
  });

  it("should reject imports with a missing, reordered, or unsupported-column header", () => {
    const missingHeader = parseEvidenceCsv(
      "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
      seededEvidenceReview
    );
    const reorderedHeader = parseEvidenceCsv(
      "title,id,kind,criterionId,source\nImported payment proof,import-payment,browser,criterion-payment,trace.zip",
      seededEvidenceReview
    );
    const unsupportedColumnHeader = parseEvidenceCsv(
      "id,title,kind,criterionId,source,notes\nimport-payment,Imported payment proof,browser,criterion-payment,trace.zip,extra",
      seededEvidenceReview
    );

    expect(missingHeader.acceptedRows).toEqual([]);
    expect(missingHeader.rejectedRows[0]?.reasons[0]?.code).toBe("invalid_header");
    expect(reorderedHeader.acceptedRows).toEqual([]);
    expect(reorderedHeader.rejectedRows[0]?.reasons[0]?.code).toBe("invalid_header");
    expect(unsupportedColumnHeader.acceptedRows).toEqual([]);
    expect(unsupportedColumnHeader.rejectedRows[0]?.reasons[0]?.code).toBe("invalid_header");
  });

  it("should return no accepted rows for an all-invalid import", () => {
    const result = parseEvidenceCsv(
      [
        validHeader,
        ",Missing id proof,browser,criterion-payment,trace.zip",
        "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip"
      ].join("\n"),
      seededEvidenceReview
    );

    expect(result.acceptedRows).toEqual([]);
    expect(result.rejectedRows).toHaveLength(2);
    expect(reasonCodes(`${validHeader}\nmissing-source,Missing source proof,browser,criterion-payment,`)).toEqual([
      "missing_source"
    ]);
  });
});

describe("evidence JSON export", () => {
  it("should serialize accepted rows only with additive verification status", () => {
    const result = parseEvidenceCsv(
      [
        validHeader,
        "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
        ",Missing id proof,test,criterion-summary,state.json"
      ].join("\n"),
      seededEvidenceReview
    );

    const parsed = JSON.parse(serializeAcceptedEvidence(result.acceptedRows));

    expect(parsed).toEqual({
      evidenceRows: [
        {
          id: "import-payment",
          title: "Imported payment proof",
          kind: "browser",
          criterionId: "criterion-payment",
          source: "trace.zip",
          verificationStatus: "unverified"
        }
      ]
    });
    expect(JSON.stringify(parsed)).not.toContain("Missing id proof");
    expect(JSON.stringify(parsed)).not.toContain("missing_id");
  });
});

describe("evidence CSV import validation", () => {
  it("should block empty, whitespace-only, and exact-header-only CSV as no-data input", () => {
    for (const csv of ["", " \n\t ", validHeader, `${validHeader}\n\n`]) {
      const validation = validateEvidenceCsvInput(csv, seededEvidenceReview);

      expect(validation.mode).toBe("blocked");
      expect(validation.canImport).toBe(false);
      expect(validation.validRowCount).toBe(0);
      expect(validation.invalidRowCount).toBe(0);
      expect(validation.summary).toContain("No evidence rows");
      expect(validation.sourceHash).toMatch(/^csv-[a-f0-9]{8}$/);
      expect(validation.diagnostics).toEqual([
        expect.objectContaining({
          lineNumber: 1,
          field: "data",
          reasonCode: "no_data",
          suggestedFix: `Paste ${validHeader} followed by at least one evidence row.`
        })
      ]);
    }
  });

  it("should block missing, reordered, and unsupported-column headers with the exact suggested header", () => {
    const cases = [
      "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
      "title,id,kind,criterionId,source\nImported payment proof,import-payment,browser,criterion-payment,trace.zip",
      "id,title,kind,criterionId,source,notes\nimport-payment,Imported payment proof,browser,criterion-payment,trace.zip,extra"
    ];

    for (const csv of cases) {
      const validation = validateEvidenceCsvInput(csv, seededEvidenceReview);

      expect(validation.mode).toBe("blocked");
      expect(validation.canImport).toBe(false);
      expect(validation.validRowCount).toBe(0);
      expect(validation.invalidRowCount).toBe(0);
      expect(validation.diagnostics).toEqual([
        expect.objectContaining({
          lineNumber: 1,
          field: "header",
          reasonCode: "invalid_header",
          reason: "CSV header must be exactly id,title,kind,criterionId,source.",
          suggestedFix: `Replace the first line with ${validHeader}.`
        })
      ]);
      expect(validation.diagnostics[0]?.badValue).toBe(csv.split("\n")[0]);
    }
  });

  it("should warn for mixed valid-header input with parser-parity counts and row diagnostics", () => {
    const csv = [
      validHeader,
      "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
      ",Missing id proof,test,criterion-summary,state.json",
      "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip"
    ].join("\n");
    const parsed = parseEvidenceCsv(csv, seededEvidenceReview);
    const validation = validateEvidenceCsvInput(csv, seededEvidenceReview);

    expect(validation.mode).toBe("warning");
    expect(validation.canImport).toBe(true);
    expect(validation.validRowCount).toBe(parsed.acceptedRows.length);
    expect(validation.invalidRowCount).toBe(parsed.rejectedRows.length);
    expect(validation.diagnostics.map((diagnostic) => diagnostic.lineNumber)).toEqual([3, 4]);
    expect(validation.diagnostics).toEqual([
      expect.objectContaining({
        lineNumber: 3,
        field: "id",
        column: 1,
        badValue: "",
        reasonCode: "missing_id",
        reason: "Evidence id is required."
      }),
      expect.objectContaining({
        lineNumber: 4,
        field: "kind",
        column: 3,
        badValue: "video",
        reasonCode: "unknown_kind",
        reason: "Evidence kind must be browser, api, or test."
      })
    ]);
  });

  it("should keep all-invalid valid-header CSV in warning mode and importable", () => {
    const csv = [
      validHeader,
      ",Missing id proof,browser,criterion-payment,trace.zip",
      "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip"
    ].join("\n");
    const validation = validateEvidenceCsvInput(csv, seededEvidenceReview);

    expect(validation.mode).toBe("warning");
    expect(validation.canImport).toBe(true);
    expect(validation.validRowCount).toBe(0);
    expect(validation.invalidRowCount).toBe(2);
    expect(validation.diagnostics.map((diagnostic) => diagnostic.reasonCode)).toEqual(["missing_id", "unknown_kind"]);
  });

  it("should return clear mode only for an exact header with valid non-empty data rows and no invalid rows", () => {
    const validation = validateEvidenceCsvInput(
      `${validHeader}\nimport-payment,Imported payment proof,browser,criterion-payment,trace.zip`,
      seededEvidenceReview
    );

    expect(validation).toEqual(
      expect.objectContaining({
        mode: "clear",
        canImport: true,
        validRowCount: 1,
        invalidRowCount: 0,
        diagnostics: []
      })
    );
    expect(validation.summary).toContain("1 valid evidence row");
  });

  it("should clear stale blocked diagnostics when corrected to warning or clear input", () => {
    const blocked = validateEvidenceCsvInput("bad,header\nx,y", seededEvidenceReview);
    const warning = validateEvidenceCsvInput(`${validHeader}\n,Missing id proof,browser,criterion-payment,trace.zip`, seededEvidenceReview);
    const clear = validateEvidenceCsvInput(
      `${validHeader}\nimport-payment,Imported payment proof,browser,criterion-payment,trace.zip`,
      seededEvidenceReview
    );

    expect(blocked.mode).toBe("blocked");
    expect(blocked.diagnostics.map((diagnostic) => diagnostic.reasonCode)).toEqual(["invalid_header"]);
    expect(warning.mode).toBe("warning");
    expect(warning.canImport).toBe(true);
    expect(warning.diagnostics.map((diagnostic) => diagnostic.reasonCode)).toEqual(["missing_id"]);
    expect(JSON.stringify(warning)).not.toContain("invalid_header");
    expect(clear.mode).toBe("clear");
    expect(clear.canImport).toBe(true);
    expect(clear.diagnostics).toEqual([]);
    expect(JSON.stringify(clear)).not.toContain("invalid_header");
  });

  it("should expose per-field diagnostics for every existing request-04 reason code", () => {
    const validation = validateEvidenceCsvInput(
      [
        validHeader,
        ",Missing id proof,browser,criterion-payment,trace.zip",
        "missing-title,,browser,criterion-payment,trace.zip",
        "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip",
        "missing-criterion,Missing criterion proof,browser,,trace.zip",
        "unknown-criterion,Unknown criterion proof,browser,criterion-surprise,trace.zip",
        "evidence-payment,Seeded duplicate proof,browser,criterion-payment,trace.zip",
        "missing-source,Missing source proof,browser,criterion-payment,",
        "wrong-columns,Wrong columns,browser,criterion-payment,trace.zip,extra"
      ].join("\n"),
      seededEvidenceReview
    );

    expect(validation.diagnostics).toEqual([
      expect.objectContaining({ lineNumber: 2, field: "id", column: 1, badValue: "", reasonCode: "missing_id" }),
      expect.objectContaining({ lineNumber: 3, field: "title", column: 2, badValue: "", reasonCode: "missing_title" }),
      expect.objectContaining({ lineNumber: 4, field: "kind", column: 3, badValue: "video", reasonCode: "unknown_kind" }),
      expect.objectContaining({ lineNumber: 5, field: "criterionId", column: 4, badValue: "", reasonCode: "missing_criterion_id" }),
      expect.objectContaining({
        lineNumber: 6,
        field: "criterionId",
        column: 4,
        badValue: "criterion-surprise",
        reasonCode: "unknown_criterion_id"
      }),
      expect.objectContaining({ lineNumber: 7, field: "id", column: 1, badValue: "evidence-payment", reasonCode: "duplicate_id" }),
      expect.objectContaining({ lineNumber: 8, field: "source", column: 5, badValue: "", reasonCode: "missing_source" }),
      expect.objectContaining({
        lineNumber: 9,
        field: "row",
        badValue: "wrong-columns,Wrong columns,browser,criterion-payment,trace.zip,extra",
        reasonCode: "wrong_column_count"
      })
    ]);
  });

  it("should mark blocked states as ineligible for import-handler mutation", () => {
    const blocked = validateEvidenceCsvInput(validHeader, seededEvidenceReview);
    const warning = validateEvidenceCsvInput(`${validHeader}\n,Missing id,browser,criterion-payment,trace.zip`, seededEvidenceReview);
    const clear = validateEvidenceCsvInput(`${validHeader}\nclear-row,Clear row,browser,criterion-payment,clear.json`, seededEvidenceReview);

    expect(blocked.canImport).toBe(false);
    expect(blocked.mode).toBe("blocked");
    expect(warning.canImport).toBe(true);
    expect(clear.canImport).toBe(true);
  });
});
