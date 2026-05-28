import type { EvidenceExplorerQuery, EvidenceExplorerRow } from "./evidence-explorer";
import type { EvidenceImportHistoryJson } from "./evidence-import-history";
import type { EvidenceVerificationState } from "./evidence-verification";
import type { WorkflowMode } from "./workflow-mode";

export type HandoffPackStaleCategory = "import" | "importHistory" | "verification" | "explorer" | "export";

export type HandoffPackSourceFingerprints = Record<HandoffPackStaleCategory, string>;

export type HandoffPackSourceState = {
  importState: EvidenceImportHistoryJson["current"];
  importHistory: EvidenceImportHistoryJson;
  verificationState: EvidenceVerificationState;
  explorerQuery: EvidenceExplorerQuery;
  explorerRows: EvidenceExplorerRow[];
  exportJson: string;
};

export type HandoffPackImportSummary = {
  acceptedCount: number;
  rejectedCount: number;
  acceptedIds: string[];
  rejectedLineNumbers: number[];
};

export type HandoffPackImportHistorySummary = {
  canUndo: boolean;
  entries: EvidenceImportHistoryJson["historyEntries"];
};

export type HandoffPackVerificationSummary = Record<
  string,
  {
    status: string;
    attemptCount: number;
    retryAvailable: boolean;
    statusCode: string;
    updatedAt: string | null;
    startedAt?: string;
    completedAt?: string;
  }
>;

export type HandoffPack = {
  packId: string;
  generatedAt: string;
  modeAtGeneration: WorkflowMode;
  sourceFingerprints: HandoffPackSourceFingerprints;
  importSummary: HandoffPackImportSummary;
  importHistorySummary: HandoffPackImportHistorySummary;
  verificationStatusMap: HandoffPackVerificationSummary;
  explorerQuery: EvidenceExplorerQuery;
  explorerResultIds: string[];
  embeddedExportJson: string;
  isStale: boolean;
  staleCategories: HandoffPackStaleCategory[];
};

export type HandoffPackStatus = {
  isStale: boolean;
  staleCategories: HandoffPackStaleCategory[];
  packFingerprints: HandoffPackSourceFingerprints | null;
  currentFingerprints: HandoffPackSourceFingerprints;
};

const staleCategoryOrder: HandoffPackStaleCategory[] = [
  "import",
  "importHistory",
  "verification",
  "explorer",
  "export"
];

export function buildHandoffPack({
  sourceState,
  modeAtGeneration,
  packId,
  generatedAt
}: {
  sourceState: HandoffPackSourceState;
  modeAtGeneration: WorkflowMode;
  packId: string;
  generatedAt: string;
}): HandoffPack {
  return {
    packId,
    generatedAt,
    modeAtGeneration,
    sourceFingerprints: fingerprintHandoffSources(sourceState),
    importSummary: summarizeImportState(sourceState.importState),
    importHistorySummary: summarizeImportHistory(sourceState.importHistory),
    verificationStatusMap: summarizeVerificationState(sourceState.verificationState, sourceState.importState),
    explorerQuery: cloneExplorerQuery(sourceState.explorerQuery),
    explorerResultIds: sourceState.explorerRows.map((row) => row.id),
    embeddedExportJson: sourceState.exportJson,
    isStale: false,
    staleCategories: []
  };
}

export function evaluateHandoffPack(pack: HandoffPack | null, currentState: HandoffPackSourceState): HandoffPackStatus {
  const currentFingerprints = fingerprintHandoffSources(currentState);
  if (!pack) {
    return {
      isStale: false,
      staleCategories: [],
      packFingerprints: null,
      currentFingerprints
    };
  }

  const staleCategories = comparePackToCurrentState(pack, currentState, currentFingerprints);

  return {
    isStale: staleCategories.length > 0,
    staleCategories,
    packFingerprints: pack.sourceFingerprints,
    currentFingerprints
  };
}

export function withHandoffPackStatus(pack: HandoffPack, currentState: HandoffPackSourceState): HandoffPack {
  const status = evaluateHandoffPack(pack, currentState);
  return {
    ...pack,
    isStale: status.isStale,
    staleCategories: status.staleCategories
  };
}

export function fingerprintHandoffSources(sourceState: HandoffPackSourceState): HandoffPackSourceFingerprints {
  return {
    import: stableFingerprint(normalizeImportState(sourceState.importState)),
    importHistory: stableFingerprint(summarizeImportHistory(sourceState.importHistory)),
    verification: stableFingerprint(normalizeVerificationState(sourceState.verificationState)),
    explorer: stableFingerprint({
      query: cloneExplorerQuery(sourceState.explorerQuery),
      resultIds: sourceState.explorerRows.map((row) => row.id)
    }),
    export: stableFingerprint(sourceState.exportJson)
  };
}

