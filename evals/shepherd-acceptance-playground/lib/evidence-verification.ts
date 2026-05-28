import type { AcceptedEvidenceImportRow } from "./evidence-import";

export type EvidenceVerificationStatus = "unverified" | "checking" | "failed" | "verified";

export type EvidenceVerificationEntry = {
  rowId: string;
  status: EvidenceVerificationStatus;
  attemptCount: number;
  retryAvailable: boolean;
  statusCode: string;
  message: string;
  updatedAt: string | null;
  startedAt?: string;
  completedAt?: string;
};

export type EvidenceVerificationState = Record<string, EvidenceVerificationEntry>;

export type AcceptedEvidenceExportRow = AcceptedEvidenceImportRow & {
  verificationStatus: EvidenceVerificationStatus;
};

export const deterministicFailOnceEvidenceId = "r08-fail-once-payment";
export const minimumCheckingDurationMs = 500;

const pendingEntry = {
  status: "unverified",
  attemptCount: 0,
  retryAvailable: false,
  statusCode: "verification_pending",
  message: "Imported evidence is waiting for verification.",
  updatedAt: null
} satisfies Omit<EvidenceVerificationEntry, "rowId">;

export function syncEvidenceVerificationState(
  acceptedRows: AcceptedEvidenceImportRow[],
  currentState: EvidenceVerificationState = {}
): EvidenceVerificationState {
  return acceptedRows.reduce<EvidenceVerificationState>((nextState, row) => {
    nextState[row.id] = currentState[row.id] ?? createPendingEntry(row.id);
    return nextState;
  }, {});
}

export function beginEvidenceVerification(
  state: EvidenceVerificationState,
  rowId: string,
  timestamp: string
): EvidenceVerificationState {
  const entry = state[rowId];

  if (!entry || entry.status === "checking" || entry.status === "verified") {
    return state;
  }

  return {
    ...state,
    [rowId]: {
      rowId,
      status: "checking",
      attemptCount: entry.attemptCount + 1,
      retryAvailable: false,
      statusCode: "verification_checking",
      message: "Checking imported evidence source.",
      startedAt: timestamp,
      updatedAt: timestamp
    }
  };
}

export function resolveEvidenceVerification(
  state: EvidenceVerificationState,
  rowId: string,
  timestamp: string
): EvidenceVerificationState {
  const entry = state[rowId];

  if (!entry || entry.status !== "checking") {
    return state;
  }

  if (shouldFailAttempt(rowId, entry.attemptCount)) {
    return {
      ...state,
      [rowId]: {
        ...entry,
        status: "failed",
        retryAvailable: true,
        statusCode: "source_unreachable_once",
        message: "Verification failed for the imported payment source. Retry is available.",
        completedAt: timestamp,
        updatedAt: timestamp
      }
    };
  }

  return {
    ...state,
    [rowId]: {
      ...entry,
      status: "verified",
      retryAvailable: false,
      statusCode: "source_verified",
      message: "Imported evidence source verified.",
      completedAt: timestamp,
      updatedAt: timestamp
    }
  };
}

export function annotateAcceptedRowsWithVerification(
  acceptedRows: AcceptedEvidenceImportRow[],
  verificationState: EvidenceVerificationState = {}
): AcceptedEvidenceExportRow[] {
  return acceptedRows.map((row) => ({
    ...row,
    verificationStatus: verificationState[row.id]?.status ?? "unverified"
  }));
}

export function createPendingEntry(rowId: string): EvidenceVerificationEntry {
  return {
    rowId,
    ...pendingEntry
  };
}

function shouldFailAttempt(rowId: string, attemptCount: number) {
  return rowId === deterministicFailOnceEvidenceId && attemptCount === 1;
}
