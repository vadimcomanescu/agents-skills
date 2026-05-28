import type { EvidenceOption, EvidenceReviewItem } from "./evidence-review";
import {
  annotateAcceptedRowsWithVerification,
  type EvidenceVerificationState
} from "./evidence-verification";

export type ImportedEvidenceKind = EvidenceOption["kind"];

export type AcceptedEvidenceImportRow = {
  id: string;
  title: string;
  kind: ImportedEvidenceKind;
  criterionId: string;
  source: string;
};

export type EvidenceImportReasonCode =
  | "missing_id"
  | "missing_title"
  | "unknown_kind"
  | "missing_criterion_id"
  | "unknown_criterion_id"
  | "duplicate_id"
  | "wrong_column_count"
  | "missing_source"
  | "invalid_header";

export type EvidenceImportRejectionReason = {
  code: EvidenceImportReasonCode;
  message: string;
};

export type RejectedEvidenceImportRow = {
  lineNumber: number;
  rawValues: string[];
  rawText: string;
  reasons: EvidenceImportRejectionReason[];
};

export type EvidenceImportResult = {
  acceptedRows: AcceptedEvidenceImportRow[];
  rejectedRows: RejectedEvidenceImportRow[];
};

export type EvidenceCsvValidationMode = "blocked" | "warning" | "clear";

export type EvidenceCsvValidationReasonCode = EvidenceImportReasonCode | "no_data";

export type EvidenceCsvValidationDiagnostic = {
  lineNumber: number;
  field: string;
  column?: number;
  badValue?: string;
  reasonCode: EvidenceCsvValidationReasonCode;
  reason: string;
  suggestedFix: string;
};

export type EvidenceCsvValidationState = {
  mode: EvidenceCsvValidationMode;
  canImport: boolean;
  summary: string;
  validRowCount: number;
  invalidRowCount: number;
  diagnostics: EvidenceCsvValidationDiagnostic[];
  sourceHash: string;
};

const approvedHeader = "id,title,kind,criterionId,source";
const expectedColumnCount = 5;

const reasonMessages: Record<EvidenceImportReasonCode, string> = {
  missing_id: "Evidence id is required.",
  missing_title: "Evidence title is required.",
  unknown_kind: "Evidence kind must be browser, api, or test.",
  missing_criterion_id: "Criterion id is required.",
  unknown_criterion_id: "Criterion id must match a seeded criterion.",
  duplicate_id: "Evidence id duplicates seeded evidence or an earlier import row.",
  wrong_column_count: "Evidence rows must contain exactly five comma-separated fields.",
  missing_source: "Evidence source is required.",
  invalid_header: "CSV header must be exactly id,title,kind,criterionId,source."
};

