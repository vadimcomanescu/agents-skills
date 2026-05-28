"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateReviewVerdict,
  compareEvidenceReviewScenarios,
  createInitialCriterionStates,
  knownEvidenceReviewComparisonPairs,
  seededEvidenceReview,
  type EvidenceReviewComparison,
  type CriterionReviewState,
  type CriterionVerdict
} from "../lib/evidence-review";
import {
  parseEvidenceCsv,
  serializeAcceptedEvidence,
  validateEvidenceCsvInput
} from "../lib/evidence-import";
import {
  beginEvidenceVerification,
  createPendingEntry,
  minimumCheckingDurationMs,
  resolveEvidenceVerification,
  syncEvidenceVerificationState,
  type EvidenceVerificationEntry,
  type EvidenceVerificationState
} from "../lib/evidence-verification";
import {
  applyEvidenceImport,
  createInitialImportHistoryState,
  importHistoryStateForJson,
  undoEvidenceImport
} from "../lib/evidence-import-history";
import {
  createDefaultEvidenceExplorerQuery,
  evidenceExplorerFixtureManifest,
  queryEvidenceExplorer,
  resetEvidenceExplorerQuery,
  toEvidenceExplorerRows,
  type EvidenceExplorerQuery,
  type EvidenceExplorerSortDirection,
  type EvidenceExplorerSortField
} from "../lib/evidence-explorer";
import {
  buildHandoffPack,
  evaluateHandoffPack,
  withHandoffPackStatus,
  type HandoffPack,
  type HandoffPackSourceState
} from "../lib/evidence-handoff-pack";
import {
  canImportDossier,
  canRecordDossierJudgment,
  canResetDossier,
  createInitialDossierImportState,
  currentDossierFingerprint,
  evaluateDossier,
  parseEvidenceDossierBundle,
  recordReviewerJudgment,
  upsertReviewerJudgment,
  type ReviewerJudgment,
  type ReviewerJudgmentValue
} from "../lib/evidence-dossier";
import { canMutate, type WorkflowMode } from "../lib/workflow-mode";

function displayVerdict(status: string) {
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "rejected") {
    return "Rejected";
  }
  return "Accepted";
}

function selectedEvidenceTitle(states: CriterionReviewState[], criterionId: string) {
  const state = states.find((candidate) => candidate.criterionId === criterionId);
  const evidence = seededEvidenceReview.evidence.find((candidate) => candidate.id === state?.selectedEvidenceId);
  return evidence?.title ?? "No evidence selected";
}

function comparisonPairs() {
  return knownEvidenceReviewComparisonPairs.map((pair) => {
    const comparison = compareEvidenceReviewScenarios(pair);

    if (!comparison) {
      throw new Error(`Unknown visible comparison pair: ${pair}`);
    }

    return comparison;
  });
}

function hasEvidenceChanges(comparison: EvidenceReviewComparison) {
  return (
    comparison.evidenceChanges.added.length > 0 ||
    comparison.evidenceChanges.replaced.length > 0 ||
    comparison.evidenceChanges.removed.length > 0
  );
}

type FocusTarget = "workflow" | "import-summary" | "history" | "export";

function verificationActionLabel(entry: EvidenceVerificationEntry) {
  if (entry.status === "failed") {
    return "Retry verification";
  }
  if (entry.status === "checking") {
    return "Checking";
  }
  if (entry.status === "verified") {
    return "Verified";
  }
  return "Verify imported evidence";
}

function displayExplorerStatus(status: string) {
  return status === "not-applicable" ? "not applicable" : status;
}

function displayStaleCategory(category: string) {
  if (category === "importHistory") {
    return "Import history";
  }
  return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
}

