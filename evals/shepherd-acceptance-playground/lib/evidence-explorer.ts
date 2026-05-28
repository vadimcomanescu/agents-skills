import type { EvidenceOption, EvidenceReviewItem } from "./evidence-review";
import type { EvidenceImportResult } from "./evidence-import";
import type { EvidenceVerificationStatus, EvidenceVerificationState } from "./evidence-verification";

export type EvidenceExplorerOrigin = "all" | "seeded" | "imported";
export type EvidenceExplorerVerificationStatus = EvidenceVerificationStatus | "not-applicable";
export type EvidenceExplorerVerificationStatusFilter = "all" | EvidenceVerificationStatus;
export type EvidenceExplorerSortField = "title" | "criterionId" | "kind" | "verificationStatus" | "origin";
export type EvidenceExplorerSortDirection = "asc" | "desc";

export type EvidenceExplorerRow = {
  id: string;
  title: string;
  kind: EvidenceOption["kind"];
  criterionId: string;
  source: string;
  origin: Exclude<EvidenceExplorerOrigin, "all">;
  verificationStatus: EvidenceExplorerVerificationStatus;
};

export type EvidenceExplorerQuery = {
  search: string;
  origin: EvidenceExplorerOrigin;
  kind: "all" | EvidenceOption["kind"];
  criterionId: "all" | string;
  verificationStatus: EvidenceExplorerVerificationStatusFilter;
  sortField: EvidenceExplorerSortField;
  sortDirection: EvidenceExplorerSortDirection;
};

export type EvidenceExplorerResult = {
  query: EvidenceExplorerQuery;
  rows: EvidenceExplorerRow[];
};

export type EvidenceExplorerFixtureManifest = {
  seededRowCount: number;
  acceptedImportedRowCount: number;
  rejectedImportedRowCount: number;
  kindCount: number;
  criterionCount: number;
  concreteVerificationStatusCount: number;
  hasEvidenceIdTieBreakerFixture: boolean;
};

const verificationStatusOrder: EvidenceExplorerVerificationStatus[] = [
  "checking",
  "failed",
  "unverified",
  "verified",
  "not-applicable"
];

export function createDefaultEvidenceExplorerQuery(): EvidenceExplorerQuery {
  return {
    search: "",
    origin: "all",
    kind: "all",
    criterionId: "all",
    verificationStatus: "all",
    sortField: "title",
    sortDirection: "asc"
  };
}

export function resetEvidenceExplorerQuery(_query: EvidenceExplorerQuery): EvidenceExplorerQuery {
  return createDefaultEvidenceExplorerQuery();
}

export function normalizeEvidenceExplorerSearch(value: string) {
  return value.trim().toLowerCase();
}

export function toEvidenceExplorerRows({
  seededReview,
  importResult,
  verificationState = {}
}: {
  seededReview: EvidenceReviewItem;
  importResult: EvidenceImportResult | null;
  verificationState?: EvidenceVerificationState;
}): EvidenceExplorerRow[] {
  const seededRows = seededReview.evidence.map<EvidenceExplorerRow>((evidence) => ({
    id: evidence.id,
    title: evidence.title,
    kind: evidence.kind,
    criterionId: criterionIdForSeededEvidence(seededReview, evidence.id),
    source: `seeded:${evidence.id}`,
    origin: "seeded",
    verificationStatus: "not-applicable"
  }));

  const importedRows =
    importResult?.acceptedRows.map<EvidenceExplorerRow>((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      criterionId: row.criterionId,
      source: row.source,
      origin: "imported",
      verificationStatus: verificationState[row.id]?.status ?? "unverified"
    })) ?? [];

  return sortEvidenceExplorerRows([...seededRows, ...importedRows], createDefaultEvidenceExplorerQuery());
}

export function queryEvidenceExplorer({
  rows,
  query
}: {
  rows: EvidenceExplorerRow[];
  query: EvidenceExplorerQuery;
}): EvidenceExplorerResult {
  return {
    query,
    rows: filterEvidenceExplorerRows(rows, query)
  };
}

export function filterEvidenceExplorerRows(rows: EvidenceExplorerRow[], query: EvidenceExplorerQuery): EvidenceExplorerRow[] {
  const normalizedSearch = normalizeEvidenceExplorerSearch(query.search);
  const filteredRows = rows.filter((row) => {
    if (query.origin !== "all" && row.origin !== query.origin) {
      return false;
    }
    if (query.kind !== "all" && row.kind !== query.kind) {
      return false;
    }
    if (query.criterionId !== "all" && row.criterionId !== query.criterionId) {
      return false;
    }
    if (query.verificationStatus !== "all" && row.verificationStatus !== query.verificationStatus) {
      return false;
    }
    if (normalizedSearch && !approvedSearchText(row).includes(normalizedSearch)) {
      return false;
    }
    return true;
  });

  return sortEvidenceExplorerRows(filteredRows, query);
}

export function evidenceExplorerFixtureManifest(
  rows: EvidenceExplorerRow[],
  importResult: EvidenceImportResult
): EvidenceExplorerFixtureManifest {
  return {
    seededRowCount: rows.filter((row) => row.origin === "seeded").length,
    acceptedImportedRowCount: importResult.acceptedRows.length,
    rejectedImportedRowCount: importResult.rejectedRows.length,
    kindCount: new Set(rows.map((row) => row.kind)).size,
    criterionCount: new Set(rows.map((row) => row.criterionId)).size,
    concreteVerificationStatusCount: new Set(
      rows
        .filter((row) => row.origin === "imported")
        .map((row) => row.verificationStatus)
    ).size,
    hasEvidenceIdTieBreakerFixture: hasEvidenceIdTieBreakerFixture(rows)
  };
}

function sortEvidenceExplorerRows(rows: EvidenceExplorerRow[], query: EvidenceExplorerQuery): EvidenceExplorerRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, query));
}

function compareRows(a: EvidenceExplorerRow, b: EvidenceExplorerRow, query: EvidenceExplorerQuery) {
  const direction = query.sortDirection === "asc" ? 1 : -1;
  const primary = compareField(a, b, query.sortField);
  if (primary !== 0) {
    return primary * direction;
  }
  return a.id.localeCompare(b.id);
}

function compareField(a: EvidenceExplorerRow, b: EvidenceExplorerRow, field: EvidenceExplorerSortField) {
  if (field === "verificationStatus") {
    return (
      verificationStatusOrder.indexOf(a.verificationStatus) -
      verificationStatusOrder.indexOf(b.verificationStatus)
    );
  }

  return String(a[field]).localeCompare(String(b[field]));
}

function approvedSearchText(row: EvidenceExplorerRow) {
  return normalizeEvidenceExplorerSearch([row.id, row.title, row.criterionId, row.source].join(" "));
}

function criterionIdForSeededEvidence(review: EvidenceReviewItem, evidenceId: string) {
  const criterion = review.criteria.find((candidate) => candidate.id.endsWith(evidenceId.replace("evidence-", "")));
  return criterion?.id ?? review.criteria[0]?.id ?? "unknown-criterion";
}

function hasEvidenceIdTieBreakerFixture(rows: EvidenceExplorerRow[]) {
  const seenKeys = new Set<string>();
  for (const row of rows) {
    for (const key of [
      row.title,
      row.criterionId,
      row.kind,
      row.origin,
      row.verificationStatus
    ]) {
      const fixtureKey = String(key);
      if (seenKeys.has(fixtureKey)) {
        return true;
      }
      seenKeys.add(fixtureKey);
    }
  }
  return false;
}