export function parseEvidenceCsv(csvText: string, review: EvidenceReviewItem): EvidenceImportResult {
  const lines = normalizeLines(csvText);
  const acceptedRows: AcceptedEvidenceImportRow[] = [];
  const rejectedRows: RejectedEvidenceImportRow[] = [];

  if (lines.length === 0 || lines[0] !== approvedHeader) {
    const rawText = lines[0] ?? "";
    rejectedRows.push({
      lineNumber: 1,
      rawValues: splitCsvLine(rawText),
      rawText,
      reasons: [createReason("invalid_header")]
    });
    return { acceptedRows, rejectedRows };
  }

  const knownCriterionIds = new Set(review.criteria.map((criterion) => criterion.id));
  const seenIds = new Set(review.evidence.map((evidence) => evidence.id));

  lines.forEach((rawText, index) => {
    if (index === 0 || rawText.trim() === "") {
      return;
    }

    const lineNumber = index + 1;
    const rawValues = splitCsvLine(rawText);

    if (rawValues.length !== expectedColumnCount) {
      trackImportRowId(rawValues, seenIds);
      rejectedRows.push({
        lineNumber,
        rawValues,
        rawText,
        reasons: [createReason("wrong_column_count")]
      });
      return;
    }

    const id = rawValues[0]?.trim() ?? "";
    const title = rawValues[1]?.trim() ?? "";
    const kindText = rawValues[2]?.trim() ?? "";
    const criterionId = rawValues[3]?.trim() ?? "";
    const source = rawValues[4]?.trim() ?? "";
    const reasons: EvidenceImportRejectionReason[] = [];

    if (id === "") {
      reasons.push(createReason("missing_id"));
    } else if (seenIds.has(id)) {
      reasons.push(createReason("duplicate_id"));
    }

    if (title === "") {
      reasons.push(createReason("missing_title"));
    }

    if (!isEvidenceKind(kindText)) {
      reasons.push(createReason("unknown_kind"));
    }

    if (criterionId === "") {
      reasons.push(createReason("missing_criterion_id"));
    } else if (!knownCriterionIds.has(criterionId)) {
      reasons.push(createReason("unknown_criterion_id"));
    }

    if (source === "") {
      reasons.push(createReason("missing_source"));
    }

    trackImportRowId(rawValues, seenIds);

    if (reasons.length > 0) {
      rejectedRows.push({
        lineNumber,
        rawValues,
        rawText,
        reasons
      });
      return;
    }

    if (!isEvidenceKind(kindText)) {
      throw new Error(`Invalid evidence kind passed validation: ${kindText}`);
    }

    acceptedRows.push({
      id,
      title,
      kind: kindText,
      criterionId,
      source
    });
  });

  return { acceptedRows, rejectedRows };
}

export function validateEvidenceCsvInput(csvText: string, review: EvidenceReviewItem): EvidenceCsvValidationState {
  const lines = normalizeLines(csvText);
  const sourceHash = hashCsvSource(csvText);

  if (lines.length === 0 || lines.every((line) => line.trim() === "")) {
    return blockedNoData(sourceHash);
  }

  if (lines[0] !== approvedHeader) {
    return {
      mode: "blocked",
      canImport: false,
      summary: "CSV header is not supported.",
      validRowCount: 0,
      invalidRowCount: 0,
      sourceHash,
      diagnostics: [createHeaderDiagnostic(lines[0] ?? "")]
    };
  }

  const hasDataRows = lines.slice(1).some((line) => line.trim() !== "");

  if (!hasDataRows) {
    return blockedNoData(sourceHash);
  }

  const parsed = parseEvidenceCsv(csvText, review);
  const diagnostics = parsed.rejectedRows.flatMap((row) =>
    row.reasons.map((reason) => createRowDiagnostic(row, reason, review))
  );
  const validRowCount = parsed.acceptedRows.length;
  const invalidRowCount = parsed.rejectedRows.length;

  if (invalidRowCount > 0) {
    return {
      mode: "warning",
      canImport: true,
      summary:
        validRowCount === 0
          ? `${invalidRowCount} evidence row${invalidRowCount === 1 ? "" : "s"} will be rejected; import can still record the result.`
          : `${validRowCount} valid evidence row${validRowCount === 1 ? "" : "s"} can import; ${invalidRowCount} row${invalidRowCount === 1 ? "" : "s"} need attention.`,
      validRowCount,
      invalidRowCount,
      diagnostics,
      sourceHash
    };
  }

  return {
    mode: "clear",
    canImport: true,
    summary: `${validRowCount} valid evidence row${validRowCount === 1 ? "" : "s"} ready to import.`,
    validRowCount,
    invalidRowCount: 0,
    diagnostics: [],
    sourceHash
  };
}

export function serializeAcceptedEvidence(
  acceptedRows: AcceptedEvidenceImportRow[],
  verificationState: EvidenceVerificationState = {}
): string {
  return JSON.stringify(
    {
      evidenceRows: annotateAcceptedRowsWithVerification(acceptedRows, verificationState)
    },
    null,
    2
  );
}

function normalizeLines(csvText: string): string[] {
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (normalized === "") {
    return [];
  }

  return normalized.split("\n");
}

function splitCsvLine(line: string): string[] {
  return line.split(",");
}