export function compareHandoffPackFingerprints(
  packFingerprints: HandoffPackSourceFingerprints,
  currentFingerprints: HandoffPackSourceFingerprints
): HandoffPackStaleCategory[] {
  return staleCategoryOrder.filter((category) => packFingerprints[category] !== currentFingerprints[category]);
}

export function stableFingerprint(value: unknown): string {
  return canonicalJson(value);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function summarizeImportState(importState: EvidenceImportHistoryJson["current"]): HandoffPackImportSummary {
  const normalized = normalizeImportState(importState);
  return {
    acceptedCount: normalized.acceptedRows.length,
    rejectedCount: normalized.rejectedRows.length,
    acceptedIds: normalized.acceptedRows.map((row) => row.id),
    rejectedLineNumbers: normalized.rejectedRows.map((row) => row.lineNumber)
  };
}

function summarizeImportHistory(importHistory: EvidenceImportHistoryJson): HandoffPackImportHistorySummary {
  return {
    canUndo: importHistory.canUndo,
    entries: importHistory.historyEntries.map((entry) => ({
      id: entry.id,
      actionType: entry.actionType,
      acceptedCount: entry.acceptedCount,
      rejectedCount: entry.rejectedCount,
      acceptedEvidenceIds: [...entry.acceptedEvidenceIds],
      rejectedLineNumbers: [...entry.rejectedLineNumbers],
      status: entry.status
    }))
  };
}

function summarizeVerificationState(
  verificationState: EvidenceVerificationState,
  importState: EvidenceImportHistoryJson["current"]
): HandoffPackVerificationSummary {
  const acceptedIds = new Set(importState?.acceptedRows.map((row) => row.id) ?? []);
  return Object.fromEntries(
    Object.entries(verificationState)
      .filter(([rowId]) => acceptedIds.has(rowId))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([rowId, entry]) => [
        rowId,
        {
          status: entry.status,
          attemptCount: entry.attemptCount,
          retryAvailable: entry.retryAvailable,
          statusCode: entry.statusCode,
          updatedAt: entry.updatedAt,
          ...(entry.startedAt ? { startedAt: entry.startedAt } : {}),
          ...(entry.completedAt ? { completedAt: entry.completedAt } : {})
        }
      ])
  );
}

function comparePackToCurrentState(
  pack: HandoffPack,
  currentState: HandoffPackSourceState,
  currentFingerprints: HandoffPackSourceFingerprints
): HandoffPackStaleCategory[] {
  return staleCategoryOrder.filter((category) => {
    if (category !== "verification") {
      return pack.sourceFingerprints[category] !== currentFingerprints[category];
    }

    const currentAcceptedIds = new Set(currentState.importState?.acceptedRows.map((row) => row.id) ?? []);
    const retainedIds = pack.importSummary.acceptedIds.filter((rowId) => currentAcceptedIds.has(rowId));
    const packRetainedVerification = Object.fromEntries(
      retainedIds.map((rowId) => [rowId, pack.verificationStatusMap[rowId] ?? null])
    );
    const currentRetainedVerification = Object.fromEntries(
      retainedIds.map((rowId) => [rowId, verificationEntryForComparison(currentState.verificationState[rowId])])
    );

    return stableFingerprint(packRetainedVerification) !== stableFingerprint(currentRetainedVerification);
  });
}

function normalizeVerificationState(verificationState: EvidenceVerificationState): HandoffPackVerificationSummary {
  return Object.fromEntries(
    Object.entries(verificationState)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([rowId, entry]) => [
        rowId,
        verificationEntryForComparison(entry)!
      ])
  );
}

function verificationEntryForComparison(entry: EvidenceVerificationState[string] | undefined) {
  if (!entry) {
    return null;
  }

  return {
    status: entry.status,
    attemptCount: entry.attemptCount,
    retryAvailable: entry.retryAvailable,
    statusCode: entry.statusCode,
    updatedAt: entry.updatedAt,
    ...(entry.startedAt ? { startedAt: entry.startedAt } : {}),
    ...(entry.completedAt ? { completedAt: entry.completedAt } : {})
  };
}

function normalizeImportState(importState: EvidenceImportHistoryJson["current"]) {
  return {
    acceptedRows:
      importState?.acceptedRows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        criterionId: row.criterionId,
        source: row.source
      })) ?? [],
    rejectedRows:
      importState?.rejectedRows.map((row) => ({
        lineNumber: row.lineNumber,
        rawValues: [...row.rawValues],
        rawText: row.rawText,
        reasons: row.reasons.map((reason) => ({
          code: reason.code,
          message: reason.message
        }))
      })) ?? []
  };
}

function cloneExplorerQuery(query: EvidenceExplorerQuery): EvidenceExplorerQuery {
  return {
    search: query.search,
    origin: query.origin,
    kind: query.kind,
    criterionId: query.criterionId,
    verificationStatus: query.verificationStatus,
    sortField: query.sortField,
    sortDirection: query.sortDirection
  };
}
