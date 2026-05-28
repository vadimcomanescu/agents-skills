import type {
  AcceptedEvidenceImportRow,
  EvidenceImportResult,
  RejectedEvidenceImportRow
} from "./evidence-import";

export type ImportHistoryEntryStatus = "active" | "undone";

export type ImportHistoryEntry = {
  id: string;
  actionType: "import";
  acceptedCount: number;
  rejectedCount: number;
  acceptedEvidenceIds: string[];
  rejectedLineNumbers: number[];
  status: ImportHistoryEntryStatus;
};

type StoredImportHistoryEntry = Omit<ImportHistoryEntry, "status"> & {
  result: EvidenceImportResult;
};

export type EvidenceImportHistoryState = {
  entries: StoredImportHistoryEntry[];
  activeEntryIndex: number;
  baseStateAvailable: boolean;
  nextEntryNumber: number;
};

export type EvidenceImportHistoryJson = {
  current: EvidenceImportResult | null;
  canUndo: boolean;
  historyEntries: ImportHistoryEntry[];
};

const maxImportStatesInPath = 3;

export function createInitialImportHistoryState(): EvidenceImportHistoryState {
  return {
    entries: [],
    activeEntryIndex: -1,
    baseStateAvailable: true,
    nextEntryNumber: 1
  };
}

export function applyEvidenceImport(
  state: EvidenceImportHistoryState,
  result: EvidenceImportResult
): EvidenceImportHistoryState {
  const activeEntries = state.entries.slice(0, state.activeEntryIndex + 1);
  const nextEntries = [
    ...activeEntries,
    createStoredEntry(`import-${state.nextEntryNumber}`, result)
  ];
  const trimmedEntries = nextEntries.slice(Math.max(0, nextEntries.length - maxImportStatesInPath));
  const removedEntryCount = nextEntries.length - trimmedEntries.length;

  return {
    entries: trimmedEntries,
    activeEntryIndex: trimmedEntries.length - 1,
    baseStateAvailable: state.baseStateAvailable && removedEntryCount === 0,
    nextEntryNumber: state.nextEntryNumber + 1
  };
}

export function undoEvidenceImport(state: EvidenceImportHistoryState): EvidenceImportHistoryState {
  if (state.activeEntryIndex > 0) {
    return {
      ...state,
      activeEntryIndex: state.activeEntryIndex - 1
    };
  }

  if (state.activeEntryIndex === 0 && state.baseStateAvailable) {
    return {
      ...state,
      activeEntryIndex: -1
    };
  }

  return state;
}

export function canUndoEvidenceImport(state: EvidenceImportHistoryState): boolean {
  return state.activeEntryIndex > 0 || (state.activeEntryIndex === 0 && state.baseStateAvailable);
}

export function currentImportResult(state: EvidenceImportHistoryState): EvidenceImportResult | null {
  if (state.activeEntryIndex < 0) {
    return null;
  }

  const activeEntry = state.entries[state.activeEntryIndex];
  return activeEntry ? copyImportResult(activeEntry.result) : null;
}

export function exportableAcceptedRows(state: EvidenceImportHistoryState): AcceptedEvidenceImportRow[] {
  return currentImportResult(state)?.acceptedRows ?? [];
}

export function visibleImportHistoryEntries(state: EvidenceImportHistoryState): ImportHistoryEntry[] {
  return state.entries.map((entry, index) => ({
    id: entry.id,
    actionType: entry.actionType,
    acceptedCount: entry.acceptedCount,
    rejectedCount: entry.rejectedCount,
    acceptedEvidenceIds: [...entry.acceptedEvidenceIds],
    rejectedLineNumbers: [...entry.rejectedLineNumbers],
    status: index <= state.activeEntryIndex ? "active" : "undone"
  }));
}

export function importHistoryStateForJson(state: EvidenceImportHistoryState): EvidenceImportHistoryJson {
  return {
    current: currentImportResult(state),
    canUndo: canUndoEvidenceImport(state),
    historyEntries: visibleImportHistoryEntries(state)
  };
}

function createStoredEntry(id: string, result: EvidenceImportResult): StoredImportHistoryEntry {
  const storedResult = copyImportResult(result);

  return {
    id,
    actionType: "import",
    acceptedCount: storedResult.acceptedRows.length,
    rejectedCount: storedResult.rejectedRows.length,
    acceptedEvidenceIds: storedResult.acceptedRows.map((row) => row.id),
    rejectedLineNumbers: storedResult.rejectedRows.map((row) => row.lineNumber),
    result: storedResult
  };
}

function copyImportResult(result: EvidenceImportResult): EvidenceImportResult {
  return {
    acceptedRows: result.acceptedRows.map(copyAcceptedRow),
    rejectedRows: result.rejectedRows.map(copyRejectedRow)
  };
}

function copyAcceptedRow(row: AcceptedEvidenceImportRow): AcceptedEvidenceImportRow {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    criterionId: row.criterionId,
    source: row.source
  };
}

function copyRejectedRow(row: RejectedEvidenceImportRow): RejectedEvidenceImportRow {
  return {
    lineNumber: row.lineNumber,
    rawValues: [...row.rawValues],
    rawText: row.rawText,
    reasons: row.reasons.map((reason) => ({
      code: reason.code,
      message: reason.message
    }))
  };
}