function trackImportRowId(rawValues: string[], seenIds: Set<string>) {
  const id = rawValues[0]?.trim() ?? "";

  if (id !== "") {
    seenIds.add(id);
  }
}

function createReason(code: EvidenceImportReasonCode): EvidenceImportRejectionReason {
  return {
    code,
    message: reasonMessages[code]
  };
}

function isEvidenceKind(kind: string): kind is ImportedEvidenceKind {
  return kind === "browser" || kind === "api" || kind === "test";
}

function blockedNoData(sourceHash: string): EvidenceCsvValidationState {
  return {
    mode: "blocked",
    canImport: false,
    summary: "No evidence rows to import.",
    validRowCount: 0,
    invalidRowCount: 0,
    sourceHash,
    diagnostics: [
      {
        lineNumber: 1,
        field: "data",
        reasonCode: "no_data",
        reason: "No evidence rows were provided.",
        suggestedFix: `Paste ${approvedHeader} followed by at least one evidence row.`
      }
    ]
  };
}

function createHeaderDiagnostic(observedHeader: string): EvidenceCsvValidationDiagnostic {
  return {
    lineNumber: 1,
    field: "header",
    badValue: observedHeader,
    reasonCode: "invalid_header",
    reason: reasonMessages.invalid_header,
    suggestedFix: `Replace the first line with ${approvedHeader}.`
  };
}

function createRowDiagnostic(
  row: RejectedEvidenceImportRow,
  reason: EvidenceImportRejectionReason,
  review: EvidenceReviewItem
): EvidenceCsvValidationDiagnostic {
  const field = fieldForReason(reason.code);
  const column = columnForReason(reason.code);
  const diagnostic: EvidenceCsvValidationDiagnostic = {
    lineNumber: row.lineNumber,
    field,
    reasonCode: reason.code,
    reason: reason.message,
    suggestedFix: suggestedFixForReason(reason.code, review)
  };

  if (column) {
    diagnostic.column = column;
    diagnostic.badValue = row.rawValues[column - 1]?.trim() ?? "";
  } else {
    diagnostic.badValue = row.rawText;
  }

  return diagnostic;
}

function fieldForReason(code: EvidenceImportReasonCode): string {
  switch (code) {
    case "missing_id":
    case "duplicate_id":
      return "id";
    case "missing_title":
      return "title";
    case "unknown_kind":
      return "kind";
    case "missing_criterion_id":
    case "unknown_criterion_id":
      return "criterionId";
    case "missing_source":
      return "source";
    case "wrong_column_count":
      return "row";
    case "invalid_header":
      return "header";
  }
}

function columnForReason(code: EvidenceImportReasonCode): number | undefined {
  switch (code) {
    case "missing_id":
    case "duplicate_id":
      return 1;
    case "missing_title":
      return 2;
    case "unknown_kind":
      return 3;
    case "missing_criterion_id":
    case "unknown_criterion_id":
      return 4;
    case "missing_source":
      return 5;
    case "wrong_column_count":
    case "invalid_header":
      return undefined;
  }
}

function suggestedFixForReason(code: EvidenceImportReasonCode, review: EvidenceReviewItem): string {
  switch (code) {
    case "missing_id":
      return "Add a unique evidence id in column 1.";
    case "missing_title":
      return "Add an evidence title in column 2.";
    case "unknown_kind":
      return "Use browser, api, or test in column 3.";
    case "missing_criterion_id":
      return "Add a seeded criterion id in column 4.";
    case "unknown_criterion_id":
      return `Use one of: ${review.criteria.map((criterion) => criterion.id).join(", ")}.`;
    case "duplicate_id":
      return "Use an id not already present in seeded evidence or earlier import rows.";
    case "wrong_column_count":
      return `Use exactly five columns: ${approvedHeader}.`;
    case "missing_source":
      return "Add a source path or URL in column 5.";
    case "invalid_header":
      return `Replace the first line with ${approvedHeader}.`;
  }
}

function hashCsvSource(csvText: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < csvText.length; index += 1) {
    hash ^= csvText.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `csv-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