function displayDossierStatus(status: string) {
  if (status === "not-loaded") {
    return "Not loaded";
  }
  if (status === "invalid-bundle") {
    return "Invalid bundle";
  }
  if (status === "needs-review") {
    return "Needs review";
  }
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function displayProofType(proofType: string) {
  return proofType
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default function EvidenceReviewWorkflow() {
  const [isOpen, setIsOpen] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("operator");
  const [criterionStates, setCriterionStates] = useState(() => createInitialCriterionStates(seededEvidenceReview.criteria));
  const [csvText, setCsvText] = useState("id,title,kind,criterionId,source\n");
  const [importHistory, setImportHistory] = useState(() => createInitialImportHistoryState());
  const [verificationState, setVerificationState] = useState<EvidenceVerificationState>({});
  const [explorerQuery, setExplorerQuery] = useState<EvidenceExplorerQuery>(() => createDefaultEvidenceExplorerQuery());
  const [exportJson, setExportJson] = useState("");
  const [handoffPack, setHandoffPack] = useState<HandoffPack | null>(null);
  const [dossierText, setDossierText] = useState("");
  const [dossierImportState, setDossierImportState] = useState(() => createInitialDossierImportState());
  const [reviewerJudgments, setReviewerJudgments] = useState<ReviewerJudgment[]>([]);
  const [dossierJudgmentNotes, setDossierJudgmentNotes] = useState<Record<string, string>>({});
  const [dossierFingerprintSalt, setDossierFingerprintSalt] = useState("");
  const [lastDossierJudgmentAttempt, setLastDossierJudgmentAttempt] = useState<{
    criterionId: string;
    judgment: ReviewerJudgmentValue;
    accepted: boolean;
    reason: string | null;
  } | null>(null);
  const [pendingFocusTarget, setPendingFocusTarget] = useState<FocusTarget | null>(null);
  const verificationTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextHandoffPackNumber = useRef(1);
  const nextDossierFingerprintChange = useRef(1);
  const workflowRef = useRef<HTMLDivElement>(null);
  const importSummaryRef = useRef<HTMLDivElement>(null);
  const importHistoryRef = useRef<HTMLElement>(null);
  const exportOutputRef = useRef<HTMLPreElement>(null);
  const workflowModeRef = useRef<WorkflowMode>("operator");
  const pendingVerificationCompletions = useRef<Map<string, string>>(new Map());
  const verdict = useMemo(() => calculateReviewVerdict(seededEvidenceReview.criteria, criterionStates), [criterionStates]);
  const comparisons = useMemo(() => comparisonPairs(), []);
  const importHistoryJson = useMemo(() => importHistoryStateForJson(importHistory), [importHistory]);
  const csvValidation = useMemo(() => validateEvidenceCsvInput(csvText, seededEvidenceReview), [csvText]);
  const importResult = importHistoryJson.current;
  const isReviewerMode = !canMutate(workflowMode);
  const canExport = (importResult?.acceptedRows.length ?? 0) > 0;
  const explorerRows = useMemo(
    () => toEvidenceExplorerRows({ seededReview: seededEvidenceReview, importResult, verificationState }),
    [importResult, verificationState]
  );
  const explorerResult = useMemo(
    () => queryEvidenceExplorer({ rows: explorerRows, query: explorerQuery }),
    [explorerRows, explorerQuery]
  );
  const explorerFixtureManifest = useMemo(
    () =>
      evidenceExplorerFixtureManifest(
        explorerRows,
        importResult ?? {
          acceptedRows: [],
          rejectedRows: []
        }
      ),
    [explorerRows, importResult]
  );
  const handoffPackSourceState = useMemo<HandoffPackSourceState>(
    () => ({
      importState: importResult,
      importHistory: importHistoryJson,
      verificationState,
      explorerQuery: explorerResult.query,
      explorerRows: explorerResult.rows,
      exportJson
    }),
    [exportJson, explorerResult.query, explorerResult.rows, importHistoryJson, importResult, verificationState]
  );
  const handoffPackStatus = useMemo(
    () => evaluateHandoffPack(handoffPack, handoffPackSourceState),
    [handoffPack, handoffPackSourceState]
  );
  const displayedHandoffPack = useMemo(
    () => (handoffPack ? withHandoffPackStatus(handoffPack, handoffPackSourceState) : null),
    [handoffPack, handoffPackSourceState]
  );
  const canGenerateHandoffPack = canMutate(workflowMode) && (!handoffPack || handoffPackStatus.isStale);
  const dossierCurrentStateFingerprint = useMemo(
    () =>
      dossierImportState.status === "loaded"
        ? currentDossierFingerprint(dossierImportState.bundle, dossierFingerprintSalt)
        : null,
    [dossierFingerprintSalt, dossierImportState]
  );
  const dossierEvaluation = useMemo(
    () =>
      evaluateDossier({
        importState: dossierImportState,
        judgments: reviewerJudgments,
        currentStateFingerprint: dossierCurrentStateFingerprint ?? undefined
      }),
    [dossierCurrentStateFingerprint, dossierImportState, reviewerJudgments]
  );
  const canImportEvidenceDossier = canImportDossier(workflowMode);
  const canResetEvidenceDossier = canResetDossier(workflowMode);
  const canJudgeEvidenceDossier = canRecordDossierJudgment(workflowMode);

  useEffect(() => {
    setVerificationState((current) => syncEvidenceVerificationState(importResult?.acceptedRows ?? [], current));
  }, [importResult]);

  useEffect(() => {
    return () => {
      verificationTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    workflowModeRef.current = workflowMode;

    if (!canMutate(workflowMode) || pendingVerificationCompletions.current.size === 0) {
      return;
    }

    const completions = Array.from(pendingVerificationCompletions.current.entries());
    pendingVerificationCompletions.current.clear();
    setVerificationState((current) =>
      completions.reduce(
        (nextState, [rowId, timestamp]) => resolveEvidenceVerification(nextState, rowId, timestamp),
        current
      )
    );
  }, [workflowMode]);

  useEffect(() => {
    if (!pendingFocusTarget) {
      return;
    }

    const focusTargets: Record<FocusTarget, HTMLElement | null> = {
      workflow: workflowRef.current,
      "import-summary": importSummaryRef.current,
      history: importHistoryRef.current,
      export: exportOutputRef.current
    };
    const target = focusTargets[pendingFocusTarget];

    if (!target) {
      return;
    }

    target.focus();
    setPendingFocusTarget(null);
  }, [exportJson, importHistoryJson, importResult, isOpen, pendingFocusTarget]);

  function setCriterionVerdict(criterionId: string, nextVerdict: CriterionVerdict) {
    if (!canMutate(workflowMode)) {
      return;
    }

    setCriterionStates((current) =>
      current.map((state) => (state.criterionId === criterionId ? { ...state, verdict: nextVerdict } : state))
    );
  }

  function setCriterionEvidence(criterionId: string, selectedEvidenceId: string | null) {
    if (!canMutate(workflowMode)) {
      return;
    }

    setCriterionStates((current) =>
      current.map((state) => (state.criterionId === criterionId ? { ...state, selectedEvidenceId } : state))
    );
  }

  function updateCsvText(nextText: string, field?: HTMLTextAreaElement) {
    if (!canMutate(workflowMode)) {
      if (field) {
        field.value = csvText;
      }
      return;
    }

    setCsvText(nextText);
  }

  function importEvidenceRows() {
    if (!canMutate(workflowMode)) {
      return;
    }

    if (!csvValidation.canImport) {
      return;
    }

    const result = parseEvidenceCsv(csvText, seededEvidenceReview);
    setImportHistory((current) => applyEvidenceImport(current, result));
    setVerificationState((current) => syncEvidenceVerificationState(result.acceptedRows, current));
    setExportJson("");
    setPendingFocusTarget("import-summary");
  }

  function undoLastImport() {
    if (!canMutate(workflowMode)) {
      return;
    }

    setImportHistory((current) => undoEvidenceImport(current));
    setExportJson("");
    setPendingFocusTarget("history");
  }

  function exportAcceptedRows() {
    if (!canMutate(workflowMode)) {
      return;
    }

    if (!importResult || importResult.acceptedRows.length === 0) {
      return;
    }

    setExportJson(serializeAcceptedEvidence(importResult.acceptedRows, verificationState));
    setPendingFocusTarget("export");
  }

  function verifyImportedEvidence(rowId: string) {
    if (!canMutate(workflowMode)) {
      return;
    }

    const startedAt = new Date().toISOString();
    setVerificationState((current) => beginEvidenceVerification(current, rowId, startedAt));

    const timer = setTimeout(() => {
      const completedAt = new Date().toISOString();

      if (!canMutate(workflowModeRef.current)) {
        pendingVerificationCompletions.current.set(rowId, completedAt);
        return;
      }

      setVerificationState((current) => resolveEvidenceVerification(current, rowId, completedAt));
    }, minimumCheckingDurationMs + 400);
    verificationTimers.current.push(timer);
  }

  function updateExplorerQuery(nextQuery: Partial<EvidenceExplorerQuery>) {
    setExplorerQuery((current) => ({
      ...current,
      ...nextQuery
    }));
  }

  function generateHandoffPack() {
    if (!canMutate(workflowMode)) {
      return;
    }

    if (handoffPack && !handoffPackStatus.isStale) {
      return;
    }

    const sequence = nextHandoffPackNumber.current;
    nextHandoffPackNumber.current += 1;
    setHandoffPack(
      buildHandoffPack({
        sourceState: handoffPackSourceState,
        modeAtGeneration: workflowMode,
        packId: `handoff-pack-${sequence}`,
        generatedAt: new Date().toISOString()
      })
    );
  }

  function updateDossierText(nextText: string, field?: HTMLTextAreaElement) {
    if (!canImportDossier(workflowMode)) {
      if (field) {
        field.value = dossierText;
      }
      return;
    }

    setDossierText(nextText);
  }

  function importDossierBundle() {
    if (!canImportDossier(workflowMode)) {
      return;
    }

    setDossierImportState(parseEvidenceDossierBundle(dossierText));
    setDossierFingerprintSalt("");
  }

  function revalidateDossierBundle() {
    if (!canImportDossier(workflowMode)) {
      return;
    }

    setDossierImportState(parseEvidenceDossierBundle(dossierText));
  }

  function resetDossierBundle() {
    if (!canResetDossier(workflowMode)) {
      return;
    }

    setDossierText("");
    setDossierImportState(createInitialDossierImportState());
    setReviewerJudgments([]);
    setDossierJudgmentNotes({});
    setDossierFingerprintSalt("");
    setLastDossierJudgmentAttempt(null);
  }

  function changeDossierFingerprint() {
    if (!canImportDossier(workflowMode)) {
      return;
    }

    const sequence = nextDossierFingerprintChange.current;
    nextDossierFingerprintChange.current += 1;
    setDossierFingerprintSalt(`change-${sequence}`);
  }

  function updateDossierJudgmentNote(criterionId: string, note: string, field?: HTMLInputElement) {
    if (!canRecordDossierJudgment(workflowMode)) {
      if (field) {
        field.value = dossierJudgmentNotes[criterionId] ?? "";
      }
      return;
    }

    setDossierJudgmentNotes((current) => ({
      ...current,
      [criterionId]: note
    }));
  }

  function submitDossierJudgment(criterionId: string, judgment: ReviewerJudgmentValue) {
    const attempt = recordReviewerJudgment({
      mode: workflowMode,
      importState: dossierImportState,
      currentJudgments: reviewerJudgments,
      criterionId,
      judgment,
      note: dossierJudgmentNotes[criterionId] ?? "",
      recordedAt: new Date().toISOString(),
      currentStateFingerprint: dossierCurrentStateFingerprint ?? undefined
    });

    setLastDossierJudgmentAttempt({
      criterionId,
      judgment,
      accepted: attempt.accepted,
      reason: attempt.reason
    });

    if (!attempt.accepted) {
      return;
    }

    setReviewerJudgments((current) => upsertReviewerJudgment(current, attempt.judgment));
  }

  return (
    <section className="review-shell" aria-label="Evidence review">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Seeded evidence review</div>
          <h2>Acceptance workflow</h2>
        </div>
      </div>

      <article className="review-item" data-testid="seeded-review-item">
        <div>
          <h3>{seededEvidenceReview.title}</h3>
          <p>{seededEvidenceReview.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setPendingFocusTarget("workflow");
          }}
        >
          Open review workflow
        </button>
      </article>

      <section className="comparison-section" data-testid="review-comparison-section" aria-label="Evidence review comparisons">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Deterministic two-run summary</div>
            <h2>Evidence review comparisons</h2>
          </div>
        </div>

        <div className="comparison-grid">
          {comparisons.map((comparison) => (
            <article className="comparison-card" key={comparison.pair}>
              <header>
                <span>{comparison.pair}</span>
                <strong>
                  {comparison.previousScenario} to {comparison.currentScenario}
                </strong>
              </header>

              <div className="comparison-groups">
                <section className="comparison-group">
                  <h3>Final verdict movement</h3>
                  <p>
                    {displayVerdict(comparison.verdictChange.previous)} to{" "}
                    {displayVerdict(comparison.verdictChange.current)}
                  </p>
                </section>

                <section className="comparison-group">
                  <h3>Criterion changes</h3>
                  {comparison.criterionChanges.length > 0 ? (
                    <ul>
                      {comparison.criterionChanges.map((change) => (
                        <li key={change.criterionId}>
                          <code>{change.criterionId}</code> {change.title}: {change.previousVerdict.toUpperCase()} to{" "}
                          {change.currentVerdict.toUpperCase()}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>None</p>
                  )}
                </section>

                <section className="comparison-group">
                  <h3>Evidence changes</h3>
                  {hasEvidenceChanges(comparison) ? (
                    <div className="evidence-change-groups">
                      {comparison.evidenceChanges.added.length > 0 ? (
                        <div>
                          <h4>Added evidence</h4>
                          <ul>
                            {comparison.evidenceChanges.added.map((change) => (
                              <li key={`${change.criterionId}-${change.currentEvidenceId}`}>
                                <code>{change.criterionId}</code> {change.currentEvidenceTitle}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {comparison.evidenceChanges.replaced.length > 0 ? (
                        <div>
                          <h4>Replaced evidence</h4>
                          <ul>
                            {comparison.evidenceChanges.replaced.map((change) => (
                              <li key={`${change.criterionId}-${change.previousEvidenceId}-${change.currentEvidenceId}`}>
                                <code>{change.criterionId}</code> {change.previousEvidenceTitle} to {change.currentEvidenceTitle}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {comparison.evidenceChanges.removed.length > 0 ? (
                        <div>
                          <h4>Removed evidence</h4>
                          <ul>
                            {comparison.evidenceChanges.removed.map((change) => (
                              <li key={`${change.criterionId}-${change.previousEvidenceId}`}>
                                <code>{change.criterionId}</code> {change.previousEvidenceTitle}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p>No evidence changes</p>
                  )}
                </section>

                <section className="comparison-group">
                  <h3>Remaining blockers</h3>
                  {comparison.remainingBlockers.length > 0 ? (
                    <ul>
                      {comparison.remainingBlockers.map((blocker) => (
                        <li key={`${blocker.criterionId}-${blocker.type}`}>
                          <code>{blocker.criterionId}</code> {blocker.title}: {blocker.type}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>None</p>
                  )}
                </section>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isOpen ? (
        <div
          className="review-workflow"
          data-testid="evidence-review-workflow"
          ref={workflowRef}
          tabIndex={-1}
        >
          <section className={`verdict verdict-${verdict.status}`} aria-live="polite" data-testid="final-verdict">
            <div>
              <span>Computed final verdict</span>
              <strong>{displayVerdict(verdict.status)}</strong>
            </div>
            <ul>
              {verdict.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section className={`workflow-mode workflow-mode-${workflowMode}`} aria-label="Workflow mode">
            <div>
              <span className="eyebrow">Workflow mode</span>
              <strong data-testid="workflow-mode-state">
                Current mode: {workflowMode === "operator" ? "Operator" : "Reviewer"}
              </strong>
            </div>
            <div className="mode-switch" role="group" aria-label="Workflow mode switch">
              <button
                type="button"
                aria-pressed={workflowMode === "operator"}
                onClick={() => setWorkflowMode("operator")}
              >
                Operator mode
              </button>
              <button
                type="button"
                aria-pressed={workflowMode === "reviewer"}
                onClick={() => setWorkflowMode("reviewer")}
              >
                Reviewer mode
              </button>
            </div>
          </section>

          <section className="evidence-explorer" data-testid="evidence-explorer" aria-label="Evidence explorer">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Evidence explorer</div>
                <h2>Search, filter, and sort evidence</h2>
              </div>
              <button
                type="button"
                onClick={() => setExplorerQuery((current) => resetEvidenceExplorerQuery(current))}
                data-testid="evidence-explorer-clear"
              >
                Clear explorer
              </button>
            </div>

            <div className="explorer-controls">
              <label htmlFor="evidence-explorer-search">
                Search
                <input
                  id="evidence-explorer-search"
                  data-testid="evidence-explorer-search"
                  value={explorerQuery.search}
                  onChange={(event) => updateExplorerQuery({ search: event.target.value })}
                />
              </label>

              <label htmlFor="evidence-explorer-origin">
                Origin
                <select
                  id="evidence-explorer-origin"
                  data-testid="evidence-explorer-origin"
                  value={explorerQuery.origin}
                  onChange={(event) => updateExplorerQuery({ origin: event.target.value as EvidenceExplorerQuery["origin"] })}
                >
                  <option value="all">All origins</option>
                  <option value="seeded">Seeded</option>
                  <option value="imported">Imported</option>
                </select>
              </label>

              <label htmlFor="evidence-explorer-kind">
                Kind
                <select
                  id="evidence-explorer-kind"
                  data-testid="evidence-explorer-kind"
                  value={explorerQuery.kind}
                  onChange={(event) => updateExplorerQuery({ kind: event.target.value as EvidenceExplorerQuery["kind"] })}
                >
                  <option value="all">All kinds</option>
                  <option value="api">API</option>
                  <option value="browser">Browser</option>
                  <option value="test">Test</option>
                </select>
              </label>

              <label htmlFor="evidence-explorer-status">
                Verification status
                <select
                  id="evidence-explorer-status"
                  data-testid="evidence-explorer-status"
                  value={explorerQuery.verificationStatus}
                  onChange={(event) =>
                    updateExplorerQuery({
                      verificationStatus: event.target.value as EvidenceExplorerQuery["verificationStatus"]
                    })
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="checking">Checking</option>
                  <option value="failed">Failed</option>
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified</option>
                </select>
              </label>

              <label htmlFor="evidence-explorer-criterion">
                Criterion
                <select
                  id="evidence-explorer-criterion"
                  data-testid="evidence-explorer-criterion"
                  value={explorerQuery.criterionId}
                  onChange={(event) => updateExplorerQuery({ criterionId: event.target.value })}
                >
                  <option value="all">All criteria</option>
                  {seededEvidenceReview.criteria.map((criterion) => (
                    <option value={criterion.id} key={criterion.id}>
                      {criterion.id}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="evidence-explorer-sort-field">
                Sort field
                <select
                  id="evidence-explorer-sort-field"
                  data-testid="evidence-explorer-sort-field"
                  value={explorerQuery.sortField}
                  onChange={(event) => updateExplorerQuery({ sortField: event.target.value as EvidenceExplorerSortField })}
                >
                  <option value="title">Title</option>
                  <option value="criterionId">Criterion</option>
                  <option value="kind">Kind</option>
                  <option value="verificationStatus">Verification status</option>
                  <option value="origin">Origin</option>
                </select>
              </label>

              <label htmlFor="evidence-explorer-sort-direction">
                Sort direction
                <select
                  id="evidence-explorer-sort-direction"
                  data-testid="evidence-explorer-sort-direction"
                  value={explorerQuery.sortDirection}
                  onChange={(event) =>
                    updateExplorerQuery({ sortDirection: event.target.value as EvidenceExplorerSortDirection })
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>

            <div className="explorer-summary" data-testid="evidence-explorer-summary" aria-live="polite">
              Showing {explorerResult.rows.length} of {explorerRows.length} evidence rows
            </div>

            {explorerResult.rows.length > 0 ? (
              <ol className="explorer-results" data-testid="evidence-explorer-results">
                {explorerResult.rows.map((row) => (
                  <li className={`explorer-row explorer-row-${row.origin}`} data-testid="evidence-explorer-row" key={row.id}>
                    <div>
                      <code>{row.id}</code>
                      <strong>{row.title}</strong>
                    </div>
                    <dl>
                      <div>
                        <dt>Kind</dt>
                        <dd>{row.kind}</dd>
                      </div>
                      <div>
                        <dt>Criterion</dt>
                        <dd>{row.criterionId}</dd>
                      </div>
                      <div>
                        <dt>Origin</dt>
                        <dd>{row.origin}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{displayExplorerStatus(row.verificationStatus)}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{row.source}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="explorer-empty" data-testid="evidence-explorer-empty" role="status">
                No evidence matches the current search and filter query.
              </p>
            )}

            <pre className="evidence-explorer-state-json" data-testid="evidence-explorer-state-json">
              {JSON.stringify(
                {
                  query: explorerResult.query,
                  resultCount: explorerResult.rows.length,
                  totalCount: explorerRows.length,
                  rows: explorerResult.rows,
                  actualIds: explorerResult.rows.map((row) => row.id)
                },
                null,
                2
              )}
            </pre>
            <pre className="evidence-explorer-fixture-json" data-testid="evidence-explorer-fixture-json">
              {JSON.stringify(explorerFixtureManifest, null, 2)}
            </pre>
          </section>

          <section className="handoff-pack" data-testid="handoff-pack" aria-label="Review handoff pack">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Review handoff pack</div>
                <h2>Snapshot provenance</h2>
              </div>
              <button
                type="button"
                onClick={generateHandoffPack}
                disabled={!canGenerateHandoffPack}
                data-testid="handoff-pack-generate"
              >
                {handoffPack ? "Regenerate handoff pack" : "Generate handoff pack"}
              </button>
            </div>

            {displayedHandoffPack ? (
              <div className={`handoff-pack-card ${displayedHandoffPack.isStale ? "handoff-pack-stale" : "handoff-pack-fresh"}`}>
                <div className="handoff-pack-status" data-testid="handoff-pack-status">
                  <strong>{displayedHandoffPack.isStale ? "Stale" : "Fresh"}</strong>
                  <span>
                    {displayedHandoffPack.staleCategories.length > 0
                      ? displayedHandoffPack.staleCategories.map(displayStaleCategory).join(", ")
                      : "No stale categories"}
                  </span>
                </div>

                <dl className="handoff-pack-summary" data-testid="handoff-pack-ui">
                  <div>
                    <dt>Pack</dt>
                    <dd>{displayedHandoffPack.packId}</dd>
                  </div>
                  <div>
                    <dt>Generated</dt>
                    <dd>{displayedHandoffPack.generatedAt}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{displayedHandoffPack.modeAtGeneration}</dd>
                  </div>
                  <div>
                    <dt>Import</dt>
                    <dd>
                      {displayedHandoffPack.importSummary.acceptedCount} accepted,{" "}
                      {displayedHandoffPack.importSummary.rejectedCount} rejected
                    </dd>
                  </div>
                  <div>
                    <dt>Explorer results</dt>
                    <dd>{displayedHandoffPack.explorerResultIds.join(", ") || "none"}</dd>
                  </div>
                </dl>

                <pre className="handoff-pack-json" data-testid="handoff-pack-json">
                  {JSON.stringify(displayedHandoffPack, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="handoff-pack-empty" data-testid="handoff-pack-empty">
                No handoff pack generated.
              </p>
            )}

            <pre className="handoff-pack-current-state-json" data-testid="handoff-pack-current-state-json">
              {JSON.stringify(
                {
                  sourceState: handoffPackSourceState,
                  status: handoffPackStatus,
                  activePack: displayedHandoffPack,
                  actionState: {
                    canGenerateHandoffPack,
                    isReviewerMode
                  }
                },
                null,
                2
              )}
            </pre>
          </section>

          <section className={`evidence-dossier evidence-dossier-${dossierEvaluation.status}`} data-testid="evidence-dossier" aria-label="Evidence dossier">
            <div className="section-heading">
              <div>
                <div className="eyebrow">Evidence dossier</div>
                <h2>Review room</h2>
              </div>
              <div className="dossier-actions">
                <button
                  type="button"
                  onClick={importDossierBundle}
                  disabled={!canImportEvidenceDossier || dossierText.trim() === ""}
                  data-testid="dossier-import"
                >
                  Import dossier
                </button>
                <button
                  type="button"
                  onClick={revalidateDossierBundle}
                  disabled={!canImportEvidenceDossier || dossierText.trim() === ""}
                  data-testid="dossier-revalidate"
                >
                  Revalidate
                </button>
                <button
                  type="button"
                  onClick={changeDossierFingerprint}
                  disabled={!canImportEvidenceDossier || dossierImportState.status !== "loaded"}
                  data-testid="dossier-change-fingerprint"
                >
                  Change fingerprint
                </button>
                <button
                  type="button"
                  onClick={resetDossierBundle}
                  disabled={!canResetEvidenceDossier}
                  data-testid="dossier-reset"
                >
                  Reset dossier
                </button>
              </div>
            </div>

            <div className="dossier-status" data-testid="dossier-status" aria-live="polite">
              <strong>{displayDossierStatus(dossierEvaluation.status)}</strong>
              <span data-testid="dossier-current-fingerprint">
                Fingerprint: {dossierCurrentStateFingerprint ?? "none"}
              </span>
              <span>Stale judgments: {dossierEvaluation.staleJudgmentCount}</span>
            </div>

            <label className="dossier-input-label" htmlFor="dossier-bundle-input">
              Dossier bundle JSON
              <textarea
                id="dossier-bundle-input"
                data-testid="dossier-bundle-input"
                value={dossierText}
                readOnly={!canImportEvidenceDossier}
                aria-readonly={!canImportEvidenceDossier}
                onInput={(event) => updateDossierText(event.currentTarget.value, event.currentTarget)}
                onChange={(event) => updateDossierText(event.target.value, event.currentTarget)}
                rows={7}
              />
            </label>

            {dossierImportState.status === "invalid-bundle" ? (
              <section className="dossier-validation-errors" data-testid="dossier-validation-errors" aria-label="Dossier validation errors">
                <h3>Validation errors</h3>
                <ul>
                  {dossierImportState.errors.map((error) => (
                    <li key={`${error.path}-${error.code}`}>
                      <code>{error.path}</code> {error.code}: {error.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {dossierEvaluation.criteria.length > 0 ? (
              <div className="dossier-criteria" data-testid="dossier-criteria">
                {dossierEvaluation.criteria.map((criterion) => (
                  <article
                    className={`dossier-criterion ${criterion.completeProof ? "dossier-criterion-complete" : "dossier-criterion-incomplete"}`}
                    data-testid={`dossier-ac-${criterion.criterionId}`}
                    key={criterion.criterionId}
                  >
                    <header>
                      <div>
                        <code>{criterion.criterionId}</code>
                        <h3>{criterion.expectedBehavior}</h3>
                      </div>
                      <span>Claimed: {criterion.claimedVerdict}</span>
                    </header>

                    <div className="dossier-proof-grid">
                      <section>
                        <h4>Proof types</h4>
                        <p>
                          Required: {criterion.requiredProofTypes.map(displayProofType).join(", ") || "none"}
                        </p>
                        <p>
                          Present: {criterion.presentProofTypes.map(displayProofType).join(", ") || "none"}
                        </p>
                        <p data-testid={`dossier-missing-proof-${criterion.criterionId}`}>
                          Missing: {criterion.missingProofTypes.map(displayProofType).join(", ") || "none"}
                        </p>
                      </section>

                      <section>
                        <h4>Observed assertions</h4>
                        {criterion.observedAssertions.length > 0 ? (
                          <ul>
                            {criterion.observedAssertions.map((assertion) => (
                              <li key={assertion}>{assertion}</li>
                            ))}
                          </ul>
                        ) : (
                          <p data-testid={`dossier-missing-assertions-${criterion.criterionId}`}>none</p>
                        )}
                      </section>
                    </div>

                    <section className="dossier-artifacts">
                      <h4>Artifacts</h4>
                      {criterion.artifacts.length > 0 ? (
                        <ul>
                          {criterion.artifacts.map((artifact) => (
                            <li key={artifact.id}>
                              <code>{artifact.id}</code>
                              <span>{displayProofType(artifact.type)}</span>
                              <span>{artifact.path}</span>
                              <span>{artifact.fingerprint}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No artifacts declared</p>
                      )}
                    </section>

                    {criterion.blockers.length > 0 ? (
                      <section className="dossier-blockers" data-testid={`dossier-blockers-${criterion.criterionId}`}>
                        <h4>Blockers</h4>
                        <ul>
                          {criterion.blockers.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <section className="dossier-judgment" data-testid={`dossier-judgment-${criterion.criterionId}`}>
                      <h4>Reviewer judgment</h4>
                      {criterion.reviewerJudgment ? (
                        <dl>
                          <div>
                            <dt>Judgment</dt>
                            <dd>{criterion.reviewerJudgment.judgment}</dd>
                          </div>
                          <div>
                            <dt>Note</dt>
                            <dd>{criterion.reviewerJudgment.note || "none"}</dd>
                          </div>
                          <div>
                            <dt>Freshness</dt>
                            <dd>{criterion.reviewerJudgment.stale ? "stale" : "fresh"}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p>No reviewer judgment</p>
                      )}

                      <label htmlFor={`dossier-note-${criterion.criterionId}`}>
                        Note
                        <input
                          id={`dossier-note-${criterion.criterionId}`}
                          data-testid={`dossier-note-${criterion.criterionId}`}
                          value={dossierJudgmentNotes[criterion.criterionId] ?? ""}
                          readOnly={!canJudgeEvidenceDossier}
                          aria-readonly={!canJudgeEvidenceDossier}
                          onInput={(event) =>
                            updateDossierJudgmentNote(criterion.criterionId, event.currentTarget.value, event.currentTarget)
                          }
                          onChange={(event) =>
                            updateDossierJudgmentNote(criterion.criterionId, event.target.value, event.currentTarget)
                          }
                        />
                      </label>

                      <div className="dossier-judgment-actions">
                        <button
                          type="button"
                          onClick={() => submitDossierJudgment(criterion.criterionId, "needs-review")}
                          disabled={!canJudgeEvidenceDossier}
                          data-testid={`dossier-judgment-${criterion.criterionId}-needs-review`}
                        >
                          Needs review
                        </button>
                        <button
                          type="button"
                          onClick={() => submitDossierJudgment(criterion.criterionId, "fail")}
                          disabled={!canJudgeEvidenceDossier}
                          data-testid={`dossier-judgment-${criterion.criterionId}-fail`}
                        >
                          Fail
                        </button>
                        <button
                          type="button"
                          onClick={() => submitDossierJudgment(criterion.criterionId, "pass")}
                          disabled={!canJudgeEvidenceDossier}
                          data-testid={`dossier-judgment-${criterion.criterionId}-pass`}
                        >
                          Pass
                        </button>
                      </div>
                    </section>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dossier-empty" data-testid="dossier-empty">
                No dossier bundle loaded.
              </p>
            )}

            {lastDossierJudgmentAttempt ? (
              <p
                className={`dossier-attempt dossier-attempt-${lastDossierJudgmentAttempt.accepted ? "accepted" : "blocked"}`}
                data-testid="dossier-last-judgment-attempt"
                role="status"
              >
                {lastDossierJudgmentAttempt.criterionId} {lastDossierJudgmentAttempt.judgment}:{" "}
                {lastDossierJudgmentAttempt.accepted ? "accepted" : `blocked - ${lastDossierJudgmentAttempt.reason}`}
              </p>
            ) : null}

            <pre className="dossier-state-json" data-testid="dossier-state-json">
              {JSON.stringify(
                {
                  importState: dossierImportState,
                  evaluation: dossierEvaluation,
                  reviewerJudgments,
                  currentStateFingerprint: dossierCurrentStateFingerprint,
                  actionState: {
                    canImportEvidenceDossier,
                    canResetEvidenceDossier,
                    canJudgeEvidenceDossier,
                    lastDossierJudgmentAttempt
                  }
                },
                null,
                2
              )}
            </pre>
          </section>

          <div className="review-grid">
            <section className="criteria-list" aria-label="Acceptance criteria">
              {seededEvidenceReview.criteria.map((criterion) => {
                const state = criterionStates.find((candidate) => candidate.criterionId === criterion.id);
                const activeVerdict = state?.verdict ?? "unreviewed";

                return (
                  <article className="criterion" key={criterion.id} data-testid={`criterion-${criterion.id}`}>
                    <div className="criterion-copy">
                      <div className="criterion-title-row">
                        <h3>{criterion.title}</h3>
                        <span className={`criterion-state criterion-state-${activeVerdict}`}>
                          {activeVerdict === "unreviewed" ? "Unreviewed" : activeVerdict.toUpperCase()}
                        </span>
                      </div>
                      <p>{criterion.description}</p>
                    </div>

                    <div className="criterion-controls">
                      <div className="segmented" aria-label={`${criterion.title} verdict`}>
                        <button
                          type="button"
                          className={activeVerdict === "pass" ? "active-pass" : ""}
                          aria-pressed={activeVerdict === "pass"}
                          aria-label={`Mark ${criterion.title} PASS`}
                          disabled={isReviewerMode}
                          onClick={() => setCriterionVerdict(criterion.id, "pass")}
                        >
                          PASS
                        </button>
                        <button
                          type="button"
                          className={activeVerdict === "fail" ? "active-fail" : ""}
                          aria-pressed={activeVerdict === "fail"}
                          aria-label={`Mark ${criterion.title} FAIL`}
                          disabled={isReviewerMode}
                          onClick={() => setCriterionVerdict(criterion.id, "fail")}
                        >
                          FAIL
                        </button>
                      </div>

                      <label htmlFor={`evidence-${criterion.id}`}>
                        Evidence for {criterion.title}
                        <select
                          id={`evidence-${criterion.id}`}
                          aria-label={`Evidence for ${criterion.title}`}
                          value={state?.selectedEvidenceId ?? ""}
                          disabled={isReviewerMode}
                          onChange={(event) => {
                            if (!canMutate(workflowMode)) {
                              event.currentTarget.value = state?.selectedEvidenceId ?? "";
                              return;
                            }
                            setCriterionEvidence(criterion.id, event.target.value || null);
                          }}
                        >
                          <option value="">Select seeded evidence</option>
                          {seededEvidenceReview.evidence.map((evidence) => (
                            <option value={evidence.id} key={evidence.id}>
                              {evidence.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="selected-evidence" data-testid={`selected-evidence-${criterion.id}`}>
                        {selectedEvidenceTitle(criterionStates, criterion.id)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="evidence-library" aria-label="Seeded evidence options">
              <h3>Seeded evidence options</h3>
              {seededEvidenceReview.evidence.map((evidence) => (
                <article className={`evidence-card evidence-card-${evidence.kind}`} key={evidence.id}>
                  <span>{evidence.kind}</span>
                  <strong>{evidence.title}</strong>
                  <p>{evidence.detail}</p>
                </article>
              ))}
            </aside>
          </div>

          <section className="evidence-import" data-testid="evidence-import-section" aria-label="CSV evidence import">
            <div className="section-heading">
              <div>
                <div className="eyebrow">CSV evidence import</div>
                <h2>Evidence row import and export</h2>
              </div>
              <div className="import-actions">
                <button type="button" onClick={importEvidenceRows} disabled={isReviewerMode || !csvValidation.canImport}>
                  Import CSV rows
                </button>
                <button
                  type="button"
                  onClick={undoLastImport}
                  disabled={isReviewerMode || !importHistoryJson.canUndo}
                  data-testid="undo-import-button"
                >
                  Undo last import
                </button>
                <button type="button" onClick={exportAcceptedRows} disabled={isReviewerMode || !canExport}>
                  Export accepted JSON
                </button>
              </div>
            </div>

            <label className="csv-input-label" htmlFor="evidence-csv-input">
              CSV evidence rows
              <textarea
                id="evidence-csv-input"
                data-testid="evidence-csv-input"
                value={csvText}
                readOnly={isReviewerMode}
                aria-readonly={isReviewerMode}
                onInput={(event) => updateCsvText(event.currentTarget.value, event.currentTarget)}
                onChange={(event) => updateCsvText(event.target.value, event.currentTarget)}
                rows={7}
              />
            </label>

            <section
              className={`csv-validation csv-validation-${csvValidation.mode}`}
              data-testid="csv-validation-panel"
              aria-label="CSV validation"
              aria-live="polite"
              tabIndex={0}
            >
              <div className="csv-validation-header">
                <div>
                  <span data-testid="csv-validation-mode">Mode: {csvValidation.mode}</span>
                  <strong>{csvValidation.summary}</strong>
                </div>
                <div className="csv-validation-counts">
                  <span data-testid="csv-validation-valid-count">Valid: {csvValidation.validRowCount}</span>
                  <span data-testid="csv-validation-invalid-count">Invalid: {csvValidation.invalidRowCount}</span>
                  <span data-testid="csv-validation-can-import">
                    Import allowed: {csvValidation.canImport ? "yes" : "no"}
                  </span>
                </div>
              </div>

              {csvValidation.diagnostics.length > 0 ? (
                <ul data-testid="csv-validation-diagnostics">
                  {csvValidation.diagnostics.map((diagnostic) => (
                    <li key={`${diagnostic.lineNumber}-${diagnostic.reasonCode}-${diagnostic.field}`}>
                      <strong>Line {diagnostic.lineNumber}</strong>
                      <span>
                        {diagnostic.field}
                        {diagnostic.column ? ` column ${diagnostic.column}` : ""}: {diagnostic.reasonCode}
                      </span>
                      {diagnostic.badValue !== undefined ? <code>{diagnostic.badValue}</code> : null}
                      <span>{diagnostic.reason}</span>
                      <span>{diagnostic.suggestedFix}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <pre className="csv-validation-state-json" data-testid="csv-validation-state-json">
                {JSON.stringify(csvValidation, null, 2)}
              </pre>
            </section>

            <section
              className="import-history"
              data-testid="import-history-section"
              aria-label="Import history"
              ref={importHistoryRef}
              tabIndex={-1}
            >
              <div className="import-history-header">
                <h3>Import history</h3>
                <span>{importHistoryJson.canUndo ? "Undo available" : "No undoable import"}</span>
              </div>

              {importHistoryJson.historyEntries.length > 0 ? (
                <ol>
                  {importHistoryJson.historyEntries.map((entry) => (
                    <li
                      className={`import-history-entry import-history-entry-${entry.status}`}
                      data-testid="import-history-entry"
                      key={entry.id}
                    >
                      <div>
                        <strong>Action: {entry.actionType}</strong>
                        <span>{entry.status === "active" ? "Active path" : "Undone"}</span>
                      </div>
                      <p>
                        Accepted: {entry.acceptedCount} ({entry.acceptedEvidenceIds.join(", ") || "none"})
                      </p>
                      <p>
                        Rejected: {entry.rejectedCount} lines ({entry.rejectedLineNumbers.join(", ") || "none"})
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No imports recorded</p>
              )}

              <pre className="import-history-state-json" data-testid="import-history-state-json">
                {JSON.stringify(importHistoryJson, null, 2)}
              </pre>
            </section>

            {importResult ? (
              <div className="import-results">
                <div
                  className="import-counts"
                  aria-label={`Import result summary: accepted ${importResult.acceptedRows.length}, rejected ${importResult.rejectedRows.length}`}
                  aria-live="polite"
                  data-testid="import-results-summary"
                  ref={importSummaryRef}
                  role="status"
                  tabIndex={-1}
                >
                  <span data-testid="accepted-count">Accepted: {importResult.acceptedRows.length}</span>
                  <span data-testid="rejected-count">Rejected: {importResult.rejectedRows.length}</span>
                </div>

                {importResult.acceptedRows.length === 0 ? (
                  <p className="export-warning" data-testid="export-warning">
                    Nothing valid to export.
                  </p>
                ) : null}

                <div className="import-result-grid">
                  <section className="import-result-list" data-testid="accepted-rows" aria-label="Accepted rows">
                    <h3>Accepted rows</h3>
                    {importResult.acceptedRows.length > 0 ? (
                      <ul>
                        {importResult.acceptedRows.map((row) => (
                          <li key={row.id} data-testid={`verification-row-${row.id}`}>
                            <div className="accepted-row-main">
                              <code>{row.id}</code> {row.title} <span>{row.kind}</span> <span>{row.criterionId}</span>{" "}
                              <span>{row.source}</span>
                            </div>
                            {(() => {
                              const verification = verificationState[row.id] ?? createPendingEntry(row.id);
                              const isChecking = verification.status === "checking";
                              const isVerified = verification.status === "verified";

                              return (
                                <div className={`verification-control verification-control-${verification.status}`}>
                                  <div>
                                    <span data-testid={`verification-status-${row.id}`}>{verification.status}</span>
                                    <strong>{verification.message}</strong>
                                    <small>
                                      Attempts: {verification.attemptCount}; code: {verification.statusCode}; retry:{" "}
                                      {verification.retryAvailable ? "yes" : "no"}
                                    </small>
                                  </div>
                                  <button
                                    type="button"
                                    data-testid={`verification-action-${row.id}`}
                                    onClick={() => verifyImportedEvidence(row.id)}
                                    disabled={isReviewerMode || isChecking || isVerified}
                                  >
                                    {verificationActionLabel(verification)}
                                  </button>
                                </div>
                              );
                            })()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No accepted rows</p>
                    )}
                  </section>

                  <section className="import-result-list" data-testid="rejected-rows" aria-label="Rejected rows">
                    <h3>Rejected rows</h3>
                    {importResult.rejectedRows.length > 0 ? (
                      <ul>
                        {importResult.rejectedRows.map((row) => (
                          <li key={`${row.lineNumber}-${row.rawText}`}>
                            <strong>Line {row.lineNumber}</strong>
                            <code>{row.rawText}</code>
                            <span>{row.reasons.map((reason) => `${reason.code}: ${reason.message}`).join(" ")}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No rejected rows</p>
                    )}
                  </section>
                </div>

                <pre className="import-state-json" data-testid="import-state-json">
                  {JSON.stringify(importResult, null, 2)}
                </pre>
                <pre className="verification-state-json" data-testid="verification-state-json">
                  {JSON.stringify(verificationState, null, 2)}
                </pre>
              </div>
            ) : null}

            {exportJson ? (
              <pre
                className="export-json-output"
                data-testid="export-json-output"
                aria-label="Exported accepted evidence JSON"
                ref={exportOutputRef}
                tabIndex={-1}
              >
                {exportJson}
              </pre>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
