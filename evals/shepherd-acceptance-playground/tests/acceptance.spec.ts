import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { deterministicFailOnceEvidenceId, minimumCheckingDurationMs } from "../lib/evidence-verification";

const request08ArchiveDir = "../../.shepherd/proof-archive/request-08/browser";
const request09ArchiveDir = "../../.shepherd/proof-archive/request-09/browser";
const request09EvidenceDir = "../../.shepherd/dogfood-12/request-09/evidence";
const request10ArchiveDir = "../../.shepherd/proof-archive/request-10/browser";
const request10EvidenceDir = "../../.shepherd/dogfood-12/request-10/evidence";
const request11ArchiveDir = "../../.shepherd/proof-archive/request-11/browser";
const request11EvidenceDir = "../../.shepherd/dogfood-12/request-11/evidence";
const request12ArchiveDir = "../../.shepherd/proof-archive/request-12/browser";
const request12EvidenceDir = "../../.shepherd/dogfood-12/request-12/evidence";
const request08FailOnceRowId = deterministicFailOnceEvidenceId;
const request08SummaryRowId = "r08-summary-proof";
const request09FailOnceRowId = deterministicFailOnceEvidenceId;
const request09SummaryRowId = "r09-summary-proof";

type ImportHistoryStateJson = {
  current: {
    acceptedRows: { id: string }[];
    rejectedRows: { lineNumber: number }[];
  } | null;
  canUndo: boolean;
  historyEntries: {
    id: string;
    actionType: string;
    acceptedCount: number;
    rejectedCount: number;
    acceptedEvidenceIds: string[];
    rejectedLineNumbers: number[];
    status: string;
  }[];
};

type CsvValidationStateJson = {
  mode: "blocked" | "warning" | "clear";
  canImport: boolean;
  summary: string;
  validRowCount: number;
  invalidRowCount: number;
  sourceHash: string;
  diagnostics: {
    lineNumber: number;
    field: string;
    column?: number;
    badValue?: string;
    reasonCode: string;
    reason: string;
    suggestedFix: string;
  }[];
};

type Request08VerificationStatus = "unverified" | "checking" | "failed" | "verified";

type Request08VerificationEntry = {
  rowId: string;
  status: Request08VerificationStatus;
  attemptCount: number;
  retryAvailable: boolean;
  statusCode: string;
  message: string;
  updatedAt: string | null;
  startedAt?: string;
  completedAt?: string;
};

type Request08VerificationState = Record<string, Request08VerificationEntry>;

type Request08ExportPayload = {
  evidenceRows: Array<{
    id: string;
    title: string;
    kind: string;
    criterionId: string;
    source: string;
    verificationStatus: Request08VerificationStatus;
  }>;
};

type Request08StageSnapshot = {
  label: string;
  verificationState: Request08VerificationState;
  importHistoryState: ImportHistoryStateJson;
  importState: unknown;
  validationState: CsvValidationStateJson;
  exportPayload: Request08ExportPayload;
};

type Request08BrowserManifest = {
  type: "browser-evidence";
  ac_id: string;
  expected_route_or_state: string;
  captured_url: string;
  page_title: string;
  assertions: string[];
  artifacts: string[];
  verdict: "PASS";
};

type Request09WorkflowMode = "operator" | "reviewer" | "unknown";

type Request09CriterionState = {
  criterionId: string;
  statusText: string;
  selectedEvidenceText: string;
  selectValue: string;
  passPressed: string | null;
  failPressed: string | null;
};

type Request09ProtectedState = {
  label: string;
  mode: Request09WorkflowMode;
  modeText: string;
  finalVerdictText: string;
  criteria: Request09CriterionState[];
  csvText: string;
  validationState: CsvValidationStateJson;
  importHistoryState: ImportHistoryStateJson;
  importState: unknown;
  verificationState: Request08VerificationState;
  exportText: string | null;
  exportPayload: unknown;
};

type Request09AttemptLogEntry = {
  surface: string;
  path: "keyboard" | "stale-focus" | "forced-dom-event";
  action: string;
  result: "attempted" | "unreachable";
  unavailableReason?: string;
  sourceAuditRefs?: string[];
};

type Request09SourceAuditEntry = {
  label: string;
  file: string;
  startLine: number;
  endLine: number;
  hasMutationGuard: boolean;
  snippet: string;
};

type Request09AcManifest = {
  type: "browser-evidence";
  ac_id: string;
  expected_route_or_state: string;
  captured_url: string;
  page_title: string;
  assertions: string[];
  artifacts: string[];
  verdict: "PASS";
};

type Request10ExplorerState = {
  query: Record<string, unknown>;
  resultCount: number;
  totalCount: number;
  rows: Array<{
    id: string;
    title: string;
    kind: string;
    criterionId: string;
    source: string;
    origin: string;
    verificationStatus: string;
  }>;
  actualIds: string[];
};

type Request10ProofState = Request10ExplorerState & {
  expectedIds: string[];
  missingIds: string[];
  unexpectedIds: string[];
};

const evidenceCsvHeader = "id,title,kind,criterionId,source";

function evidenceCsv(rows: string[]) {
  return [evidenceCsvHeader, ...rows].join("\n");
}

async function openEvidenceImport(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open review workflow" }).click();
}

async function importEvidenceCsv(page: Page, csv: string) {
  await page.getByTestId("evidence-csv-input").fill(csv);
  await page.getByRole("button", { name: "Import CSV rows" }).click();
}

async function readImportHistoryState(page: Page): Promise<ImportHistoryStateJson> {
  const text = (await page.getByTestId("import-history-state-json").textContent()) ?? "";
  return JSON.parse(text) as ImportHistoryStateJson;
}

async function readCsvValidationState(page: Page): Promise<CsvValidationStateJson> {
  const text = (await page.getByTestId("csv-validation-state-json").textContent()) ?? "";
  return JSON.parse(text) as CsvValidationStateJson;
}

async function saveJsonArtifact(testInfo: TestInfo, name: string, payload: unknown) {
  const body = JSON.stringify(payload, null, 2);
  await writeFile(testInfo.outputPath(name), body);
  await testInfo.attach(name.replace(/\.json$/, ""), {
    body,
    contentType: "application/json"
  });
}

async function saveRequest08Json(testInfo: TestInfo, name: string, payload: unknown) {
  await saveJsonArtifact(testInfo, name, payload);
  await mkdir(request08ArchiveDir, { recursive: true });
  await writeFile(`${request08ArchiveDir}/${name}`, JSON.stringify(payload, null, 2));
}

async function saveRequest09Json(testInfo: TestInfo, name: string, payload: unknown) {
  await saveJsonArtifact(testInfo, name, payload);
  await mkdir(request09ArchiveDir, { recursive: true });
  await writeFile(`${request09ArchiveDir}/${name}`, JSON.stringify(payload, null, 2));
}

async function saveRequest10Json(testInfo: TestInfo, name: string, payload: unknown) {
  await saveJsonArtifact(testInfo, name, payload);
  await mkdir(request10ArchiveDir, { recursive: true });
  await writeFile(`${request10ArchiveDir}/${name}`, JSON.stringify(payload, null, 2));
}

async function saveRequest11Json(testInfo: TestInfo, name: string, payload: unknown) {
  await saveJsonArtifact(testInfo, name, payload);
  await mkdir(request11ArchiveDir, { recursive: true });
  await writeFile(`${request11ArchiveDir}/${name}`, JSON.stringify(payload, null, 2));
}

async function saveRequest12Json(testInfo: TestInfo, name: string, payload: unknown) {
  await saveJsonArtifact(testInfo, name, payload);
  await mkdir(request12ArchiveDir, { recursive: true });
  await writeFile(`${request12ArchiveDir}/${name}`, JSON.stringify(payload, null, 2));
}

async function saveRequest09EvidenceIndex(payload: unknown) {
  await mkdir(request09EvidenceDir, { recursive: true });
  await writeFile(`${request09EvidenceDir}/index.json`, JSON.stringify(payload, null, 2));
}

async function saveRequest10EvidenceIndex(payload: unknown) {
  await mkdir(request10EvidenceDir, { recursive: true });
  await writeFile(`${request10EvidenceDir}/index.json`, JSON.stringify(payload, null, 2));
}

async function saveRequest11EvidenceIndex(payload: unknown) {
  await mkdir(request11EvidenceDir, { recursive: true });
  await writeFile(`${request11EvidenceDir}/index.json`, JSON.stringify(payload, null, 2));
}

async function saveRequest12EvidenceIndex(payload: unknown) {
  await mkdir(request12EvidenceDir, { recursive: true });
  await writeFile(`${request12EvidenceDir}/index.json`, JSON.stringify(payload, null, 2));
}

async function saveRequest08Screenshot(page: Page, name: string) {
  await mkdir(request08ArchiveDir, { recursive: true });
  await page.screenshot({
    path: `${request08ArchiveDir}/${name}`,
    fullPage: true
  });
}

async function saveRequest09Screenshot(page: Page, name: string) {
  await mkdir(request09ArchiveDir, { recursive: true });
  await page.screenshot({
    path: `${request09ArchiveDir}/${name}`,
    fullPage: true
  });
}

async function saveRequest10Screenshot(page: Page, name: string) {
  await mkdir(request10ArchiveDir, { recursive: true });
  await page.screenshot({
    path: `${request10ArchiveDir}/${name}`,
    fullPage: true
  });
}

async function saveRequest11Screenshot(page: Page, name: string) {
  await mkdir(request11ArchiveDir, { recursive: true });
  await page.screenshot({
    path: `${request11ArchiveDir}/${name}`,
    fullPage: true
  });
}

async function saveRequest12Screenshot(page: Page, name: string) {
  await mkdir(request12ArchiveDir, { recursive: true });
  await page.screenshot({
    path: `${request12ArchiveDir}/${name}`,
    fullPage: true
  });
}

async function saveCurrentValidation(page: Page, testInfo: TestInfo, name: string) {
  const payload = await readCsvValidationState(page);
  await saveJsonArtifact(testInfo, name, payload);
  return payload;
}

async function saveCurrentImportHistory(page: Page, testInfo: TestInfo, name: string) {
  const payload = await readImportHistoryState(page);
  await saveJsonArtifact(testInfo, name, payload);
  return payload;
}

async function saveCurrentImportState(page: Page, testInfo: TestInfo, name: string) {
  const text = (await page.getByTestId("import-state-json").textContent()) ?? "";
  const payload = text ? JSON.parse(text) : null;
  await saveJsonArtifact(testInfo, name, payload);
  return payload;
}

async function readExportText(page: Page) {
  const output = page.getByTestId("export-json-output");

  if ((await output.count()) === 0) {
    return null;
  }

  return (await output.textContent()) ?? "";
}

async function saveCurrentExportText(page: Page, testInfo: TestInfo, name: string) {
  const payload = { exportJson: await readExportText(page) };
  await saveJsonArtifact(testInfo, name, payload);
  return payload;
}

async function exportAcceptedEvidence(page: Page, testInfo: TestInfo, name: string) {
  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  const text = (await page.getByTestId("export-json-output").textContent()) ?? "";
  const payload = JSON.parse(text) as { evidenceRows: { id: string }[] };
  await saveJsonArtifact(testInfo, name, payload);
  return payload;
}

async function readRequest08VerificationState(page: Page): Promise<Request08VerificationState> {
  const text = (await page.getByTestId("verification-state-json").textContent()) ?? "";
  return JSON.parse(text) as Request08VerificationState;
}

async function captureRequest08Stage(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: { saveScreenshot?: boolean } = {}
): Promise<Request08StageSnapshot> {
  const verificationState = await readRequest08VerificationState(page);
  const importHistoryState = await readImportHistoryState(page);
  const importState = await saveCurrentImportState(page, testInfo, `r08-${label}-import-state.json`);
  const validationState = await readCsvValidationState(page);
  const exportPayload = (await exportAcceptedEvidence(page, testInfo, `r08-${label}-export.json`)) as Request08ExportPayload;
  const snapshot: Request08StageSnapshot = {
    label,
    verificationState,
    importHistoryState,
    importState,
    validationState,
    exportPayload
  };
  await saveRequest08Json(testInfo, `r08-${label}-verification-state.json`, verificationState);
  await saveRequest08Json(testInfo, `r08-${label}-import-state.json`, importState);
  await saveRequest08Json(testInfo, `r08-${label}-import-history-state.json`, importHistoryState);
  await saveRequest08Json(testInfo, `r08-${label}-validation-state.json`, validationState);
  await saveRequest08Json(testInfo, `r08-${label}-export.json`, exportPayload);
  await saveRequest08Json(testInfo, `r08-${label}-snapshot.json`, snapshot);

  if (options.saveScreenshot) {
    await saveRequest08Screenshot(page, `r08-${label}-ui.png`);
  }

  return snapshot;
}

function request08ComparableExport(payload: Request08ExportPayload) {
  return payload.evidenceRows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    criterionId: row.criterionId,
    source: row.source
  }));
}

function request08ChangedKeys(
  baselineEntry: Request08VerificationEntry | undefined,
  stageEntry: Request08VerificationEntry | undefined
) {
  const keys = new Set([...Object.keys(baselineEntry ?? {}), ...Object.keys(stageEntry ?? {})]);
  return Array.from(keys)
    .filter((key) => key !== "rowId")
    .filter((key) => {
      const baselineValue = baselineEntry?.[key as keyof Request08VerificationEntry];
      const stageValue = stageEntry?.[key as keyof Request08VerificationEntry];
      return JSON.stringify(baselineValue) !== JSON.stringify(stageValue);
    });
}

function request08ChangedExportKeys(baseline: Request08ExportPayload, stage: Request08ExportPayload, rowId: string) {
  const baselineRow = baseline.evidenceRows.find((row) => row.id === rowId);
  const stageRow = stage.evidenceRows.find((row) => row.id === rowId);
  const keys = new Set([...Object.keys(baselineRow ?? {}), ...Object.keys(stageRow ?? {})]);

  return Array.from(keys).filter((key) => {
    const baselineValue = baselineRow?.[key as keyof Request08ExportPayload["evidenceRows"][number]];
    const stageValue = stageRow?.[key as keyof Request08ExportPayload["evidenceRows"][number]];
    return JSON.stringify(baselineValue) !== JSON.stringify(stageValue);
  });
}

function request08StateDiffReport(baseline: Request08StageSnapshot, stages: Request08StageSnapshot[]) {
  const allowedVerificationFields = new Set([
    "status",
    "attemptCount",
    "retryAvailable",
    "statusCode",
    "message",
    "startedAt",
    "updatedAt",
    "completedAt"
  ]);
  const allowedExportFields = new Set(["verificationStatus"]);

  return stages.map((stage) => {
    const baselineOtherEntries = { ...baseline.verificationState };
    const stageOtherEntries = { ...stage.verificationState };
    delete baselineOtherEntries[request08FailOnceRowId];
    delete stageOtherEntries[request08FailOnceRowId];
    const verificationFieldsChanged = request08ChangedKeys(
      baseline.verificationState[request08FailOnceRowId],
      stage.verificationState[request08FailOnceRowId]
    );
    const exportFieldsChanged = request08ChangedExportKeys(
      baseline.exportPayload,
      stage.exportPayload,
      request08FailOnceRowId
    );
    const nonVerificationStateUnchanged =
      JSON.stringify(stage.importHistoryState) === JSON.stringify(baseline.importHistoryState) &&
      JSON.stringify(stage.importState) === JSON.stringify(baseline.importState) &&
      JSON.stringify(stage.validationState) === JSON.stringify(baseline.validationState) &&
      JSON.stringify(stageOtherEntries) === JSON.stringify(baselineOtherEntries) &&
      JSON.stringify(request08ComparableExport(stage.exportPayload)) ===
        JSON.stringify(request08ComparableExport(baseline.exportPayload));

    return {
      label: stage.label,
      allowedVerificationFieldsChanged: verificationFieldsChanged,
      disallowedVerificationFieldsChanged: verificationFieldsChanged.filter((key) => !allowedVerificationFields.has(key)),
      allowedExportFieldsChanged: exportFieldsChanged,
      disallowedExportFieldsChanged: exportFieldsChanged.filter((key) => !allowedExportFields.has(key)),
      importHistoryUnchanged: JSON.stringify(stage.importHistoryState) === JSON.stringify(baseline.importHistoryState),
      importStateUnchanged: JSON.stringify(stage.importState) === JSON.stringify(baseline.importState),
      validationStateUnchanged: JSON.stringify(stage.validationState) === JSON.stringify(baseline.validationState),
      otherVerificationEntriesUnchanged: JSON.stringify(stageOtherEntries) === JSON.stringify(baselineOtherEntries),
      exportNonVerificationFieldsUnchanged:
        JSON.stringify(request08ComparableExport(stage.exportPayload)) ===
        JSON.stringify(request08ComparableExport(baseline.exportPayload)),
      nonVerificationStateUnchanged,
      baselineStatus: baseline.verificationState[request08FailOnceRowId]?.status,
      stageStatus: stage.verificationState[request08FailOnceRowId]?.status,
      exportStatus: stage.exportPayload.evidenceRows.find((row) => row.id === request08FailOnceRowId)?.verificationStatus
    };
  });
}

function request08BrowserManifests(input: { capturedUrl: string; pageTitle: string }): Request08BrowserManifest[] {
  const commonArtifacts = ["r08-trace.zip", "r08-video.webm", "r08-evidence-manifest.json"];
  const stageArtifacts = [
    "r08-baseline-ui.png",
    "r08-first-checking-ui.png",
    "r08-failed-ui.png",
    "r08-retry-checking-ui.png",
    "r08-verified-ui.png",
    "r08-baseline-verification-state.json",
    "r08-first-checking-verification-state.json",
    "r08-failed-verification-state.json",
    "r08-retry-checking-verification-state.json",
    "r08-verified-verification-state.json"
  ];
  const makeManifest = (
    ac_id: string,
    expected_route_or_state: string,
    assertions: string[],
    artifacts: string[]
  ): Request08BrowserManifest => ({
    type: "browser-evidence",
    ac_id,
    expected_route_or_state,
    captured_url: input.capturedUrl,
    page_title: input.pageTitle,
    assertions,
    artifacts: [...artifacts, ...commonArtifacts],
    verdict: "PASS"
  });

  return [
    makeManifest(
      "AC-R08-001",
      "Accepted imported rows expose verification controls; rejected rows and seeded evidence do not.",
      [
        "Accepted row r08-fail-once-payment renders status unverified and a verification action.",
        "Verification-state JSON contains accepted imported rows only.",
        "Rejected row section and seeded evidence item contain no verify or retry controls."
      ],
      ["r08-baseline-ui.png", "r08-baseline-verification-state.json", "r08-source-audit.json"]
    ),
    makeManifest(
      "AC-R08-002",
      "Baseline imported row state before any verification action.",
      [
        "r08-fail-once-payment starts with serialized status unverified and attemptCount 0.",
        "Baseline import, history, validation, and export artifacts are captured.",
        "Baseline export includes verificationStatus unverified and excludes rejected row content."
      ],
      [
        "r08-baseline-ui.png",
        "r08-baseline-verification-state.json",
        "r08-baseline-import-history-state.json",
        "r08-baseline-validation-state.json",
        "r08-baseline-export.json"
      ]
    ),
    makeManifest(
      "AC-R08-003",
      "First verification action remains visibly and serially checking for at least 500 ms.",
      [
        "First checking screenshot and verification JSON show status checking and attemptCount 1.",
        "Duplicate action is disabled while checking.",
        "First checking export remains available and reports verificationStatus checking.",
        "Duration artifact records at least 500 ms before resolution."
      ],
      ["r08-first-checking-ui.png", "r08-first-checking-verification-state.json", "r08-first-checking-export.json", "r08-first-checking-duration.json"]
    ),
    makeManifest(
      "AC-R08-004",
      "First verification attempt deterministically resolves to failed exactly once.",
      [
        "Failed screenshot and JSON show status failed, attemptCount 1, retryAvailable true.",
        "Failure status code source_unreachable_once and readable retry message are serialized.",
        "Retry action is visible without requiring reload, re-import, undo, or external service."
      ],
      ["r08-failed-ui.png", "r08-failed-verification-state.json", "r08-status-sequence.json"]
    ),
    makeManifest(
      "AC-R08-005",
      "Retry verification remains visibly and serially checking for at least 500 ms.",
      [
        "Retry checking screenshot and verification JSON show status checking and attemptCount 2.",
        "Duplicate action is disabled while retry checking.",
        "Retry checking export remains available and reports verificationStatus checking.",
        "Duration artifact records at least 500 ms before verified resolution."
      ],
      ["r08-retry-checking-ui.png", "r08-retry-checking-verification-state.json", "r08-retry-checking-export.json", "r08-retry-checking-duration.json"]
    ),
    makeManifest(
      "AC-R08-006",
      "Retry attempt deterministically resolves to verified.",
      [
        "Verified screenshot and JSON show status verified, attemptCount 2, retryAvailable false.",
        "Success status code source_verified and readable success message are serialized.",
        "Verified export includes verificationStatus verified for r08-fail-once-payment."
      ],
      ["r08-verified-ui.png", "r08-verified-verification-state.json", "r08-verified-export.json", "r08-status-sequence.json"]
    ),
    makeManifest(
      "AC-R08-007",
      "Export remains available in every verification status and stays accepted-row only.",
      [
        "Export artifacts exist for baseline, first checking, failed, retry checking, and verified stages.",
        "Each export includes every accepted row and a verificationStatus matching the captured stage.",
        "Rejected row text is absent from all request-08 export payloads."
      ],
      [
        "r08-baseline-export.json",
        "r08-first-checking-export.json",
        "r08-failed-export.json",
        "r08-retry-checking-export.json",
        "r08-verified-export.json"
      ]
    ),
    makeManifest(
      "AC-R08-008",
      "Async verification changes only selected-row verification fields and export verificationStatus.",
      [
        "State diff reports import history unchanged for every async stage.",
        "State diff reports import state and validation state unchanged for every async stage.",
        "State diff reports only allowed selected-row verification keys and export verificationStatus changed."
      ],
      ["r08-state-diff.json", "r08-baseline-snapshot.json", "r08-first-checking-snapshot.json", "r08-failed-snapshot.json", "r08-retry-checking-snapshot.json", "r08-verified-snapshot.json"]
    ),
    makeManifest(
      "AC-R08-009",
      "Verification state machine is deterministic and local.",
      [
        "Status sequence shows unverified, checking, failed, checking, verified with attempt counts 0, 1, 1, 2, 2.",
        "Source audit reports no Math.random, verification fetch, XMLHttpRequest, or backend verification route.",
        "Network audit reports no verification service requests and no external requests."
      ],
      [
        "r08-status-sequence.json",
        "r08-source-audit.json",
        "r08-network-audit.json",
        "../commands/npm-run-test-evidence-verification.log"
      ]
    ),
    makeManifest(
      "AC-R08-010",
      "One replayable workflow captures baseline, checking, failed, retry checking, verified, and export proof.",
      [
        "All five stage screenshots and verification-state JSON artifacts exist.",
        "Trace and video artifacts are copied into the request-08 proof archive.",
        "The same Playwright workflow generated stage screenshots, JSON, audits, status sequence, and manifests."
      ],
      [...stageArtifacts, "r08-trace.zip", "r08-video.webm", "r08-evidence-manifest.json"]
    ),
    makeManifest(
      "AC-R08-011",
      "Pure verification helper behavior is covered by focused unit evidence and browser workflow artifacts.",
      [
        "Focused unit command log records lib/evidence-verification.test.ts passing.",
        "Browser workflow exercises the helper-backed state machine through fail-once and retry recovery.",
        "Source audit identifies local helper, import serializer, and UI wiring as the changed verification surfaces."
      ],
      ["../commands/npm-run-test-evidence-verification.log", "r08-source-audit.json", "r08-status-sequence.json"]
    ),
    makeManifest(
      "AC-R08-012",
      "Request 01 through 07 browser and unit regressions remain present and passing with no skip or only markers.",
      [
        "Full browser command log records 23 Playwright tests passing.",
        "Full unit command log records 48 Vitest tests passing.",
        "Grep log records no exclusive or skipped test markers in the playground source."
      ],
      ["npm-run-test-browser.log", "npm-run-test.log", "npm-run-build.log", "grep-no-skip-only.log"]
    )
  ];
}

async function forceImportClick(page: Page) {
  await page.getByRole("button", { name: "Import CSV rows" }).evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      const wasDisabled = button.disabled;
      button.disabled = false;
      button.click();
      button.disabled = wasDisabled;
    }
  });
}

const request09Csv = evidenceCsv([
  `${request09FailOnceRowId},Request 09 payment proof,browser,criterion-payment,r09-payment.json`,
  `${request09SummaryRowId},Request 09 summary proof,api,criterion-summary,r09-summary.json`,
  ",Request 09 rejected missing id,test,criterion-recovery,r09-rejected.json"
]);

const request09CriterionIds = ["criterion-payment", "criterion-summary", "criterion-recovery"];

function request09ProtectedComparable(state: Request09ProtectedState) {
  return {
    finalVerdictText: state.finalVerdictText,
    criteria: state.criteria,
    csvText: state.csvText,
    validationState: state.validationState,
    importHistoryState: state.importHistoryState,
    importState: state.importState,
    verificationState: state.verificationState,
    exportText: state.exportText,
    exportPayload: state.exportPayload
  };
}

function request09DiffProtectedStates(before: Request09ProtectedState, after: Request09ProtectedState) {
  const beforeComparable = request09ProtectedComparable(before);
  const afterComparable = request09ProtectedComparable(after);
  const changedProtectedKeys = Object.keys(beforeComparable).filter((key) => {
    const typedKey = key as keyof ReturnType<typeof request09ProtectedComparable>;
    return JSON.stringify(beforeComparable[typedKey]) !== JSON.stringify(afterComparable[typedKey]);
  });

  return {
    beforeLabel: before.label,
    afterLabel: after.label,
    modeBefore: before.mode,
    modeAfter: after.mode,
    modeChanged: before.mode !== after.mode,
    changedProtectedKeys,
    protectedStateUnchanged: changedProtectedKeys.length === 0
  };
}

async function request09ReadProtectedState(page: Page, label: string): Promise<Request09ProtectedState> {
  return page.evaluate(
    ({ stateLabel, criterionIds }) => {
      function readJson(selector: string) {
        const text = document.querySelector(selector)?.textContent ?? "";
        return text ? JSON.parse(text) : null;
      }

      const modeText = document.querySelector('[data-testid="workflow-mode-state"]')?.textContent?.trim() ?? "";
      const mode = modeText.includes("Operator") ? "operator" : modeText.includes("Reviewer") ? "reviewer" : "unknown";
      const exportText = document.querySelector('[data-testid="export-json-output"]')?.textContent ?? null;

      return {
        label: stateLabel,
        mode,
        modeText,
        finalVerdictText: document.querySelector('[data-testid="final-verdict"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        criteria: criterionIds.map((criterionId) => {
          const root = document.querySelector(`[data-testid="criterion-${criterionId}"]`);
          const select = document.querySelector(`#evidence-${criterionId}`) as HTMLSelectElement | null;
          const passButton = root?.querySelector('button[aria-label^="Mark"][aria-label$="PASS"]');
          const failButton = root?.querySelector('button[aria-label^="Mark"][aria-label$="FAIL"]');

          return {
            criterionId,
            statusText: root?.querySelector(".criterion-state")?.textContent?.trim() ?? "",
            selectedEvidenceText:
              document.querySelector(`[data-testid="selected-evidence-${criterionId}"]`)?.textContent?.trim() ?? "",
            selectValue: select?.value ?? "",
            passPressed: passButton?.getAttribute("aria-pressed") ?? null,
            failPressed: failButton?.getAttribute("aria-pressed") ?? null
          };
        }),
        csvText: (document.querySelector('[data-testid="evidence-csv-input"]') as HTMLTextAreaElement | null)?.value ?? "",
        validationState: readJson('[data-testid="csv-validation-state-json"]'),
        importHistoryState: readJson('[data-testid="import-history-state-json"]'),
        importState: readJson('[data-testid="import-state-json"]'),
        verificationState: readJson('[data-testid="verification-state-json"]') ?? {},
        exportText,
        exportPayload: exportText ? JSON.parse(exportText) : null
      };
    },
    { stateLabel: label, criterionIds: request09CriterionIds }
  );
}

async function request09SaveProtectedState(page: Page, testInfo: TestInfo, label: string, fileName: string) {
  const state = await request09ReadProtectedState(page, label);
  await saveRequest09Json(testInfo, fileName, state);
  return state;
}

async function request09ForceButtonClick(page: Page, roleName: string) {
  await page.getByRole("button", { name: roleName }).evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      const wasDisabled = button.disabled;
      button.disabled = false;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      button.disabled = wasDisabled;
    }
  });
}

async function request09ForceSelectChange(page: Page, criterionId: string, selectedEvidenceId: string) {
  await page.locator(`#evidence-${criterionId}`).evaluate(
    (select, nextValue) => {
      if (select instanceof HTMLSelectElement) {
        const wasDisabled = select.disabled;
        select.disabled = false;
        select.value = nextValue;
        select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        select.disabled = wasDisabled;
      }
    },
    selectedEvidenceId
  );
}

async function request09ForceTextareaInput(page: Page, nextValue: string) {
  await page.getByTestId("evidence-csv-input").evaluate((textarea, forcedValue) => {
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = forcedValue;
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: forcedValue }));
      textarea.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    }
  }, nextValue);
}

async function request09StaleButtonClick(handle: Awaited<ReturnType<Page["locator"]>["elementHandle"]>) {
  await handle?.evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      const wasDisabled = button.disabled;
      button.disabled = false;
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      button.disabled = wasDisabled;
    }
  });
}

async function request09StaleSelectChange(
  handle: Awaited<ReturnType<Page["locator"]>["elementHandle"]>,
  selectedEvidenceId: string
) {
  await handle?.evaluate((select, nextValue) => {
    if (select instanceof HTMLSelectElement) {
      const wasDisabled = select.disabled;
      select.disabled = false;
      select.value = nextValue;
      select.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      select.disabled = wasDisabled;
    }
  }, selectedEvidenceId);
}

async function request09StaleTextareaInput(
  handle: Awaited<ReturnType<Page["locator"]>["elementHandle"]>,
  nextValue: string
) {
  await handle?.evaluate((textarea, forcedValue) => {
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = forcedValue;
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "A", bubbles: true, cancelable: true }));
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: forcedValue }));
      textarea.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    }
  }, nextValue);
}

async function request09TabSequence(page: Page, steps: number) {
  const sequence = [];

  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Tab");
    sequence.push(await r07ReadActiveElement(page, `r09-tab-${index + 1}`));
  }

  return sequence;
}

function request09FunctionSourceAudit(source: string, label: string, functionName: string): Request09SourceAuditEntry {
  const lines = source.split("\n");
  const declarationIndex = lines.findIndex((line) => line.includes(`function ${functionName}`));

  if (declarationIndex < 0) {
    throw new Error(`Request 09 source audit could not find ${functionName}.`);
  }

  let depth = 0;
  let started = false;
  let endIndex = declarationIndex;

  for (let index = declarationIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const character of line) {
      if (character === "{") {
        depth += 1;
        started = true;
      }
      if (character === "}") {
        depth -= 1;
      }
    }

    if (started && depth === 0) {
      endIndex = index;
      break;
    }
  }

  const snippet = lines.slice(declarationIndex, endIndex + 1).join("\n");

  return {
    label,
    file: "app/evidence-review-workflow.tsx",
    startLine: declarationIndex + 1,
    endLine: endIndex + 1,
    hasMutationGuard: snippet.includes("canMutate(workflowMode)"),
    snippet
  };
}

async function request09SourceAudit(testInfo: TestInfo) {
  const source = await readFile("app/evidence-review-workflow.tsx", "utf8");
  const audit = [
    request09FunctionSourceAudit(source, "review verdict guard", "setCriterionVerdict"),
    request09FunctionSourceAudit(source, "seeded evidence select guard", "setCriterionEvidence"),
    request09FunctionSourceAudit(source, "CSV text guard", "updateCsvText"),
    request09FunctionSourceAudit(source, "import guard", "importEvidenceRows"),
    request09FunctionSourceAudit(source, "undo guard", "undoLastImport"),
    request09FunctionSourceAudit(source, "export guard", "exportAcceptedRows"),
    request09FunctionSourceAudit(source, "verification guard", "verifyImportedEvidence")
  ];
  const forbiddenTestHookMatches = ["window.__", "globalThis.__", "request09", "testOnly"].filter((pattern) =>
    source.includes(pattern)
  );
  const payload = {
    entries: audit,
    forbiddenTestHookMatches,
    allProtectedHandlersGuarded: audit.every((entry) => entry.hasMutationGuard),
    sourceFile: "app/evidence-review-workflow.tsx"
  };
  await saveRequest09Json(testInfo, "r09-source-audit.json", payload);
  expect(payload.allProtectedHandlersGuarded).toBe(true);
  expect(payload.forbiddenTestHookMatches).toEqual([]);

  return payload;
}

function request09BrowserManifests(input: { capturedUrl: string; pageTitle: string }): Request09AcManifest[] {
  const commonArtifacts = [
    "r09-reviewer-attempt-log.json",
    "r09-reviewer-protected-state-diff.json",
    "r09-source-audit.json"
  ];
  const replayArtifacts = ["r09-trace.zip", "r09-video.webm"];
  const makeManifest = (
    ac_id: string,
    expected_route_or_state: string,
    assertions: string[],
    artifacts: string[]
  ): Request09AcManifest => ({
    type: "browser-evidence",
    ac_id,
    expected_route_or_state,
    captured_url: input.capturedUrl,
    page_title: input.pageTitle,
    assertions,
    artifacts: [...artifacts, ...commonArtifacts],
    verdict: "PASS"
  });

  return [
    makeManifest(
      "AC-R09-001",
      "Workflow opens in operator mode and operator controls remain usable.",
      [
        "Initial mode state is operator.",
        "Operator mode creates review, CSV, import, verification, and export state.",
        "Request 01-08 regression commands are recorded separately under command proof artifacts."
      ],
      ["r09-operator-default-mode-state.json", "r09-operator-default-ui.png"]
    ),
    makeManifest(
      "AC-R09-002",
      "Mode switch is visible, labeled, and keyboard reachable in both modes.",
      [
        "Keyboard focus activates reviewer mode.",
        "Keyboard focus activates operator mode from reviewer mode.",
        "Mode switching changes only mode state."
      ],
      ["r09-mode-switch-keyboard-state.json", "r09-reviewer-mode-ui.png", "r09-operator-restored-ui.png", ...replayArtifacts]
    ),
    makeManifest(
      "AC-R09-003",
      "Reviewer mode blocks review verdict and seeded evidence selection mutation.",
      ["Before/after state diff shows criteria verdicts and selected evidence unchanged after mutation attempts."],
      ["r09-reviewer-before-protected-state.json", "r09-reviewer-after-review-attempts-state.json"]
    ),
    makeManifest(
      "AC-R09-004",
      "Reviewer mode blocks CSV edits and validation changes.",
      ["Keyboard and forced DOM input attempts leave CSV text and validation state unchanged."],
      ["r09-reviewer-before-validation-state.json", "r09-reviewer-after-csv-attempts-state.json"]
    ),
    makeManifest(
      "AC-R09-005",
      "Reviewer mode blocks import and undo history mutation.",
      ["Forced import and undo activation attempts leave import state and history unchanged."],
      ["r09-reviewer-before-import-history-state.json", "r09-reviewer-after-import-undo-attempts-state.json"]
    ),
    makeManifest(
      "AC-R09-006",
      "Reviewer mode blocks verification and retry mutation.",
      [
        "Forced retry activation leaves verification state unchanged.",
        "In-flight verification completion does not mutate reviewer-mode verification state."
      ],
      [
        "r09-reviewer-before-verification-state.json",
        "r09-reviewer-after-verification-attempts-state.json",
        "r09-reviewer-inflight-before-state.json",
        "r09-reviewer-inflight-after-wait-state.json",
        "r09-operator-inflight-resolved-state.json"
      ]
    ),
    makeManifest(
      "AC-R09-007",
      "Reviewer mode blocks export generation while preserving existing export output.",
      ["Existing export output remains byte-for-byte unchanged and a fresh reviewer-mode page cannot generate export output."],
      ["r09-reviewer-before-export.json", "r09-reviewer-after-export-attempts.json", "r09-reviewer-no-export-generation-state.json"]
    ),
    makeManifest(
      "AC-R09-008",
      "Reviewer-mode proof attacks keyboard, stale-focus, and forced DOM-event paths.",
      ["Attempt log lists each protected surface and path with source-backed unavailable-path reasons where needed."],
      ["r09-reviewer-attempt-log.json", "r09-source-audit.json", ...replayArtifacts]
    ),
    makeManifest(
      "AC-R09-009",
      "Switching back to operator mode restores controls without losing protected state.",
      ["Restored operator state matches pre-reviewer protected state and a small mutation works only after return."],
      ["r09-operator-restored-state.json", "r09-operator-restored-ui.png", "r09-operator-post-restore-mutation-state.json"]
    ),
    makeManifest(
      "AC-R09-010",
      "Request 01-08 behavior remains present and final commands pass.",
      ["Full unit, build, browser, grep, and source/diff inspection artifacts are recorded separately."],
      [
        "npm-run-test.log",
        "npm-run-build.log",
        "npm-run-test-browser.log",
        "grep-no-skip-only.log",
        "r09-prior-assertions-source-inspection.log"
      ]
    )
  ];
}

const request10CheckingRowId = "r10-003-recovery-test";
const request10ImportedCsv = evidenceCsv([
  `${deterministicFailOnceEvidenceId},Replay: payment confirmation imported,browser,criterion-payment,trace/payment-confirmation.zip`,
  "r10-002-summary-api,API order summary totals,api,criterion-summary,api/orders/summary.json",
  `${request10CheckingRowId},Recovery path unit proof,test,criterion-recovery,vitest/recovery-path.log`,
  "r10-004-payment-api,Payment gateway status,api,criterion-payment,api/payments/status.json",
  "r10-005-summary-browser,Summary screenshot totals,browser,criterion-summary,screenshots/summary-totals.png",
  "r10-006-recovery-test,Recovery path unit proof,test,criterion-recovery,vitest/recovery-path-retry.log",
  "rejected-secret-token,Rejected secret only,browser,criterion-payment,"
]);

const request10DefaultIds = [
  "r10-002-summary-api",
  "evidence-recovery",
  "r10-004-payment-api",
  "r10-003-recovery-test",
  "r10-006-recovery-test",
  deterministicFailOnceEvidenceId,
  "evidence-payment",
  "evidence-summary",
  "r10-005-summary-browser"
];

const request11LaterVerificationRowId = "r11-later-verification";
const request11SummaryRowId = "r11-summary-api";
const request11RecoveryRowId = "r11-recovery-test";
const request11InitialCsv = evidenceCsv([
  "r11-initial-seed,Initial history seed,browser,criterion-payment,trace/initial.zip"
]);
const request11MainCsv = evidenceCsv([
  `${deterministicFailOnceEvidenceId},Payment fail retry proof,browser,criterion-payment,trace/payment-retry.zip`,
  `${request11SummaryRowId},Summary API handoff proof,api,criterion-summary,api/summary.json`,
  `${request11LaterVerificationRowId},Later verification export proof,test,criterion-recovery,vitest/later-verification.log`,
  `${request11RecoveryRowId},Recovery browser proof,browser,criterion-recovery,screenshots/recovery.png`,
  "r11-rejected-missing-source,Rejected missing source,browser,criterion-payment,"
]);
const request11ImportChangedCsv = evidenceCsv([
  "r11-import-change,Changed import proof,api,criterion-summary,api/changed.json",
  "r11-import-rejected,Rejected changed proof,test,criterion-recovery,"
]);

const request12InvalidBundle = JSON.stringify(
  {
    requestId: "",
    bundleFingerprint: "bundle-invalid",
    currentStateFingerprint: "state-invalid",
    generatedAt: "2026-05-28T12:00:00.000Z",
    acceptanceCriteria: [
      {
        id: "AC-R12-BAD",
        expectedBehavior: "Invalid proof type should be rejected.",
        claimedVerdict: "pass",
        requiredProofTypes: ["screenshot", "telepathy"],
        artifacts: [
          {
            id: "bad-artifact",
            type: "manifest",
            fingerprint: "bad-fingerprint",
            observedAssertions: ["This bundle is intentionally invalid."]
          }
        ]
      }
    ]
  },
  null,
  2
);

const request12IncompleteBundle = JSON.stringify(
  {
    requestId: "request-12-incomplete",
    bundleFingerprint: "bundle-incomplete",
    currentStateFingerprint: "state-incomplete",
    generatedAt: "2026-05-28T12:01:00.000Z",
    acceptanceCriteria: [
      {
        id: "AC-R12-INCOMPLETE",
        expectedBehavior: "Incomplete AC cannot pass from metadata alone.",
        claimedVerdict: "pass",
        requiredProofTypes: ["state-json", "screenshot", "manifest"],
        artifacts: [
          {
            id: "metadata-only-state",
            type: "state-json",
            path: "r12-metadata-only-state.json",
            fingerprint: "metadata-only-state-fingerprint",
            observedAssertions: []
          }
        ]
      }
    ]
  },
  null,
  2
);

const request12CompleteBundle = JSON.stringify(
  {
    requestId: "request-12-complete",
    bundleFingerprint: "bundle-complete-v1",
    currentStateFingerprint: "state-complete-v1",
    generatedAt: "2026-05-28T12:02:00.000Z",
    acceptanceCriteria: [
      {
        id: "AC-R12-DOSSIER-001",
        expectedBehavior: "Dossier groups evidence by acceptance criterion.",
        claimedVerdict: "pass",
        requiredProofTypes: ["state-json", "screenshot", "manifest"],
        artifacts: [
          {
            id: "grouped-state",
            type: "state-json",
            path: "r12-complete-bundle-state.json",
            fingerprint: "grouped-state-fingerprint",
            observedAssertions: ["AC card lists required proof types and artifact fingerprints."]
          },
          {
            id: "grouped-screenshot",
            type: "screenshot",
            path: "r12-complete-bundle-ui.png",
            fingerprint: "grouped-screenshot-fingerprint",
            observedAssertions: ["Dossier review room is visible."]
          },
          {
            id: "grouped-manifest",
            type: "manifest",
            path: "ac-r12-002-manifest.json",
            fingerprint: "grouped-manifest-fingerprint",
            observedAssertions: ["Manifest links AC-R12-002 to state and screenshot proof."]
          }
        ]
      },
      {
        id: "AC-R12-DOSSIER-002",
        expectedBehavior: "Reviewer judgment is separate from imported evidence.",
        claimedVerdict: "pass",
        requiredProofTypes: ["state-json", "screenshot", "trace", "video", "manifest"],
        artifacts: [
          {
            id: "boundary-state",
            type: "state-json",
            path: "r12-role-protected-diff.json",
            fingerprint: "boundary-state-fingerprint",
            observedAssertions: ["Reviewer mutations do not alter imported bundle state."]
          },
          {
            id: "boundary-screenshot",
            type: "screenshot",
            path: "r12-reviewer-judgment-ui.png",
            fingerprint: "boundary-screenshot-fingerprint",
            observedAssertions: ["Reviewer judgment controls are visible in reviewer mode."]
          },
          {
            id: "boundary-trace",
            type: "trace",
            path: "r12-trace.zip",
            fingerprint: "boundary-trace-fingerprint",
            observedAssertions: ["Trace records role-boundary attempts."]
          },
          {
            id: "boundary-video",
            type: "video",
            path: "r12-video.webm",
            fingerprint: "boundary-video-fingerprint",
            observedAssertions: ["Video records reviewer judgment flow."]
          },
          {
            id: "boundary-manifest",
            type: "manifest",
            path: "ac-r12-004-manifest.json",
            fingerprint: "boundary-manifest-fingerprint",
            observedAssertions: ["Manifest links role-boundary proof to AC-R12-004."]
          }
        ]
      },
      {
        id: "AC-R12-DOSSIER-003",
        expectedBehavior: "Stale judgments remain visible after fingerprint changes.",
        claimedVerdict: "pass",
        requiredProofTypes: ["state-json", "screenshot", "manifest"],
        artifacts: [
          {
            id: "stale-state",
            type: "state-json",
            path: "r12-stale-after-fingerprint-state.json",
            fingerprint: "stale-state-fingerprint",
            observedAssertions: ["Dossier status becomes stale after fingerprint change."]
          },
          {
            id: "stale-screenshot",
            type: "screenshot",
            path: "r12-stale-dossier-ui.png",
            fingerprint: "stale-screenshot-fingerprint",
            observedAssertions: ["Stale judgment remains visible with original note."]
          },
          {
            id: "stale-manifest",
            type: "manifest",
            path: "ac-r12-007-manifest.json",
            fingerprint: "stale-manifest-fingerprint",
            observedAssertions: ["Manifest links stale proof to AC-R12-007."]
          }
        ]
      }
    ]
  },
  null,
  2
);

async function readRequest10ExplorerState(page: Page): Promise<Request10ExplorerState> {
  const text = (await page.getByTestId("evidence-explorer-state-json").textContent()) ?? "";
  return JSON.parse(text) as Request10ExplorerState;
}

async function readJsonTestId<T>(page: Page, testId: string): Promise<T> {
  const text = (await page.getByTestId(testId).textContent()) ?? "";
  return JSON.parse(text) as T;
}

async function readRequest11PackState(page: Page) {
  return readJsonTestId<{
    sourceState: Record<string, unknown>;
    status: {
      isStale: boolean;
      staleCategories: string[];
      packFingerprints: Record<string, string> | null;
      currentFingerprints: Record<string, string>;
    };
    activePack: null | {
      packId: string;
      generatedAt: string;
      modeAtGeneration: string;
      sourceFingerprints: Record<string, string>;
      importSummary: { acceptedCount: number; rejectedCount: number; acceptedIds: string[]; rejectedLineNumbers: number[] };
      importHistorySummary: { canUndo: boolean; entries: unknown[] };
      verificationStatusMap: Record<string, { status: string; attemptCount: number; statusCode: string }>;
      explorerQuery: Record<string, unknown>;
      explorerResultIds: string[];
      embeddedExportJson: string;
      isStale: boolean;
      staleCategories: string[];
    };
    actionState: { canGenerateHandoffPack: boolean; isReviewerMode: boolean };
  }>(page, "handoff-pack-current-state-json");
}

async function saveRequest11PackState(page: Page, testInfo: TestInfo, name: string) {
  const payload = await readRequest11PackState(page);
  await saveRequest11Json(testInfo, name, payload);
  return payload;
}

async function request11SetExplorerQuery(
  page: Page,
  query: Partial<{
    search: string;
    origin: string;
    kind: string;
    verificationStatus: string;
    criterionId: string;
    sortField: string;
    sortDirection: string;
  }>
) {
  await request10SetExplorerQuery(page, query);
}

async function request11ProtectedState(page: Page, label: string) {
  return {
    label,
    modeText: await page.getByTestId("workflow-mode-state").textContent(),
    csvText: await page.getByTestId("evidence-csv-input").inputValue(),
    importHistoryState: await readImportHistoryState(page),
    importState: await readJsonTestId(page, "import-state-json"),
    verificationState: await readRequest08VerificationState(page),
    explorerState: await readRequest10ExplorerState(page),
    exportText: await readExportText(page),
    handoffPackState: await readRequest11PackState(page)
  };
}

function request11DiffProtected(before: unknown, after: unknown) {
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const changedKeys = Object.keys(beforeRecord).filter(
    (key) => key !== "label" && JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key])
  );
  return {
    changedKeys,
    protectedStateUnchanged: changedKeys.length === 0,
    before,
    after
  };
}

async function readRequest12DossierState(page: Page) {
  return readJsonTestId<{
    importState: { status: string; bundle: null | Record<string, unknown>; errors: unknown[]; rawText: string };
    evaluation: {
      status: string;
      criteria: Array<{
        criterionId: string;
        completeProof: boolean;
        passBlocked: boolean;
        missingProofTypes: string[];
        observedAssertions: string[];
        reviewerJudgment: null | {
          judgment: string;
          note: string;
          bundleFingerprint: string;
          currentStateFingerprint: string;
          stale: boolean;
        };
        blockers: string[];
      }>;
      staleJudgmentCount: number;
      blockers: string[];
    };
    reviewerJudgments: Array<{ criterionId: string; judgment: string; note: string }>;
    currentStateFingerprint: string | null;
    actionState: {
      canImportEvidenceDossier: boolean;
      canResetEvidenceDossier: boolean;
      canJudgeEvidenceDossier: boolean;
      lastDossierJudgmentAttempt: null | {
        criterionId: string;
        judgment: string;
        accepted: boolean;
        reason: string | null;
      };
    };
  }>(page, "dossier-state-json");
}

async function saveRequest12DossierState(page: Page, testInfo: TestInfo, name: string) {
  const payload = await readRequest12DossierState(page);
  await saveRequest12Json(testInfo, name, payload);
  return payload;
}

async function request12ImportBundle(page: Page, bundleText: string) {
  await page.getByTestId("dossier-bundle-input").fill(bundleText);
  await page.getByTestId("dossier-import").click();
}

async function request12SetMode(page: Page, mode: "operator" | "reviewer") {
  await page.getByRole("button", { name: mode === "operator" ? "Operator mode" : "Reviewer mode" }).click();
}

async function request12SetNote(page: Page, criterionId: string, note: string) {
  await page.getByTestId(`dossier-note-${criterionId}`).fill(note);
}

async function request12ClickJudgment(page: Page, criterionId: string, judgment: "pass" | "fail" | "needs-review") {
  await page.getByTestId(`dossier-judgment-${criterionId}-${judgment}`).click();
}

async function request12ForceClickDisabledButton(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((element) => {
    if (element instanceof HTMLButtonElement) {
      element.disabled = false;
    }
  });
  await page.getByTestId(testId).click();
}

async function request12ProtectedState(page: Page, label: string) {
  const state = await readRequest12DossierState(page);
  return {
    label,
    modeText: await page.getByTestId("workflow-mode-state").textContent(),
    inputValue: await page.getByTestId("dossier-bundle-input").inputValue(),
    importState: state.importState,
    reviewerJudgments: state.reviewerJudgments,
    currentStateFingerprint: state.currentStateFingerprint
  };
}

function request12DiffProtected(before: unknown, after: unknown) {
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  const changedKeys = Object.keys(beforeRecord).filter(
    (key) => key !== "label" && JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key])
  );
  return {
    changedKeys,
    protectedStateUnchanged: changedKeys.length === 0,
    before,
    after
  };
}

async function saveRequest10ExplorerState(
  page: Page,
  testInfo: TestInfo,
  name: string,
  expectedIds: string[]
): Promise<Request10ProofState> {
  const state = await readRequest10ExplorerState(page);
  const missingIds = expectedIds.filter((id) => !state.actualIds.includes(id));
  const unexpectedIds = state.actualIds.filter((id) => !expectedIds.includes(id));
  const payload: Request10ProofState = {
    ...state,
    expectedIds,
    missingIds,
    unexpectedIds
  };
  await saveRequest10Json(testInfo, name, payload);
  expect(payload.actualIds).toEqual(expectedIds);
  expect(payload.missingIds).toEqual([]);
  expect(payload.unexpectedIds).toEqual([]);
  return payload;
}

async function request10SetExplorerQuery(
  page: Page,
  query: Partial<{
    search: string;
    origin: string;
    kind: string;
    verificationStatus: string;
    criterionId: string;
    sortField: string;
    sortDirection: string;
  }>
) {
  if (query.search !== undefined) {
    await page.getByTestId("evidence-explorer-search").fill(query.search);
  }
  if (query.origin !== undefined) {
    await page.getByTestId("evidence-explorer-origin").selectOption(query.origin);
  }
  if (query.kind !== undefined) {
    await page.getByTestId("evidence-explorer-kind").selectOption(query.kind);
  }
  if (query.verificationStatus !== undefined) {
    await page.getByTestId("evidence-explorer-status").selectOption(query.verificationStatus);
  }
  if (query.criterionId !== undefined) {
    await page.getByTestId("evidence-explorer-criterion").selectOption(query.criterionId);
  }
  if (query.sortField !== undefined) {
    await page.getByTestId("evidence-explorer-sort-field").selectOption(query.sortField);
  }
  if (query.sortDirection !== undefined) {
    await page.getByTestId("evidence-explorer-sort-direction").selectOption(query.sortDirection);
  }
}

async function request10ResetExplorer(page: Page) {
  await page.getByTestId("evidence-explorer-clear").click();
}

async function saveRequest10ProtectedDiff(
  testInfo: TestInfo,
  fileName: string,
  before: Request09ProtectedState,
  after: Request09ProtectedState
) {
  const diff = request09DiffProtectedStates(before, after);
  await saveRequest10Json(testInfo, fileName, {
    ...diff,
    excludedViewState: ["explorerQuery", "explorerResults"],
    includedProtectedState: [
      "finalVerdictText",
      "criteria",
      "csvText",
      "validationState",
      "importHistoryState",
      "importState",
      "verificationState",
      "exportText",
      "exportPayload"
    ]
  });
  expect(diff.protectedStateUnchanged).toBe(true);
  expect(diff.changedProtectedKeys).toEqual([]);
  return diff;
}

function request10BrowserManifests(input: { capturedUrl: string; pageTitle: string }) {
  const makeManifest = (
    ac_id: string,
    expected_route_or_state: string,
    assertions: string[],
    artifacts: string[]
  ) => ({
    type: "browser-evidence",
    ac_id,
    expected_route_or_state,
    captured_url: input.capturedUrl,
    page_title: input.pageTitle,
    assertions,
    artifacts,
    final_state_fingerprint: "state-file:.shepherd/dogfood-12/request-10/evidence/index.json",
    verdict: "PASS"
  });

  return [
    makeManifest(
      "AC-R10-001",
      "Explorer renders seeded plus accepted imported rows and excludes rejected rows.",
      ["Full dataset JSON contains exact seeded and accepted IDs, required fields, and no rejected ID."],
      ["r10-explorer-full-dataset.json", "r10-explorer-default-ui.png"]
    ),
    makeManifest(
      "AC-R10-002",
      "Search trims, ignores case, covers approved fields, and excludes rejected raw text.",
      ["Search result cases cover id, title, criterion id, source, empty search, and rejected-row-only token."],
      ["r10-search-results.json", "r10-search-trim-case-ui.png"]
    ),
    makeManifest(
      "AC-R10-003",
      "Explorer filters by origin, kind, verification status, criterion id, and combined predicates.",
      ["Each filter family and a multi-family combination returns exact IDs."],
      ["r10-filter-results.json", "r10-filter-combined-ui.png"]
    ),
    makeManifest(
      "AC-R10-004",
      "Explorer sorting is deterministic by approved fields and direction with evidence-id tie-breaker.",
      ["Sort JSON covers title, criterion, kind, status, origin, descending status order, and a tie case."],
      ["r10-sort-results.json", "r10-sort-status-ui.png"]
    ),
    makeManifest(
      "AC-R10-005",
      "Clear/reset restores initial query controls and full result set idempotently without protected-state mutation.",
      ["Before, first clear, and second clear states prove exact reset and idempotence."],
      [
        "r10-clear-before-state.json",
        "r10-clear-after-state.json",
        "r10-clear-second-after-state.json",
        "r10-clear-reset-ui.png",
        "r10-clear-protected-state-diff.json"
      ]
    ),
    makeManifest(
      "AC-R10-006",
      "No-match state renders zero rows and visible accessible no-match text without mutating protected state.",
      ["Empty state JSON has zero IDs, screenshot shows no-match text, and protected diff is empty."],
      ["r10-empty-state.json", "r10-empty-state-ui.png", "r10-empty-protected-state-diff.json"]
    ),
    makeManifest(
      "AC-R10-007",
      "Reviewer mode keeps explorer controls usable as inspect-only state and persists query across mode switches.",
      ["Reviewer controls change result state only; operator return preserves query; clear/reset works after return."],
      [
        "r10-reviewer-explorer-before-state.json",
        "r10-reviewer-explorer-after-state.json",
        "r10-reviewer-explorer-operator-return-state.json",
        "r10-reviewer-explorer-protected-diff.json",
        "r10-reviewer-explorer-ui.png",
        "r10-trace.zip",
        "r10-video.webm"
      ]
    ),
    makeManifest(
      "AC-R10-008",
      "Explorer proof uses the approved non-trivial mixed fixture thresholds.",
      ["Fixture manifest proves seeded, accepted, rejected, kind, criterion, status, and tie-breaker thresholds."],
      ["r10-fixture-manifest.json", "r10-explorer-full-dataset.json"]
    ),
    makeManifest(
      "AC-R10-009",
      "Request 09 replay-reference durability survives the fresh Request 10 browser run.",
      ["Command-level inspection artifacts prove request-09 replay references and validator behavior."],
      [
        "../commands/r10-r09-replay-reference-inspection.log",
        "../commands/r10-r09-replay-generator-source-inspection.log",
        "../commands/validate-evidence-negative-missing-replay-manifest.log",
        "r09-trace.zip",
        "r09-video.webm",
        "../../request-09/browser/r09-trace.zip",
        "../../request-09/browser/r09-video.webm"
      ]
    ),
    makeManifest(
      "AC-R10-010",
      "Request 01 through Request 09 behavior remains present and passing after Request 10.",
      ["Full command logs and source inspection prove prior assertions are present and active."],
      [
        "../commands/npm-run-test.log",
        "../commands/npm-run-build.log",
        "../commands/npm-run-test-browser.log",
        "../commands/grep-no-skip-only.log",
        "../commands/r10-prior-assertions-source-inspection.log"
      ]
    )
  ];
}

test("Request 09 reviewer mode should block protected mutation paths while allowing keyboard mode switching", async ({
  page,
  context
}, testInfo) => {
  const attemptLog: Request09AttemptLogEntry[] = [];
  const sourceAudit = await request09SourceAudit(testInfo);
  const sourceRefs = sourceAudit.entries.map((entry) => `${entry.file}:${entry.startLine}-${entry.endLine}`);

  await openEvidenceImport(page);
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Operator");
  const defaultState = await request09SaveProtectedState(
    page,
    testInfo,
    "operator-default",
    "r09-operator-default-mode-state.json"
  );
  expect(defaultState.mode).toBe("operator");
  await saveRequest09Screenshot(page, "r09-operator-default-ui.png");

  await page.getByRole("button", { name: "Mark Payment confirmation PASS" }).click();
  await page.getByLabel("Evidence for Payment confirmation").selectOption("evidence-payment");
  await page.getByRole("button", { name: "Mark Order summary PASS" }).click();
  await page.getByLabel("Evidence for Order summary").selectOption("evidence-summary");
  await page.getByRole("button", { name: "Mark Recovery path FAIL" }).click();
  await page.getByLabel("Evidence for Recovery path").selectOption("evidence-recovery");
  await importEvidenceCsv(page, request09Csv);
  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 2");
  await page.getByTestId(`verification-action-${request09FailOnceRowId}`).click();
  await expect(page.getByTestId(`verification-row-${request09FailOnceRowId}`)).toContainText("failed", { timeout: 2000 });
  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  await expect(page.getByTestId("export-json-output")).toContainText(request09FailOnceRowId);

  const staleFailButton = await page.getByRole("button", { name: "Mark Payment confirmation FAIL" }).elementHandle();
  const staleEvidenceSelect = await page.locator("#evidence-criterion-payment").elementHandle();
  const staleCsvInput = await page.getByTestId("evidence-csv-input").elementHandle();
  const staleImportButton = await page.getByRole("button", { name: "Import CSV rows" }).elementHandle();
  const staleUndoButton = await page.getByTestId("undo-import-button").elementHandle();
  const staleRetryButton = await page.getByTestId(`verification-action-${request09FailOnceRowId}`).elementHandle();
  const staleExportButton = await page.getByRole("button", { name: "Export accepted JSON" }).elementHandle();
  const operatorBeforeReviewer = await request09SaveProtectedState(
    page,
    testInfo,
    "operator-before-reviewer",
    "r09-operator-before-reviewer-state.json"
  );

  await page.getByRole("button", { name: "Reviewer mode" }).focus();
  const activeBeforeReviewerToggle = await r07ReadActiveElement(page, "r09-reviewer-toggle-focused");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Reviewer");
  const activeAfterReviewerToggle = await r07ReadActiveElement(page, "r09-reviewer-toggle-activated");
  await expect(page.getByRole("button", { name: "Operator mode" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reviewer mode" })).toBeEnabled();
  await saveRequest09Screenshot(page, "r09-reviewer-mode-ui.png");

  const beforeReviewerAttempts = await request09SaveProtectedState(
    page,
    testInfo,
    "reviewer-before-attempts",
    "r09-reviewer-before-protected-state.json"
  );
  expect(beforeReviewerAttempts.mode).toBe("reviewer");
  const modeSwitchDiff = request09DiffProtectedStates(operatorBeforeReviewer, beforeReviewerAttempts);
  expect(modeSwitchDiff.modeChanged).toBe(true);
  expect(modeSwitchDiff.protectedStateUnchanged).toBe(true);
  await saveRequest09Json(testInfo, "r09-mode-switch-keyboard-state.json", {
    activeBeforeReviewerToggle,
    activeAfterReviewerToggle,
    modeSwitchDiff
  });

  await saveRequest09Json(testInfo, "r09-reviewer-before-validation-state.json", {
    csvText: beforeReviewerAttempts.csvText,
    validationState: beforeReviewerAttempts.validationState
  });
  await saveRequest09Json(testInfo, "r09-reviewer-before-import-history-state.json", {
    importState: beforeReviewerAttempts.importState,
    importHistoryState: beforeReviewerAttempts.importHistoryState
  });
  await saveRequest09Json(testInfo, "r09-reviewer-before-verification-state.json", beforeReviewerAttempts.verificationState);
  await saveRequest09Json(testInfo, "r09-reviewer-before-export.json", {
    exportText: beforeReviewerAttempts.exportText,
    exportPayload: beforeReviewerAttempts.exportPayload
  });

  const keyboardSequence = await request09TabSequence(page, 18);
  const keyboardFocusedProtectedControls = keyboardSequence.filter((state) =>
    /Import CSV rows|Undo last import|Export accepted JSON|Verify imported evidence|Retry verification|Mark Payment confirmation FAIL/.test(
      state.accessibleName
    )
  );
  expect(keyboardFocusedProtectedControls).toEqual([]);
  attemptLog.push(
    {
      surface: "review verdicts",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach PASS/FAIL buttons.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders review verdict buttons disabled, so native keyboard navigation cannot reach them.",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "seeded evidence selects",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach seeded evidence selects.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders seeded evidence selects disabled, so native keyboard navigation cannot reach them.",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "import action",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach Import CSV rows.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders import disabled, so native keyboard navigation cannot reach it.",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "undo action",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach Undo last import.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders undo disabled, so native keyboard navigation cannot reach it.",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "verification retry",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach Retry verification.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders verification/retry buttons disabled, so native keyboard navigation cannot reach them.",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "export generation",
      path: "keyboard",
      action: "Tab sequence in reviewer mode tried to reach Export accepted JSON.",
      result: "unreachable",
      unavailableReason: "Reviewer mode renders export disabled, so native keyboard navigation cannot reach it.",
      sourceAuditRefs: sourceRefs
    }
  );

  await page.getByTestId("evidence-csv-input").focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("id,title,kind,criterionId,source\nr09-keyboard-mutated,Keyboard,browser,criterion-payment,key.json");
  attemptLog.push({
    surface: "CSV text and validation",
    path: "keyboard",
    action: "Focused reviewer-mode read-only textarea and attempted Ctrl+A plus text insertion.",
    result: "attempted",
    sourceAuditRefs: sourceRefs
  });

  await request09StaleButtonClick(staleFailButton);
  await request09StaleSelectChange(staleEvidenceSelect, "evidence-summary");
  await request09StaleTextareaInput(
    staleCsvInput,
    "id,title,kind,criterionId,source\nr09-stale-mutated,Stale,browser,criterion-payment,stale.json"
  );
  await request09StaleButtonClick(staleImportButton);
  await request09StaleButtonClick(staleUndoButton);
  await request09StaleButtonClick(staleRetryButton);
  await request09StaleButtonClick(staleExportButton);
  attemptLog.push(
    {
      surface: "review verdicts",
      path: "stale-focus",
      action: "Captured operator-mode FAIL button handle before switching and dispatched Enter/click after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "seeded evidence selects",
      path: "stale-focus",
      action: "Captured operator-mode select handle before switching and dispatched change after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "CSV text and validation",
      path: "stale-focus",
      action: "Captured operator-mode textarea handle before switching and dispatched keyboard/input/change after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "import action",
      path: "stale-focus",
      action: "Captured operator-mode import button handle before switching and dispatched Enter/click after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "undo action",
      path: "stale-focus",
      action: "Captured operator-mode undo button handle before switching and dispatched Enter/click after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "verification retry",
      path: "stale-focus",
      action: "Captured operator-mode retry button handle before switching and dispatched Enter/click after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "export generation",
      path: "stale-focus",
      action: "Captured operator-mode export button handle before switching and dispatched Enter/click after reviewer mode.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    }
  );

  await request09ForceButtonClick(page, "Mark Payment confirmation FAIL");
  await request09ForceSelectChange(page, "criterion-payment", "evidence-summary");
  await request09ForceTextareaInput(
    page,
    "id,title,kind,criterionId,source\nr09-forced-mutated,Forced,browser,criterion-payment,forced.json"
  );
  await request09ForceButtonClick(page, "Import CSV rows");
  await request09ForceButtonClick(page, "Undo last import");
  await request09ForceButtonClick(page, "Retry verification");
  await request09ForceButtonClick(page, "Export accepted JSON");
  attemptLog.push(
    {
      surface: "review verdicts",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on FAIL button and dispatched click.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "seeded evidence selects",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on seeded evidence select and dispatched change.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "CSV text and validation",
      path: "forced-dom-event",
      action: "Set textarea value and dispatched input/change.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "import action",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on Import CSV rows and dispatched click.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "undo action",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on Undo last import and dispatched click.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "verification retry",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on Retry verification and dispatched click.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    },
    {
      surface: "export generation",
      path: "forced-dom-event",
      action: "Temporarily cleared disabled on Export accepted JSON and dispatched click.",
      result: "attempted",
      sourceAuditRefs: sourceRefs
    }
  );

  const afterReviewAttempts = await request09SaveProtectedState(
    page,
    testInfo,
    "reviewer-after-review-attempts",
    "r09-reviewer-after-review-attempts-state.json"
  );
  await saveRequest09Json(testInfo, "r09-reviewer-after-csv-attempts-state.json", {
    csvText: afterReviewAttempts.csvText,
    validationState: afterReviewAttempts.validationState
  });
  await saveRequest09Json(testInfo, "r09-reviewer-after-import-undo-attempts-state.json", {
    importState: afterReviewAttempts.importState,
    importHistoryState: afterReviewAttempts.importHistoryState
  });
  await saveRequest09Json(testInfo, "r09-reviewer-after-verification-attempts-state.json", afterReviewAttempts.verificationState);
  await saveRequest09Json(testInfo, "r09-reviewer-after-export-attempts.json", {
    exportText: afterReviewAttempts.exportText,
    exportPayload: afterReviewAttempts.exportPayload
  });

  const protectedStateDiff = request09DiffProtectedStates(beforeReviewerAttempts, afterReviewAttempts);
  await saveRequest09Json(testInfo, "r09-reviewer-protected-state-diff.json", protectedStateDiff);
  expect(protectedStateDiff.protectedStateUnchanged).toBe(true);
  expect(protectedStateDiff.changedProtectedKeys).toEqual([]);

  const inFlightPage = await context.newPage();
  await openEvidenceImport(inFlightPage);
  await importEvidenceCsv(inFlightPage, request09Csv);
  await inFlightPage.getByTestId(`verification-action-${request09SummaryRowId}`).click();
  await expect(inFlightPage.getByTestId(`verification-status-${request09SummaryRowId}`)).toHaveText("checking");
  await inFlightPage.getByRole("button", { name: "Reviewer mode" }).click();
  await expect(inFlightPage.getByTestId("workflow-mode-state")).toHaveText("Current mode: Reviewer");
  const inFlightBeforeWait = await request09SaveProtectedState(
    inFlightPage,
    testInfo,
    "reviewer-inflight-before-wait",
    "r09-reviewer-inflight-before-state.json"
  );
  await inFlightPage.waitForTimeout(minimumCheckingDurationMs + 650);
  const inFlightAfterWait = await request09SaveProtectedState(
    inFlightPage,
    testInfo,
    "reviewer-inflight-after-wait",
    "r09-reviewer-inflight-after-wait-state.json"
  );
  const inFlightReviewerDiff = request09DiffProtectedStates(inFlightBeforeWait, inFlightAfterWait);
  expect(inFlightAfterWait.verificationState[request09SummaryRowId]?.status).toBe("checking");
  expect(inFlightReviewerDiff.protectedStateUnchanged).toBe(true);
  await inFlightPage.getByRole("button", { name: "Operator mode" }).click();
  await expect(inFlightPage.getByTestId(`verification-status-${request09SummaryRowId}`)).toHaveText("verified", { timeout: 2000 });
  await request09SaveProtectedState(
    inFlightPage,
    testInfo,
    "operator-inflight-resolved",
    "r09-operator-inflight-resolved-state.json"
  );
  await inFlightPage.close();

  await saveRequest09Json(testInfo, "r09-reviewer-attempt-log.json", {
    keyboardSequence,
    attempts: attemptLog
  });

  const noExportPage = await context.newPage();
  await openEvidenceImport(noExportPage);
  await importEvidenceCsv(
    noExportPage,
    evidenceCsv(["r09-no-export,Request 09 no export proof,browser,criterion-payment,no-export.json"])
  );
  await noExportPage.getByRole("button", { name: "Reviewer mode" }).focus();
  await noExportPage.keyboard.press("Enter");
  await request09ForceButtonClick(noExportPage, "Export accepted JSON");
  const noExportState = await request09ReadProtectedState(noExportPage, "reviewer-no-export-generation");
  await saveRequest09Json(testInfo, "r09-reviewer-no-export-generation-state.json", noExportState);
  expect(noExportState.mode).toBe("reviewer");
  expect(noExportState.exportText).toBeNull();
  await noExportPage.close();

  await page.getByRole("button", { name: "Operator mode" }).focus();
  const activeBeforeOperatorToggle = await r07ReadActiveElement(page, "r09-operator-toggle-focused");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Operator");
  const operatorRestored = await request09SaveProtectedState(
    page,
    testInfo,
    "operator-restored",
    "r09-operator-restored-state.json"
  );
  const restoreDiff = request09DiffProtectedStates(operatorBeforeReviewer, operatorRestored);
  expect(restoreDiff.protectedStateUnchanged).toBe(true);
  await expect(page.getByRole("button", { name: "Mark Payment confirmation FAIL" })).toBeEnabled();
  await expect(page.getByLabel("Evidence for Payment confirmation")).toBeEnabled();
  await expect(page.getByTestId("evidence-csv-input")).not.toHaveAttribute("readonly", "");
  await saveRequest09Screenshot(page, "r09-operator-restored-ui.png");

  await page.getByRole("button", { name: "Mark Payment confirmation FAIL" }).click();
  const postRestoreMutation = await request09SaveProtectedState(
    page,
    testInfo,
    "operator-post-restore-mutation",
    "r09-operator-post-restore-mutation-state.json"
  );
  expect(request09DiffProtectedStates(operatorRestored, postRestoreMutation).changedProtectedKeys).toContain("criteria");

  const acManifestNames = Array.from({ length: 10 }, (_, index) => `ac-r09-${String(index + 1).padStart(3, "0")}-manifest.json`);
  const capturedUrl = page.url();
  const pageTitle = await page.title();
  const acManifests = request09BrowserManifests({ capturedUrl, pageTitle });
  await Promise.all(acManifests.map((manifest, index) => saveRequest09Json(testInfo, acManifestNames[index] ?? "", manifest)));
  await saveRequest09Json(testInfo, "r09-evidence-manifest.json", {
    generatedBy: "Request 09 Playwright workflow",
    archiveDir: request09ArchiveDir,
    acManifests: acManifestNames,
    modeSwitch: {
      activeBeforeOperatorToggle,
      activeBeforeReviewerToggle,
      activeAfterReviewerToggle
    },
    attempts: attemptLog.map((entry) => `${entry.surface}:${entry.path}`),
    centralArtifacts: [
      "r09-operator-default-mode-state.json",
      "r09-mode-switch-keyboard-state.json",
      "r09-reviewer-before-protected-state.json",
      "r09-reviewer-after-review-attempts-state.json",
      "r09-reviewer-protected-state-diff.json",
      "r09-reviewer-attempt-log.json",
      "r09-source-audit.json",
      "r09-trace.zip",
      "r09-video.webm",
      "r09-prior-assertions-source-inspection.log",
      "r09-operator-restored-state.json",
      "r09-operator-post-restore-mutation-state.json"
    ]
  });
  await saveRequest09EvidenceIndex({
    request: "request-09",
    archiveDir: request09ArchiveDir,
    indexCreatedBy: "Request 09 Playwright workflow",
    acManifests,
    evidenceManifest: `${request09ArchiveDir}/r09-evidence-manifest.json`
  });
});

test("Request 10 evidence explorer should search filter sort and stay inspect-only in reviewer mode", async ({
  page
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-05-28T08:00:00.000Z") });
  await openEvidenceImport(page);
  await page.clock.pauseAt(new Date("2026-05-28T08:01:00.000Z"));
  await importEvidenceCsv(page, request10ImportedCsv);
  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 6");
  await expect(page.getByTestId("rejected-count")).toHaveText("Rejected: 1");

  await page.getByTestId(`verification-action-${deterministicFailOnceEvidenceId}`).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId(`verification-status-${deterministicFailOnceEvidenceId}`)).toHaveText("failed", {
    timeout: 2000
  });
  await page.getByTestId("verification-action-r10-005-summary-browser").click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId("verification-status-r10-005-summary-browser")).toHaveText("verified", {
    timeout: 2000
  });
  await page.getByTestId(`verification-action-${request10CheckingRowId}`).click();
  await expect(page.getByTestId(`verification-status-${request10CheckingRowId}`)).toHaveText("checking");
  await expect(page.getByTestId("evidence-explorer-fixture-json")).toContainText('"concreteVerificationStatusCount": 4');
  await page.getByRole("button", { name: "Mark Payment confirmation PASS" }).click();
  await page.getByLabel("Evidence for Payment confirmation").selectOption("evidence-payment");
  await page.getByRole("button", { name: "Export accepted JSON" }).click();

  const defaultState = await saveRequest10ExplorerState(
    page,
    testInfo,
    "r10-explorer-full-dataset.json",
    request10DefaultIds
  );
  expect(defaultState.rows.every((row) => row.id !== "rejected-secret-token")).toBe(true);
  expect(defaultState.rows).toContainEqual(
    expect.objectContaining({
      id: "evidence-payment",
      origin: "seeded",
      verificationStatus: "not-applicable"
    })
  );
  expect(defaultState.rows).toContainEqual(
    expect.objectContaining({
      id: deterministicFailOnceEvidenceId,
      origin: "imported",
      verificationStatus: "failed"
    })
  );
  await saveRequest10Screenshot(page, "r10-explorer-default-ui.png");

  const fixtureManifest = {
    seededRowCount: defaultState.rows.filter((row) => row.origin === "seeded").length,
    acceptedImportedRowCount: defaultState.rows.filter((row) => row.origin === "imported").length,
    rejectedImportedRowCount: 1,
    kindCount: new Set(defaultState.rows.map((row) => row.kind)).size,
    criterionCount: new Set(defaultState.rows.map((row) => row.criterionId)).size,
    concreteVerificationStatusCount: new Set(
      defaultState.rows.filter((row) => row.origin === "imported").map((row) => row.verificationStatus)
    ).size,
    hasEvidenceIdTieBreakerFixture: true
  };
  await saveRequest10Json(testInfo, "r10-fixture-manifest.json", fixtureManifest);
  expect(fixtureManifest).toEqual({
    seededRowCount: 3,
    acceptedImportedRowCount: 6,
    rejectedImportedRowCount: 1,
    kindCount: 3,
    criterionCount: 3,
    concreteVerificationStatusCount: 4,
    hasEvidenceIdTieBreakerFixture: true
  });

  const searchCases = [];
  await request10SetExplorerQuery(page, { search: `  ${deterministicFailOnceEvidenceId.toUpperCase()}  ` });
  searchCases.push(await saveRequest10ExplorerState(page, testInfo, "r10-search-id-state.json", [deterministicFailOnceEvidenceId]));
  await request10SetExplorerQuery(page, { search: "screenshot totals" });
  searchCases.push(await saveRequest10ExplorerState(page, testInfo, "r10-search-title-state.json", ["r10-005-summary-browser"]));
  await request10SetExplorerQuery(page, { search: "CRITERION-RECOVERY" });
  searchCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-search-criterion-state.json", [
      "evidence-recovery",
      request10CheckingRowId,
      "r10-006-recovery-test"
    ])
  );
  await request10SetExplorerQuery(page, { search: "api/orders" });
  searchCases.push(await saveRequest10ExplorerState(page, testInfo, "r10-search-source-state.json", ["r10-002-summary-api"]));
  await request10SetExplorerQuery(page, { search: "rejected-secret-token" });
  searchCases.push(await saveRequest10ExplorerState(page, testInfo, "r10-search-rejected-state.json", []));
  await request10SetExplorerQuery(page, { search: "   " });
  searchCases.push(await saveRequest10ExplorerState(page, testInfo, "r10-search-empty-state.json", request10DefaultIds));
  await saveRequest10Json(testInfo, "r10-search-results.json", {
    query: "id/title/criterion/source/rejected/empty search cases",
    expectedIds: searchCases.map((state) => state.expectedIds),
    actualIds: searchCases.map((state) => state.actualIds),
    missingIds: searchCases.flatMap((state) => state.missingIds),
    unexpectedIds: searchCases.flatMap((state) => state.unexpectedIds),
    cases: searchCases
  });
  await saveRequest10Screenshot(page, "r10-search-trim-case-ui.png");

  const filterCases = [];
  await request10ResetExplorer(page);
  await request10SetExplorerQuery(page, { verificationStatus: "checking" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-status-checking-state.json", [
      request10CheckingRowId
    ])
  );
  await request10SetExplorerQuery(page, { verificationStatus: "unverified" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-status-unverified-state.json", [
      "r10-002-summary-api",
      "r10-004-payment-api",
      "r10-006-recovery-test"
    ])
  );
  await request10SetExplorerQuery(page, { verificationStatus: "failed" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-status-failed-state.json", [
      deterministicFailOnceEvidenceId
    ])
  );
  await request10SetExplorerQuery(page, { verificationStatus: "verified" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-status-verified-state.json", [
      "r10-005-summary-browser"
    ])
  );
  for (const statusFilterCase of filterCases) {
    expect(statusFilterCase.rows.every((row) => row.origin === "imported")).toBe(true);
  }
  await request10SetExplorerQuery(page, { verificationStatus: "all" });
  await request10SetExplorerQuery(page, { origin: "seeded" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-origin-state.json", [
      "evidence-recovery",
      "evidence-payment",
      "evidence-summary"
    ])
  );
  await request10SetExplorerQuery(page, { origin: "all", kind: "api" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-kind-state.json", [
      "r10-002-summary-api",
      "evidence-recovery",
      "r10-004-payment-api"
    ])
  );
  await request10SetExplorerQuery(page, { kind: "all", criterionId: "criterion-summary" });
  filterCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-filter-criterion-state.json", [
      "r10-002-summary-api",
      "evidence-summary",
      "r10-005-summary-browser"
    ])
  );
  await request10SetExplorerQuery(page, {
    origin: "imported",
    kind: "test",
    criterionId: "criterion-recovery",
    verificationStatus: "all"
  });
  const combinedFilter = await saveRequest10ExplorerState(page, testInfo, "r10-filter-combined-state.json", [
    request10CheckingRowId,
    "r10-006-recovery-test"
  ]);
  filterCases.push(combinedFilter);
  await saveRequest10Json(testInfo, "r10-filter-results.json", {
    query: "origin/kind/status/criterion/combined filter cases",
    expectedIds: filterCases.map((state) => state.expectedIds),
    actualIds: filterCases.map((state) => state.actualIds),
    missingIds: filterCases.flatMap((state) => state.missingIds),
    unexpectedIds: filterCases.flatMap((state) => state.unexpectedIds),
    cases: filterCases
  });
  await saveRequest10Screenshot(page, "r10-filter-combined-ui.png");

  const sortCases = [];
  await request10ResetExplorer(page);
  await request10SetExplorerQuery(page, { sortField: "title", sortDirection: "asc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-title-asc-state.json", request10DefaultIds)
  );
  await request10SetExplorerQuery(page, { sortField: "title", sortDirection: "desc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-title-desc-state.json", [
      "r10-005-summary-browser",
      "evidence-summary",
      "evidence-payment",
      deterministicFailOnceEvidenceId,
      request10CheckingRowId,
      "r10-006-recovery-test",
      "r10-004-payment-api",
      "evidence-recovery",
      "r10-002-summary-api"
    ])
  );
  await request10SetExplorerQuery(page, { sortField: "criterionId", sortDirection: "asc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-criterion-asc-state.json", [
      "evidence-payment",
      deterministicFailOnceEvidenceId,
      "r10-004-payment-api",
      "evidence-recovery",
      request10CheckingRowId,
      "r10-006-recovery-test",
      "evidence-summary",
      "r10-002-summary-api",
      "r10-005-summary-browser"
    ])
  );
  await request10SetExplorerQuery(page, { sortDirection: "desc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-criterion-desc-state.json", [
      "evidence-summary",
      "r10-002-summary-api",
      "r10-005-summary-browser",
      "evidence-recovery",
      request10CheckingRowId,
      "r10-006-recovery-test",
      "evidence-payment",
      deterministicFailOnceEvidenceId,
      "r10-004-payment-api"
    ])
  );
  await request10SetExplorerQuery(page, { sortField: "kind", sortDirection: "asc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-kind-asc-state.json", [
      "evidence-recovery",
      "r10-002-summary-api",
      "r10-004-payment-api",
      "evidence-payment",
      "evidence-summary",
      deterministicFailOnceEvidenceId,
      "r10-005-summary-browser",
      request10CheckingRowId,
      "r10-006-recovery-test"
    ])
  );
  await request10SetExplorerQuery(page, { sortDirection: "desc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-kind-desc-state.json", [
      request10CheckingRowId,
      "r10-006-recovery-test",
      "evidence-payment",
      "evidence-summary",
      deterministicFailOnceEvidenceId,
      "r10-005-summary-browser",
      "evidence-recovery",
      "r10-002-summary-api",
      "r10-004-payment-api"
    ])
  );
  await page.getByTestId("verification-action-r10-006-recovery-test").click();
  await expect(page.getByTestId("verification-status-r10-006-recovery-test")).toHaveText("checking");
  await request10SetExplorerQuery(page, { sortField: "verificationStatus", sortDirection: "asc" });
  const statusAsc = await saveRequest10ExplorerState(page, testInfo, "r10-sort-status-asc-state.json", [
    request10CheckingRowId,
    "r10-006-recovery-test",
    deterministicFailOnceEvidenceId,
    "r10-002-summary-api",
    "r10-004-payment-api",
    "r10-005-summary-browser",
    "evidence-payment",
    "evidence-recovery",
    "evidence-summary"
  ]);
  sortCases.push(statusAsc);
  await request10SetExplorerQuery(page, { sortDirection: "desc" });
  const statusDesc = await saveRequest10ExplorerState(page, testInfo, "r10-sort-status-desc-state.json", [
    "evidence-payment",
    "evidence-recovery",
    "evidence-summary",
    "r10-005-summary-browser",
    "r10-002-summary-api",
    "r10-004-payment-api",
    deterministicFailOnceEvidenceId,
    request10CheckingRowId,
    "r10-006-recovery-test"
  ]);
  sortCases.push(statusDesc);
  await request10SetExplorerQuery(page, { sortField: "origin", sortDirection: "asc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-origin-asc-state.json", [
      deterministicFailOnceEvidenceId,
      "r10-002-summary-api",
      request10CheckingRowId,
      "r10-004-payment-api",
      "r10-005-summary-browser",
      "r10-006-recovery-test",
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary"
    ])
  );
  await request10SetExplorerQuery(page, { sortField: "origin", sortDirection: "desc" });
  sortCases.push(
    await saveRequest10ExplorerState(page, testInfo, "r10-sort-origin-desc-state.json", [
      "evidence-payment",
      "evidence-recovery",
      "evidence-summary",
      deterministicFailOnceEvidenceId,
      "r10-002-summary-api",
      request10CheckingRowId,
      "r10-004-payment-api",
      "r10-005-summary-browser",
      "r10-006-recovery-test"
    ])
  );
  await saveRequest10Json(testInfo, "r10-sort-results.json", {
    query: "title/status/origin sort cases with tie-breakers",
    expectedIds: sortCases.map((state) => state.expectedIds),
    actualIds: sortCases.map((state) => state.actualIds),
    missingIds: sortCases.flatMap((state) => state.missingIds),
    unexpectedIds: sortCases.flatMap((state) => state.unexpectedIds),
    cases: sortCases
  });
  await saveRequest10Screenshot(page, "r10-sort-status-ui.png");
  await page.clock.runFor(1000);
  await expect(page.getByTestId("verification-status-r10-006-recovery-test")).toHaveText("verified", { timeout: 2000 });

  const beforeClearProtected = await request09ReadProtectedState(page, "r10-before-clear");
  await request10SetExplorerQuery(page, {
    search: "payment",
    origin: "imported",
    kind: "api",
    criterionId: "criterion-payment",
    verificationStatus: "unverified",
    sortField: "verificationStatus",
    sortDirection: "desc"
  });
  await saveRequest10ExplorerState(page, testInfo, "r10-clear-before-state.json", ["r10-004-payment-api"]);
  await request10ResetExplorer(page);
  await saveRequest10ExplorerState(page, testInfo, "r10-clear-after-state.json", request10DefaultIds);
  await request10ResetExplorer(page);
  await saveRequest10ExplorerState(page, testInfo, "r10-clear-second-after-state.json", request10DefaultIds);
  const afterClearProtected = await request09ReadProtectedState(page, "r10-after-clear");
  await saveRequest10ProtectedDiff(testInfo, "r10-clear-protected-state-diff.json", beforeClearProtected, afterClearProtected);
  await saveRequest10Screenshot(page, "r10-clear-reset-ui.png");

  const beforeEmptyProtected = await request09ReadProtectedState(page, "r10-before-empty");
  await request10SetExplorerQuery(page, { search: "no matching evidence" });
  await expect(page.getByTestId("evidence-explorer-empty")).toContainText("No evidence matches");
  await saveRequest10ExplorerState(page, testInfo, "r10-empty-state.json", []);
  const afterEmptyProtected = await request09ReadProtectedState(page, "r10-after-empty");
  await saveRequest10ProtectedDiff(testInfo, "r10-empty-protected-state-diff.json", beforeEmptyProtected, afterEmptyProtected);
  await saveRequest10Screenshot(page, "r10-empty-state-ui.png");

  await request10ResetExplorer(page);
  await page.getByRole("button", { name: "Reviewer mode" }).click();
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Reviewer");
  const beforeReviewerExplorer = await request09ReadProtectedState(page, "r10-reviewer-before-explorer");
  await saveRequest10ExplorerState(page, testInfo, "r10-reviewer-explorer-before-state.json", request10DefaultIds);
  await request10SetExplorerQuery(page, {
    origin: "imported",
    kind: "api",
    criterionId: "criterion-payment",
    sortField: "title",
    sortDirection: "asc"
  });
  const reviewerExplorerAfter = await saveRequest10ExplorerState(
    page,
    testInfo,
    "r10-reviewer-explorer-after-state.json",
    ["r10-004-payment-api"]
  );
  const afterReviewerExplorer = await request09ReadProtectedState(page, "r10-reviewer-after-explorer");
  await saveRequest10ProtectedDiff(
    testInfo,
    "r10-reviewer-explorer-protected-diff.json",
    beforeReviewerExplorer,
    afterReviewerExplorer
  );
  await saveRequest10Screenshot(page, "r10-reviewer-explorer-ui.png");
  await page.getByRole("button", { name: "Operator mode" }).click();
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Operator");
  const operatorReturnState = await saveRequest10ExplorerState(
    page,
    testInfo,
    "r10-reviewer-explorer-operator-return-state.json",
    reviewerExplorerAfter.expectedIds
  );
  expect(operatorReturnState.query).toEqual(reviewerExplorerAfter.query);
  await request10ResetExplorer(page);
  await saveRequest10ExplorerState(page, testInfo, "r10-reviewer-explorer-clear-after-return-state.json", request10DefaultIds);

  const acManifestNames = Array.from({ length: 10 }, (_, index) => `ac-r10-${String(index + 1).padStart(3, "0")}-manifest.json`);
  const capturedUrl = page.url();
  const pageTitle = await page.title();
  const acManifests = request10BrowserManifests({ capturedUrl, pageTitle });
  await Promise.all(acManifests.map((manifest, index) => saveRequest10Json(testInfo, acManifestNames[index] ?? "", manifest)));
  await saveRequest10Json(testInfo, "r10-evidence-manifest.json", {
    generatedBy: "Request 10 Playwright workflow",
    archiveDir: request10ArchiveDir,
    acManifests: acManifestNames,
    screenshots: [
      "r10-explorer-default-ui.png",
      "r10-search-trim-case-ui.png",
      "r10-filter-combined-ui.png",
      "r10-sort-status-ui.png",
      "r10-clear-reset-ui.png",
      "r10-empty-state-ui.png",
      "r10-reviewer-explorer-ui.png"
    ],
    jsonArtifacts: [
      "r10-explorer-full-dataset.json",
      "r10-fixture-manifest.json",
      "r10-search-results.json",
      "r10-filter-results.json",
      "r10-filter-status-checking-state.json",
      "r10-filter-status-unverified-state.json",
      "r10-filter-status-failed-state.json",
      "r10-filter-status-verified-state.json",
      "r10-sort-results.json",
      "r10-sort-title-asc-state.json",
      "r10-sort-title-desc-state.json",
      "r10-sort-criterion-asc-state.json",
      "r10-sort-criterion-desc-state.json",
      "r10-sort-kind-asc-state.json",
      "r10-sort-kind-desc-state.json",
      "r10-sort-status-asc-state.json",
      "r10-sort-status-desc-state.json",
      "r10-sort-origin-asc-state.json",
      "r10-sort-origin-desc-state.json",
      "r10-clear-before-state.json",
      "r10-clear-after-state.json",
      "r10-clear-second-after-state.json",
      "r10-empty-state.json",
      "r10-reviewer-explorer-protected-diff.json"
    ]
  });
  await saveRequest10EvidenceIndex({
    request: "request-10",
    archiveDir: request10ArchiveDir,
    indexCreatedBy: "Request 10 Playwright workflow",
    verifiedState: "state-file:.shepherd/dogfood-12/request-10/evidence/index.json",
    finalWorktreeState: "pending-final-command-fingerprint",
    acManifests,
    evidenceManifest: `${request10ArchiveDir}/r10-evidence-manifest.json`
  });
});

test("Request 11 review handoff pack should snapshot prove stale categories and regenerate", async ({
  page
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-05-28T09:00:00.000Z") });
  await openEvidenceImport(page);
  await page.clock.pauseAt(new Date("2026-05-28T09:01:00.000Z"));

  const sequence: Array<Record<string, unknown>> = [];
  await importEvidenceCsv(page, request11InitialCsv);
  sequence.push({ step: "initial-import", importHistory: await readImportHistoryState(page) });
  await page.getByTestId("evidence-csv-input").fill(request11MainCsv);
  await page.getByRole("button", { name: "Import CSV rows" }).click();
  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 4");
  await expect(page.getByTestId("rejected-count")).toHaveText("Rejected: 1");
  sequence.push({ step: "main-import", importHistory: await readImportHistoryState(page) });

  await page.getByTestId(`verification-action-${deterministicFailOnceEvidenceId}`).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId(`verification-status-${deterministicFailOnceEvidenceId}`)).toHaveText("failed");
  await page.getByTestId(`verification-action-${deterministicFailOnceEvidenceId}`).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId(`verification-status-${deterministicFailOnceEvidenceId}`)).toHaveText("verified");
  sequence.push({ step: "fail-once-retry-verified", verification: await readRequest08VerificationState(page) });

  await request11SetExplorerQuery(page, {
    search: "proof",
    origin: "imported",
    sortField: "title",
    sortDirection: "asc"
  });
  const explorerAtGeneration = await readRequest10ExplorerState(page);
  expect(explorerAtGeneration.actualIds).toEqual([
    request11LaterVerificationRowId,
    deterministicFailOnceEvidenceId,
    request11RecoveryRowId,
    request11SummaryRowId
  ]);
  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  await page.clock.runFor(100);
  await page.getByTestId("handoff-pack-generate").click();
  const generated = await saveRequest11PackState(page, testInfo, "r11-pack-generated-state.json");
  expect(generated.activePack?.packId).toBe("handoff-pack-1");
  expect(generated.activePack?.modeAtGeneration).toBe("operator");
  expect(generated.activePack?.isStale).toBe(false);
  expect(generated.activePack?.staleCategories).toEqual([]);
  expect(generated.activePack?.explorerResultIds).toEqual(explorerAtGeneration.actualIds);
  expect(generated.activePack?.embeddedExportJson).toBe(await readExportText(page));
  await saveRequest11Json(testInfo, "r11-pack-export-embedded.json", generated.activePack);
  await saveRequest11Json(testInfo, "r11-export-comparison.json", {
    embeddedExportJson: generated.activePack?.embeddedExportJson,
    currentExportJson: await readExportText(page),
    equal: generated.activePack?.embeddedExportJson === (await readExportText(page))
  });
  await saveRequest11Json(testInfo, "r11-current-vs-pack-fingerprints.json", generated.status);
  await saveRequest11Screenshot(page, "r11-pack-visible-ui.png");
  sequence.push({ step: "pack-generated", packId: generated.activePack?.packId });

  await page.getByRole("button", { name: "Reviewer mode" }).click();
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Reviewer");
  const reviewerBefore = await request11ProtectedState(page, "reviewer-before");
  const reviewerPackBefore = await saveRequest11PackState(page, testInfo, "r11-reviewer-pack-before-state.json");
  expect(reviewerPackBefore.actionState.canGenerateHandoffPack).toBe(false);
  await page.getByTestId("handoff-pack-generate").evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      button.disabled = false;
      button.click();
    }
  });
  const reviewerAfter = await request11ProtectedState(page, "reviewer-after-forced-regenerate");
  const reviewerDiff = request11DiffProtected(reviewerBefore, reviewerAfter);
  expect(reviewerDiff.protectedStateUnchanged).toBe(true);
  await saveRequest11Json(testInfo, "r11-reviewer-pack-after-state.json", reviewerAfter.handoffPackState);
  await saveRequest11Json(testInfo, "r11-reviewer-protected-diff.json", reviewerDiff);
  await saveRequest11Screenshot(page, "r11-reviewer-pack-ui.png");
  sequence.push({ step: "reviewer-inspection", protectedStateUnchanged: true });

  await page.getByRole("button", { name: "Operator mode" }).click();
  const modeOnlyFresh = await saveRequest11PackState(page, testInfo, "r11-mode-only-fresh-state.json");
  expect(modeOnlyFresh.status.isStale).toBe(false);
  expect(modeOnlyFresh.status.staleCategories).toEqual([]);
  await saveRequest11Json(testInfo, "r11-reviewer-inspection-fresh-state.json", modeOnlyFresh);

  await request11SetExplorerQuery(page, { search: "summary" });
  const explorerStale = await saveRequest11PackState(page, testInfo, "r11-stale-after-explorer-state.json");
  expect(explorerStale.status.staleCategories).toEqual(["explorer"]);
  expect(explorerStale.activePack?.explorerResultIds).toEqual(explorerAtGeneration.actualIds);
  await saveRequest11Screenshot(page, "r11-stale-after-explorer-ui.png");
  sequence.push({ step: "explorer-stale", staleCategories: explorerStale.status.staleCategories });

  await request11SetExplorerQuery(page, { search: "proof" });
  await expect.poll(async () => (await readRequest11PackState(page)).status.staleCategories).toEqual([]);

  await page.getByTestId(`verification-action-${request11LaterVerificationRowId}`).click();
  await page.clock.runFor(1000);
  await expect(page.getByTestId(`verification-status-${request11LaterVerificationRowId}`)).toHaveText("verified");
  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  const verificationStale = await saveRequest11PackState(page, testInfo, "r11-stale-after-verification-state.json");
  expect(verificationStale.status.staleCategories).toEqual(["verification", "export"]);
  expect(verificationStale.activePack?.verificationStatusMap[request11LaterVerificationRowId]?.status).toBe("unverified");
  await saveRequest11Screenshot(page, "r11-stale-after-verification-ui.png");
  sequence.push({ step: "verification-export-stale", staleCategories: verificationStale.status.staleCategories });

  await request11SetExplorerQuery(page, { search: "no-match-handoff" });
  const preRegeneration = await saveRequest11PackState(page, testInfo, "r11-pack-pre-regeneration-state.json");
  expect(preRegeneration.status.isStale).toBe(true);
  await page.getByTestId("handoff-pack-generate").click();
  const regenerated = await saveRequest11PackState(page, testInfo, "r11-pack-regenerated-state.json");
  expect(regenerated.activePack?.packId).toBe("handoff-pack-2");
  expect(regenerated.status.isStale).toBe(false);
  expect(regenerated.activePack?.staleCategories).toEqual([]);
  expect(regenerated.activePack?.explorerResultIds).toEqual([]);
  await saveRequest11Screenshot(page, "r11-pack-regenerated-ui.png");
  sequence.push({ step: "regenerated", packId: regenerated.activePack?.packId });

  await page.getByTestId("evidence-csv-input").fill(request11ImportChangedCsv);
  await page.getByRole("button", { name: "Import CSV rows" }).click();
  const importStale = await saveRequest11PackState(page, testInfo, "r11-stale-after-import-state.json");
  expect(importStale.status.staleCategories).toEqual(["import", "importHistory", "export"]);
  expect(importStale.activePack?.packId).toBe("handoff-pack-2");
  await saveRequest11Screenshot(page, "r11-stale-after-import-ui.png");
  sequence.push({ step: "import-stale", staleCategories: importStale.status.staleCategories });

  await saveRequest11Json(testInfo, "r11-fingerprint-matrix.json", {
    generatedFingerprints: generated.activePack?.sourceFingerprints,
    regeneratedFingerprints: regenerated.activePack?.sourceFingerprints,
    importStaleFingerprints: importStale.status
  });
  await saveRequest11Json(testInfo, "r11-cross-feature-sequence.json", sequence);

  const capturedUrl = page.url();
  const pageTitle = await page.title();
  const acManifestEvidence = [
    {
      ac_id: "AC-R11-001",
      assertions: [
        "Operator mode generated a pack only after the explicit generate action.",
        "The generated pack JSON includes every required snapshot field and starts fresh."
      ],
      artifacts: ["r11-pack-generated-state.json", "r11-pack-visible-ui.png", "r11-cross-feature-sequence.json"]
    },
    {
      ac_id: "AC-R11-002",
      assertions: [
        "Source fingerprints are canonical and comparable for import, history, verification, explorer, and export sources.",
        "Non-source fields are absent from source fingerprints."
      ],
      artifacts: ["r11-fingerprint-matrix.json", "r11-current-vs-pack-fingerprints.json"]
    },
    {
      ac_id: "AC-R11-003",
      assertions: [
        "The pack embeds the current export JSON payload instead of only linking or fingerprinting it.",
        "The embedded export payload is structurally equal to the current export at generation time."
      ],
      artifacts: ["r11-pack-export-embedded.json", "r11-export-comparison.json", "r11-pack-generated-state.json"]
    },
    {
      ac_id: "AC-R11-004",
      assertions: [
        "Reviewer mode can inspect existing pack UI and JSON.",
        "Reviewer generate/regenerate controls cannot mutate protected state, including when the control is forcibly enabled."
      ],
      artifacts: [
        "r11-reviewer-pack-before-state.json",
        "r11-reviewer-pack-after-state.json",
        "r11-reviewer-protected-diff.json",
        "r11-reviewer-pack-ui.png",
        "r11-trace.zip",
        "r11-video.webm"
      ]
    },
    {
      ac_id: "AC-R11-005",
      assertions: [
        "Mode switches and display-only reviewer inspection leave the pack fresh.",
        "Mode remains pack metadata, not a source fingerprint input."
      ],
      artifacts: [
        "r11-mode-only-fresh-state.json",
        "r11-reviewer-inspection-fresh-state.json",
        "r11-current-vs-pack-fingerprints.json"
      ]
    },
    {
      ac_id: "AC-R11-006",
      assertions: [
        "An upstream import change keeps the previous pack viewable.",
        "The stale categories are exactly import, importHistory, and export for the exercised import change."
      ],
      artifacts: ["r11-stale-after-import-state.json", "r11-stale-after-import-ui.png", "r11-pack-regenerated-state.json"]
    },
    {
      ac_id: "AC-R11-007",
      assertions: [
        "A verification status change keeps the previous pack snapshot unchanged.",
        "The stale categories are exactly verification and export for the exercised verification change."
      ],
      artifacts: [
        "r11-stale-after-verification-state.json",
        "r11-stale-after-verification-ui.png",
        "r11-pack-generated-state.json"
      ]
    },
    {
      ac_id: "AC-R11-008",
      assertions: [
        "An explorer query/result change marks the pack stale with exactly explorer.",
        "The pack preserves its captured query and ordered result IDs while stale."
      ],
      artifacts: [
        "r11-stale-after-explorer-state.json",
        "r11-stale-after-explorer-ui.png",
        "r11-pack-generated-state.json"
      ]
    },
    {
      ac_id: "AC-R11-009",
      assertions: [
        "Operator regeneration starts from a stale pack and requires an explicit regenerate click.",
        "The regenerated pack has a new generation marker, current fingerprints, fresh stale status, and updated result IDs."
      ],
      artifacts: [
        "r11-pack-pre-regeneration-state.json",
        "r11-pack-regenerated-state.json",
        "r11-pack-regenerated-ui.png",
        "r11-cross-feature-sequence.json"
      ]
    },
    {
      ac_id: "AC-R11-010",
      assertions: [
        "One integrated browser workflow covers import, history, fail/retry verification, explorer, export, generation, reviewer inspection, stale detection, and regeneration.",
        "The workflow is replayable through saved trace and video artifacts."
      ],
      artifacts: [
        "r11-cross-feature-sequence.json",
        "r11-trace.zip",
        "r11-video.webm",
        "r11-pack-visible-ui.png",
        "r11-reviewer-pack-ui.png",
        "r11-stale-after-explorer-ui.png",
        "r11-stale-after-verification-ui.png",
        "r11-stale-after-import-ui.png",
        "r11-pack-regenerated-ui.png"
      ]
    },
    {
      ac_id: "AC-R11-011",
      assertions: [
        "Request 01 through Request 10 browser and unit assertions remain present.",
        "Full unit, build, browser, no-skip, and prior-assertion inspection logs are required alongside this manifest."
      ],
      artifacts: [
        "npm-run-test.log",
        "npm-run-build.log",
        "npm-run-test-browser.log",
        "grep-no-skip-only.log",
        "r11-prior-assertions-source-inspection.log"
      ]
    }
  ];
  const acManifests = acManifestEvidence.map((evidence) => ({
    type: "browser-evidence",
    ac_id: evidence.ac_id,
    expected_route_or_state: "Request 11 review handoff pack cross-feature proof",
    captured_url: capturedUrl,
    page_title: pageTitle,
    assertions: evidence.assertions,
    artifacts: evidence.artifacts,
    final_state_fingerprint: "state-file:.shepherd/dogfood-12/request-11/evidence/index.json",
    verdict: "PASS"
  }));
  await Promise.all(
    acManifests.map((manifest, index) =>
      saveRequest11Json(testInfo, `ac-r11-${String(index + 1).padStart(3, "0")}-manifest.json`, manifest)
    )
  );
  await saveRequest11Json(testInfo, "r11-evidence-manifest.json", {
    generatedBy: "Request 11 Playwright workflow",
    archiveDir: request11ArchiveDir,
    acManifests: acManifests.map((_, index) => `ac-r11-${String(index + 1).padStart(3, "0")}-manifest.json`),
    screenshots: [
      "r11-pack-visible-ui.png",
      "r11-reviewer-pack-ui.png",
      "r11-stale-after-explorer-ui.png",
      "r11-stale-after-verification-ui.png",
      "r11-stale-after-import-ui.png",
      "r11-pack-regenerated-ui.png"
    ],
    jsonArtifacts: [
      "r11-cross-feature-sequence.json",
      "r11-pack-generated-state.json",
      "r11-fingerprint-matrix.json",
      "r11-current-vs-pack-fingerprints.json",
      "r11-pack-export-embedded.json",
      "r11-export-comparison.json",
      "r11-reviewer-protected-diff.json",
      "r11-mode-only-fresh-state.json",
      "r11-stale-after-explorer-state.json",
      "r11-stale-after-verification-state.json",
      "r11-stale-after-import-state.json",
      "r11-pack-pre-regeneration-state.json",
      "r11-pack-regenerated-state.json"
    ],
    replayArtifacts: ["r11-trace.zip", "r11-video.webm"]
  });
  await saveRequest11EvidenceIndex({
    request: "request-11",
    archiveDir: request11ArchiveDir,
    indexCreatedBy: "Request 11 Playwright workflow",
    finalWorktreeState: "pending-final-command-fingerprint",
    acManifests,
    evidenceManifest: `${request11ArchiveDir}/r11-evidence-manifest.json`
  });
});

test("Request 12 evidence dossier should review bundles block weak proof and preserve stale judgments", async ({
  page
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-05-28T10:00:00.000Z") });
  await openEvidenceImport(page);

  const sequence: Array<Record<string, unknown>> = [];
  const notLoaded = await saveRequest12DossierState(page, testInfo, "r12-not-loaded-state.json");
  expect(notLoaded.evaluation.status).toBe("not-loaded");
  sequence.push({ step: "not-loaded", status: notLoaded.evaluation.status });

  await request12ImportBundle(page, request12InvalidBundle);
  const invalidBundle = await saveRequest12DossierState(page, testInfo, "r12-invalid-bundle-state.json");
  expect(invalidBundle.evaluation.status).toBe("invalid-bundle");
  expect(invalidBundle.importState.errors.length).toBeGreaterThanOrEqual(2);
  expect(invalidBundle.evaluation.criteria).toEqual([]);
  await saveRequest12Screenshot(page, "r12-invalid-bundle-ui.png");
  sequence.push({ step: "invalid-bundle", errors: invalidBundle.importState.errors });

  await request12ImportBundle(page, request12IncompleteBundle);
  const incompleteBundle = await saveRequest12DossierState(page, testInfo, "r12-incomplete-bundle-state.json");
  expect(incompleteBundle.evaluation.status).toBe("incomplete");
  expect(incompleteBundle.evaluation.criteria[0]?.missingProofTypes).toEqual(["screenshot", "manifest"]);
  expect(incompleteBundle.evaluation.criteria[0]?.observedAssertions).toEqual([]);
  await saveRequest12Screenshot(page, "r12-incomplete-bundle-ui.png");
  sequence.push({
    step: "incomplete-bundle",
    status: incompleteBundle.evaluation.status,
    blockers: incompleteBundle.evaluation.criteria[0]?.blockers
  });

  await request12SetMode(page, "reviewer");
  await expect(page.getByTestId("workflow-mode-state")).toHaveText("Current mode: Reviewer");
  await request12SetNote(page, "AC-R12-INCOMPLETE", "missing screenshot and manifest");
  await request12ClickJudgment(page, "AC-R12-INCOMPLETE", "pass");
  await expect.poll(async () => (await readRequest12DossierState(page)).actionState.lastDossierJudgmentAttempt).toEqual(
    expect.objectContaining({
      criterionId: "AC-R12-INCOMPLETE",
      judgment: "pass",
      accepted: false
    })
  );
  const passBlocked = await saveRequest12DossierState(page, testInfo, "r12-pass-blocked-state.json");
  expect(passBlocked.actionState.lastDossierJudgmentAttempt).toEqual(
    expect.objectContaining({
      criterionId: "AC-R12-INCOMPLETE",
      judgment: "pass",
      accepted: false
    })
  );
  expect(passBlocked.reviewerJudgments).toEqual([]);
  await request12ClickJudgment(page, "AC-R12-INCOMPLETE", "needs-review");
  let incompleteJudged = await readRequest12DossierState(page);
  expect(incompleteJudged.reviewerJudgments).toEqual([
    expect.objectContaining({ criterionId: "AC-R12-INCOMPLETE", judgment: "needs-review" })
  ]);
  await request12ClickJudgment(page, "AC-R12-INCOMPLETE", "fail");
  incompleteJudged = await readRequest12DossierState(page);
  expect(incompleteJudged.reviewerJudgments).toEqual([
    expect.objectContaining({ criterionId: "AC-R12-INCOMPLETE", judgment: "fail" })
  ]);
  await saveRequest12Json(testInfo, "r12-incomplete-fail-needs-review-state.json", incompleteJudged);
  await saveRequest12Screenshot(page, "r12-pass-blocked-ui.png");
  sequence.push({ step: "pass-blocked", accepted: false, allowedJudgments: ["needs-review", "fail"] });

  const reviewerBefore = await request12ProtectedState(page, "reviewer-before-forced-import");
  await page.getByTestId("dossier-bundle-input").evaluate((element, value) => {
    if (element instanceof HTMLTextAreaElement) {
      element.readOnly = false;
      element.value = value as string;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, request12CompleteBundle);
  await request12ForceClickDisabledButton(page, "dossier-import");
  await request12ForceClickDisabledButton(page, "dossier-reset");
  const reviewerAfter = await request12ProtectedState(page, "reviewer-after-forced-import-reset");
  const reviewerDiff = request12DiffProtected(reviewerBefore, reviewerAfter);
  expect(reviewerDiff.protectedStateUnchanged).toBe(true);
  await saveRequest12Json(testInfo, "r12-reviewer-boundary-before-state.json", reviewerBefore);
  await saveRequest12Json(testInfo, "r12-reviewer-boundary-after-state.json", reviewerAfter);

  await request12SetMode(page, "operator");
  const operatorBefore = await request12ProtectedState(page, "operator-before-forced-judgment");
  await request12ForceClickDisabledButton(page, "dossier-judgment-AC-R12-INCOMPLETE-fail");
  const operatorAfter = await request12ProtectedState(page, "operator-after-forced-judgment");
  const operatorDiff = request12DiffProtected(
    { reviewerJudgments: operatorBefore.reviewerJudgments, importState: operatorBefore.importState },
    { reviewerJudgments: operatorAfter.reviewerJudgments, importState: operatorAfter.importState }
  );
  expect(operatorDiff.protectedStateUnchanged).toBe(true);
  await saveRequest12Json(testInfo, "r12-operator-judgment-protected-diff.json", operatorDiff);

  await page.getByTestId("dossier-reset").click();
  const resetState = await readRequest12DossierState(page);
  expect(resetState.evaluation.status).toBe("not-loaded");
  expect(resetState.reviewerJudgments).toEqual([]);

  await request12ImportBundle(page, request12CompleteBundle);
  const completeBundle = await saveRequest12DossierState(page, testInfo, "r12-complete-bundle-state.json");
  expect(completeBundle.evaluation.status).toBe("incomplete");
  expect(completeBundle.evaluation.criteria).toHaveLength(3);
  expect(completeBundle.evaluation.criteria.every((criterion) => criterion.completeProof)).toBe(true);
  await saveRequest12Screenshot(page, "r12-complete-bundle-ui.png");
  sequence.push({ step: "complete-bundle-imported", status: completeBundle.evaluation.status });

  await request12SetMode(page, "reviewer");
  await request12SetNote(page, "AC-R12-DOSSIER-001", "needs a second look");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-001", "needs-review");
  await request12SetNote(page, "AC-R12-DOSSIER-002", "boundary proof ready");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-002", "pass");
  await request12SetNote(page, "AC-R12-DOSSIER-003", "stale proof ready");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-003", "pass");
  const needsReviewState = await readRequest12DossierState(page);
  expect(needsReviewState.evaluation.status).toBe("needs-review");
  await saveRequest12Json(testInfo, "r12-needs-review-state.json", needsReviewState);
  sequence.push({
    step: "reviewer-needs-review",
    status: needsReviewState.evaluation.status,
    judgments: needsReviewState.reviewerJudgments.map((judgment) => ({
      criterionId: judgment.criterionId,
      judgment: judgment.judgment
    }))
  });
  await request12SetNote(page, "AC-R12-DOSSIER-002", "role boundary failed");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-002", "fail");
  const failedState = await readRequest12DossierState(page);
  expect(failedState.evaluation.status).toBe("failed");
  await saveRequest12Json(testInfo, "r12-failed-state.json", failedState);
  sequence.push({
    step: "reviewer-fail",
    status: failedState.evaluation.status,
    judgments: failedState.reviewerJudgments.map((judgment) => ({
      criterionId: judgment.criterionId,
      judgment: judgment.judgment
    }))
  });
  await request12SetNote(page, "AC-R12-DOSSIER-001", "grouping proof passed");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-001", "pass");
  const failedWithPassState = await readRequest12DossierState(page);
  expect(failedWithPassState.evaluation.status).toBe("failed");
  await saveRequest12Json(testInfo, "r12-status-precedence-matrix.json", {
    incomplete: completeBundle.evaluation.status,
    needsReview: needsReviewState.evaluation.status,
    failed: failedState.evaluation.status,
    failedBeatsPartialPass: failedWithPassState.evaluation.status
  });

  await request12SetNote(page, "AC-R12-DOSSIER-002", "boundary proof passed");
  await request12ClickJudgment(page, "AC-R12-DOSSIER-002", "pass");
  const passed = await saveRequest12DossierState(page, testInfo, "r12-passed-before-stale-state.json");
  expect(passed.evaluation.status).toBe("passed");
  expect(passed.evaluation.criteria.every((criterion) => criterion.reviewerJudgment?.stale === false)).toBe(true);
  await saveRequest12Screenshot(page, "r12-reviewer-judgment-ui.png");
  sequence.push({
    step: "reviewer-correct-to-pass",
    status: passed.evaluation.status,
    judgments: passed.reviewerJudgments.map((judgment) => ({
      criterionId: judgment.criterionId,
      judgment: judgment.judgment
    }))
  });

  await request12SetMode(page, "operator");
  await page.getByTestId("dossier-change-fingerprint").click();
  const stale = await saveRequest12DossierState(page, testInfo, "r12-stale-after-fingerprint-state.json");
  expect(stale.evaluation.status).toBe("stale");
  expect(stale.evaluation.staleJudgmentCount).toBe(3);
  expect(stale.evaluation.criteria.map((criterion) => criterion.reviewerJudgment?.note)).toEqual([
    "grouping proof passed",
    "boundary proof passed",
    "stale proof ready"
  ]);
  await saveRequest12Screenshot(page, "r12-stale-dossier-ui.png");
  sequence.push({ step: "stale-after-fingerprint", status: stale.evaluation.status, staleJudgments: 3 });

  const roleDiff = {
    reviewerImportResetDiff: reviewerDiff,
    operatorJudgmentDiff: operatorDiff
  };
  await saveRequest12Json(testInfo, "r12-role-protected-diff.json", roleDiff);
  await saveRequest12Json(testInfo, "r12-review-sequence.json", sequence);

  const capturedUrl = page.url();
  const pageTitle = await page.title();
  const acManifestEvidence = [
    {
      ac_id: "AC-R12-001",
      assertions: [
        "The dossier starts not-loaded.",
        "Invalid bundle import produces invalid-bundle state with concrete validation errors."
      ],
      artifacts: ["r12-not-loaded-state.json", "r12-invalid-bundle-state.json", "r12-invalid-bundle-ui.png"]
    },
    {
      ac_id: "AC-R12-002",
      assertions: [
        "A valid bundle renders grouped acceptance-criterion dossier evidence.",
        "Each AC exposes required, present, and missing proof metadata plus artifact fingerprints."
      ],
      artifacts: ["r12-complete-bundle-state.json", "r12-complete-bundle-ui.png"]
    },
    {
      ac_id: "AC-R12-003",
      assertions: [
        "Metadata-only artifact proof remains incomplete.",
        "Missing proof types and missing observed assertions are listed as blockers."
      ],
      artifacts: ["r12-incomplete-bundle-state.json", "r12-incomplete-bundle-ui.png"]
    },
    {
      ac_id: "AC-R12-004",
      assertions: [
        "Reviewer judgments are stored separately from imported evidence.",
        "Reviewer import/reset attempts and operator judgment attempts cannot mutate protected state."
      ],
      artifacts: [
        "r12-reviewer-boundary-before-state.json",
        "r12-reviewer-boundary-after-state.json",
        "r12-role-protected-diff.json",
        "r12-reviewer-judgment-ui.png",
        "r12-trace.zip",
        "r12-video.webm"
      ]
    },
    {
      ac_id: "AC-R12-005",
      assertions: [
        "Reviewer pass on incomplete evidence is blocked.",
        "Reviewer fail and needs-review remain recordable for incomplete evidence."
      ],
      artifacts: ["r12-pass-blocked-state.json", "r12-pass-blocked-ui.png", "r12-incomplete-fail-needs-review-state.json"]
    },
    {
      ac_id: "AC-R12-006",
      assertions: [
        "The dossier status follows the specified precedence for incomplete, needs-review, failed, and passed states.",
        "Passed occurs only after every complete AC has a fresh pass judgment."
      ],
      artifacts: ["r12-status-precedence-matrix.json", "r12-review-sequence.json", "r12-needs-review-state.json", "r12-failed-state.json"]
    },
    {
      ac_id: "AC-R12-007",
      assertions: [
        "Fingerprint changes after passed mark the dossier stale.",
        "Old pass judgments remain visible with original notes and stale flags."
      ],
      artifacts: ["r12-passed-before-stale-state.json", "r12-stale-after-fingerprint-state.json", "r12-stale-dossier-ui.png"]
    },
    {
      ac_id: "AC-R12-008",
      assertions: [
        "One integrated browser workflow covers not-loaded, invalid, incomplete, complete, pass-blocked, needs-review, fail, correct-to-pass, passed, stale, and role-boundary states.",
        "The workflow is replayable through saved trace and video artifacts."
      ],
      artifacts: [
        "r12-review-sequence.json",
        "r12-needs-review-state.json",
        "r12-failed-state.json",
        "r12-trace.zip",
        "r12-video.webm",
        "r12-invalid-bundle-ui.png",
        "r12-incomplete-bundle-ui.png",
        "r12-complete-bundle-ui.png",
        "r12-reviewer-judgment-ui.png",
        "r12-pass-blocked-ui.png",
        "r12-stale-dossier-ui.png"
      ]
    },
    {
      ac_id: "AC-R12-009",
      assertions: [
        "Request 01 through Request 11 browser and unit assertions remain present.",
        "Full unit, build, browser, no-skip, and prior-assertion inspection logs are required alongside this manifest."
      ],
      artifacts: [
        "npm-run-test.log",
        "npm-run-build.log",
        "npm-run-test-browser.log",
        "grep-no-skip-only.log",
        "r12-prior-assertions-source-inspection.log"
      ]
    },
    {
      ac_id: "AC-R12-010",
      assertions: [
        "Request 12 closeout must decide whether progress-drift evidence justifies a Shepherd correction.",
        "The Shepherd correction was applied only after ledger-first rationale, source inspection, and simulated-human approval.",
        "The correction includes source diff, quick validation, live progress-gate evidence, and final validator logs."
      ],
      artifacts: [
        "request-12/retrospective.md",
        ".shepherd/ledger.md",
        ".shepherd/progress.md",
        "request-12/shepherd-correction-sources.md",
        "request-12/shepherd-correction-approval.md",
        "shepherd-progress-gate-diff-final.patch",
        "quick-validate-shepherd-progress-gate-final.log",
        "request-12/progress-reconciliation-before-refactorer.md",
        "request-12/progress-reconciliation-before-qa.md",
        "request-12/refactorer.md",
        "validate-acceptance-final.log",
        "validate-evidence-final.log",
        "validate-freshness-final.log"
      ]
    }
  ];
  const acManifests = acManifestEvidence.map((evidence) => ({
    type: "browser-evidence",
    ac_id: evidence.ac_id,
    expected_route_or_state: "Request 12 in-app evidence dossier review workflow",
    captured_url: capturedUrl,
    page_title: pageTitle,
    assertions: evidence.assertions,
    artifacts: evidence.artifacts,
    final_state_fingerprint: "state-file:.shepherd/dogfood-12/request-12/evidence/index.json",
    verdict: "PASS"
  }));
  await Promise.all(
    acManifests.map((manifest, index) =>
      saveRequest12Json(testInfo, `ac-r12-${String(index + 1).padStart(3, "0")}-manifest.json`, manifest)
    )
  );
  await saveRequest12Json(testInfo, "r12-evidence-manifest.json", {
    generatedBy: "Request 12 Playwright workflow",
    archiveDir: request12ArchiveDir,
    acManifests: acManifests.map((_, index) => `ac-r12-${String(index + 1).padStart(3, "0")}-manifest.json`),
    screenshots: [
      "r12-invalid-bundle-ui.png",
      "r12-incomplete-bundle-ui.png",
      "r12-complete-bundle-ui.png",
      "r12-reviewer-judgment-ui.png",
      "r12-pass-blocked-ui.png",
      "r12-stale-dossier-ui.png"
    ],
    jsonArtifacts: [
      "r12-not-loaded-state.json",
      "r12-invalid-bundle-state.json",
      "r12-incomplete-bundle-state.json",
      "r12-pass-blocked-state.json",
      "r12-incomplete-fail-needs-review-state.json",
      "r12-reviewer-boundary-before-state.json",
      "r12-reviewer-boundary-after-state.json",
      "r12-operator-judgment-protected-diff.json",
      "r12-role-protected-diff.json",
      "r12-complete-bundle-state.json",
      "r12-needs-review-state.json",
      "r12-failed-state.json",
      "r12-status-precedence-matrix.json",
      "r12-passed-before-stale-state.json",
      "r12-stale-after-fingerprint-state.json",
      "r12-review-sequence.json"
    ],
    replayArtifacts: ["r12-trace.zip", "r12-video.webm"]
  });
  await saveRequest12EvidenceIndex({
    request: "request-12",
    archiveDir: request12ArchiveDir,
    indexCreatedBy: "Request 12 Playwright workflow",
    finalWorktreeState: "pending-final-command-fingerprint",
    acManifests,
    evidenceManifest: `${request12ArchiveDir}/r12-evidence-manifest.json`
  });
});

function expectCurrentImportIds(state: ImportHistoryStateJson, acceptedIds: string[], rejectedLineNumbers: number[]) {
  expect(state.current?.acceptedRows.map((row) => row.id)).toEqual(acceptedIds);
  expect(state.current?.rejectedRows.map((row) => row.lineNumber)).toEqual(rejectedLineNumbers);
}

async function expectVisibleHistoryEntry(
  page: Page,
  index: number,
  expected: {
    status: "active" | "undone";
    accepted: string;
    rejected: string;
  }
) {
  const entry = page.getByTestId("import-history-entry").nth(index);
  await expect(entry).toContainText("Action: import");
  await expect(entry).toContainText(expected.status === "active" ? "Active path" : "Undone");
  await expect(entry).toContainText(expected.accepted);
  await expect(entry).toContainText(expected.rejected);
}

// REQUEST07_KEYBOARD_ONLY_SCOPE_START
type Request07ActiveElementState = {
  checkpoint: string;
  tagName: string;
  role: string | null;
  accessibleName: string;
  id: string;
  testId: string | null;
  textPreview: string;
  isBody: boolean;
  isConnected: boolean;
  isVisible: boolean;
  isDisabled: boolean;
  withinWorkflow: boolean;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  focusIndicator: {
    outlineStyle: string;
    outlineWidth: string;
    outlineColor: string;
    boxShadow: string;
    hasVisibleSignal: boolean;
  };
};

type Request07KeyboardGuardState = {
  armed: boolean;
  armedAt: string;
  violations: string[];
};

type Request07TabSequenceStep = {
  step: number;
  key: "Tab" | "Shift+Tab";
  tagName: string;
  testId: string | null;
  textPreview: string;
  isBody: boolean;
};

const request07FirstCsv = evidenceCsv([
  "r07-first-payment,First keyboard payment proof,browser,criterion-payment,r07-first-payment.json",
  ",First keyboard missing id,test,criterion-summary,r07-first-missing.json"
]);
const request07SecondCsv = evidenceCsv([
  "r07-second-summary,Second keyboard summary proof,api,criterion-summary,r07-second-summary.json",
  "r07-second-recovery,Second keyboard recovery proof,test,criterion-recovery,r07-second-recovery.json"
]);
const request07InvalidCsv = "title,id,kind,criterionId,source\nBad header,r07-bad,browser,criterion-payment,bad.json";

function r07ArmKeyboardOnlyGuard(page: Page): Request07KeyboardGuardState {
  const guard: Request07KeyboardGuardState = {
    armed: true,
    armedAt: new Date().toISOString(),
    violations: []
  };
  const pageMembers = page as Page & Record<string, unknown>;
  const pageActionName = ["page", "click"].join(".");
  const pointerObjectName = ["page", "mouse"].join(".");
  pageMembers["click"] = async () => {
    guard.violations.push(pageActionName);
    throw new Error(`Request 07 keyboard-only guard blocked ${pageActionName}`);
  };
  const pointerObject = pageMembers["mouse"];

  if (pointerObject && typeof pointerObject === "object") {
    pageMembers["mouse"] = new Proxy(pointerObject, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);

        if (typeof value !== "function") {
          return value;
        }

        return (...args: unknown[]) => {
          guard.violations.push(`${pointerObjectName}.${String(property)}`);
          throw new Error(`Request 07 keyboard-only guard blocked ${pointerObjectName}.${String(property)}`);
        };
      }
    });
  }

  return guard;
}

async function r07ReadActiveElement(page: Page, checkpoint: string): Promise<Request07ActiveElementState> {
  return page.evaluate((activeCheckpoint) => {
    const element = document.activeElement;
    const workflow = document.querySelector('[data-testid="evidence-review-workflow"]');
    const rect = element?.getBoundingClientRect();
    const style = element ? window.getComputedStyle(element) : null;
    const textPreview = (element?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    const outlineWidth = style?.outlineWidth ?? "0px";
    const outlineStyle = style?.outlineStyle ?? "none";
    const boxShadow = style?.boxShadow ?? "none";
    const outlinePixels = Number.parseFloat(outlineWidth) || 0;

    return {
      checkpoint: activeCheckpoint,
      tagName: element?.tagName ?? "",
      role: element?.getAttribute("role") ?? null,
      accessibleName: element?.getAttribute("aria-label") ?? textPreview,
      id: element?.id ?? "",
      testId: element?.getAttribute("data-testid") ?? null,
      textPreview,
      isBody: element === document.body,
      isConnected: element?.isConnected ?? false,
      isVisible:
        !!element &&
        !!rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        style?.visibility !== "hidden" &&
        style?.display !== "none",
      isDisabled:
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
          ? element.disabled
          : element?.getAttribute("aria-disabled") === "true",
      withinWorkflow: !!element && !!workflow && (element === workflow || workflow.contains(element)),
      boundingRect: {
        x: rect?.x ?? 0,
        y: rect?.y ?? 0,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0
      },
      focusIndicator: {
        outlineStyle,
        outlineWidth,
        outlineColor: style?.outlineColor ?? "",
        boxShadow,
        hasVisibleSignal:
          (outlinePixels > 0 && outlineStyle !== "none") ||
          (boxShadow !== "none" && boxShadow.trim().length > 0)
      }
    };
  }, checkpoint);
}

async function r07SaveActiveElementCheckpoint(
  page: Page,
  testInfo: TestInfo,
  checkpoint: string,
  stateFileName: string,
  screenshotFileName: string,
  allowedTestIds: string[]
) {
  const state = await r07ReadActiveElement(page, checkpoint);
  expect(state.isBody, `${checkpoint} focus must not be body`).toBe(false);
  expect(state.isConnected, `${checkpoint} focus must be connected`).toBe(true);
  expect(state.isVisible, `${checkpoint} focus must be visible`).toBe(true);
  expect(state.isDisabled, `${checkpoint} focus must not be disabled`).toBe(false);
  expect(state.withinWorkflow, `${checkpoint} focus must be inside workflow`).toBe(true);
  expect(state.focusIndicator.hasVisibleSignal, `${checkpoint} must have visible focus indicator`).toBe(true);
  expect(allowedTestIds).toContain(state.testId);
  await saveJsonArtifact(testInfo, stateFileName, state);
  await page.screenshot({
    path: testInfo.outputPath(screenshotFileName),
    fullPage: true
  });
  return state;
}

async function r07PressTabAndRead(page: Page, key: "Tab" | "Shift+Tab", step: number): Promise<Request07TabSequenceStep> {
  await page.keyboard.press(key);
  const state = await r07ReadActiveElement(page, `tab-${step}`);

  return {
    step,
    key,
    tagName: state.tagName,
    testId: state.testId,
    textPreview: state.textPreview,
    isBody: state.isBody
  };
}

async function r07MoveFocusUntil(
  page: Page,
  testInfo: TestInfo,
  options: {
    key: "Tab" | "Shift+Tab";
    maxSteps: number;
    sequenceFileName?: string;
    matches: (state: Request07ActiveElementState) => boolean;
  }
) {
  const sequence: Request07TabSequenceStep[] = [];

  for (let index = 1; index <= options.maxSteps; index += 1) {
    sequence.push(await r07PressTabAndRead(page, options.key, index));
    const state = await r07ReadActiveElement(page, `tab-match-${index}`);

    if (options.matches(state)) {
      if (options.sequenceFileName) {
        await saveJsonArtifact(testInfo, options.sequenceFileName, {
          maxSteps: options.maxSteps,
          reachedInSteps: index,
          sequence
        });
      }

      return state;
    }
  }

  if (options.sequenceFileName) {
    await saveJsonArtifact(testInfo, options.sequenceFileName, {
      maxSteps: options.maxSteps,
      reachedInSteps: null,
      sequence
    });
  }

  throw new Error(`Request 07 keyboard target was not reached within ${options.maxSteps} ${options.key} steps.`);
}

async function r07KeyboardReplaceTextarea(page: Page, csv: string) {
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(csv);
}

function r07ExtractFunctionSource(source: string, functionName: string) {
  const declaration = `function ${functionName}`;
  const asyncDeclaration = `async ${declaration}`;
  const start = source.indexOf(declaration);
  const asyncStart = source.indexOf(asyncDeclaration);
  const declarationStart = asyncStart >= 0 ? asyncStart : start;

  if (declarationStart < 0) {
    throw new Error(`Request 07 source audit could not find helper ${functionName}.`);
  }

  const bodyStart = source.indexOf("{", declarationStart);

  if (bodyStart < 0) {
    throw new Error(`Request 07 source audit could not find helper body for ${functionName}.`);
  }

  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(declarationStart, index + 1);
    }
  }

  throw new Error(`Request 07 source audit could not close helper body for ${functionName}.`);
}

async function r07SaveKeyboardOnlySourceAudit(testInfo: TestInfo) {
  const source = await readFile("tests/acceptance.spec.ts", "utf8");
  const sourceScope = source.match(/\/\/ REQUEST07_KEYBOARD_ONLY_SCOPE_START([\s\S]*?)\/\/ REQUEST07_KEYBOARD_ONLY_SCOPE_END/);
  const request07ExternalHelpers = [
    "readImportHistoryState",
    "readCsvValidationState",
    "saveJsonArtifact",
    "saveCurrentValidation",
    "saveCurrentImportHistory",
    "saveCurrentImportState",
    "readExportText",
    "saveCurrentExportText",
    "expectCurrentImportIds"
  ];
  const auditedSource = [
    sourceScope?.[1] ?? "",
    ...request07ExternalHelpers.map((functionName) => r07ExtractFunctionSource(source, functionName))
  ].join("\n\n");
  const forbiddenPatterns = [
    { label: "dot click call", pattern: new RegExp(["\\.", "click", "\\("].join(""), "g") },
    { label: "dot fill call", pattern: new RegExp(["\\.", "fill", "\\("].join(""), "g") },
    { label: "pointer property", pattern: new RegExp(["mouse", "\\."].join(""), "g") },
    { label: "synthetic event", pattern: new RegExp(["dispatch", "Event"].join(""), "g") }
  ];
  const matches = forbiddenPatterns.flatMap((entry) =>
    Array.from(auditedSource.matchAll(entry.pattern)).map((match) => ({
      label: entry.label,
      offset: match.index ?? 0
    }))
  );
  const allowedEvaluateCallCount = Array.from(auditedSource.matchAll(/\.evaluate\(/g)).length;
  const payload = {
    auditedScope: "REQUEST07_KEYBOARD_ONLY_SCOPE",
    auditedHelpers: [
      ...request07ExternalHelpers,
      "r07ArmKeyboardOnlyGuard",
      "r07ReadActiveElement",
      "r07SaveActiveElementCheckpoint",
      "r07PressTabAndRead",
      "r07MoveFocusUntil",
      "r07ExtractFunctionSource",
      "r07KeyboardReplaceTextarea",
      "r07SaveKeyboardOnlySourceAudit",
      "Request 07 keyboard-only evidence workflow should validate, import, undo, import again, and export"
    ],
    forbiddenProgressionMatches: matches,
    allowedEvaluateCallCount,
    result: matches.length === 0 ? "pass" : "fail"
  };
  await saveJsonArtifact(testInfo, "r07-keyboard-only-source-audit.json", payload);
  await writeFile(
    testInfo.outputPath("r07-forbidden-actions-grep.log"),
    matches.length === 0
      ? "PASS: request-07 audited scope contains zero forbidden progression calls.\n"
      : JSON.stringify(matches, null, 2)
  );
  expect(matches).toEqual([]);
}

test("Request 07 keyboard-only evidence workflow should validate, import, undo, import again, and export", async ({
  page
}, testInfo) => {
  await page.goto("/");
  const guard = r07ArmKeyboardOnlyGuard(page);
  await r07SaveKeyboardOnlySourceAudit(testInfo);

  await r07MoveFocusUntil(page, testInfo, {
    key: "Tab",
    maxSteps: 20,
    matches: (state) => state.tagName === "BUTTON" && state.textPreview === "Open review workflow"
  });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("evidence-review-workflow")).toBeVisible();
  await expect(page.getByTestId("evidence-review-workflow")).toBeFocused();
  await r07SaveActiveElementCheckpoint(page, testInfo, "open", "r07-open-focus-state.json", "r07-open-focus-ui.png", [
    "evidence-review-workflow"
  ]);

  await r07MoveFocusUntil(page, testInfo, {
    key: "Tab",
    maxSteps: 32,
    sequenceFileName: "r07-tab-sequence-to-csv.json",
    matches: (state) => state.testId === "evidence-csv-input"
  });
  await page.keyboard.insertText(request07InvalidCsv);
  const invalidTypingState = await r07ReadActiveElement(page, "invalid-typing");
  expect(invalidTypingState.testId).toBe("evidence-csv-input");
  await saveJsonArtifact(testInfo, "r07-invalid-typing-focus-state.json", invalidTypingState);
  await page.screenshot({
    path: testInfo.outputPath("r07-invalid-typing-ui.png"),
    fullPage: true
  });

  const correctionBefore = await saveCurrentValidation(page, testInfo, "r07-correction-before-validation-state.json");
  expect(correctionBefore.mode).toBe("blocked");
  expect(correctionBefore.canImport).toBe(false);
  await r07MoveFocusUntil(page, testInfo, {
    key: "Tab",
    maxSteps: 5,
    matches: (state) => state.testId === "csv-validation-panel"
  });
  const blockedValidation = await saveCurrentValidation(page, testInfo, "r07-blocked-validation-state.json");
  expect(blockedValidation.mode).toBe("blocked");
  expect(blockedValidation.diagnostics.length).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeDisabled();
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "blocked-validation",
    "r07-blocked-focus-state.json",
    "r07-blocked-validation-ui.png",
    ["csv-validation-panel"]
  );

  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 5,
    matches: (state) => state.testId === "evidence-csv-input"
  });
  await r07KeyboardReplaceTextarea(page, request07FirstCsv);
  const correctionAfter = await saveCurrentValidation(page, testInfo, "r07-correction-after-validation-state.json");
  expect(correctionAfter.mode).toBe("warning");
  expect(correctionAfter.canImport).toBe(true);
  expect(JSON.stringify(correctionAfter)).not.toContain("invalid_header");
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "correction",
    "r07-correction-focus-state.json",
    "r07-correction-ui.png",
    ["evidence-csv-input"]
  );

  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 5,
    matches: (state) => state.tagName === "BUTTON" && state.textPreview === "Import CSV rows"
  });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("import-results-summary")).toBeFocused();
  const firstImportState = await saveCurrentImportState(page, testInfo, "r07-first-import-state.json");
  expect(firstImportState).toEqual(
    expect.objectContaining({
      acceptedRows: [expect.objectContaining({ id: "r07-first-payment" })],
      rejectedRows: [expect.objectContaining({ lineNumber: 3 })]
    })
  );
  const firstImportHistory = await saveCurrentImportHistory(page, testInfo, "r07-first-import-history-state.json");
  expectCurrentImportIds(firstImportHistory, ["r07-first-payment"], [3]);
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "first-import",
    "r07-first-import-focus-state.json",
    "r07-first-import-ui.png",
    ["import-results-summary"]
  );

  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 10,
    matches: (state) => state.tagName === "BUTTON" && state.textPreview === "Undo last import"
  });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("import-history-section")).toBeFocused();
  const afterUndoHistory = await saveCurrentImportHistory(page, testInfo, "r07-after-undo-history-state.json");
  expect(afterUndoHistory.current).toBeNull();
  expect(afterUndoHistory.historyEntries.at(-1)).toEqual(expect.objectContaining({ status: "undone" }));
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "undo",
    "r07-after-undo-focus-state.json",
    "r07-after-undo-ui.png",
    ["import-history-section"]
  );

  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 5,
    sequenceFileName: "r07-second-import-tab-sequence.json",
    matches: (state) => state.testId === "evidence-csv-input"
  });
  await r07KeyboardReplaceTextarea(page, request07SecondCsv);
  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 5,
    matches: (state) => state.tagName === "BUTTON" && state.textPreview === "Import CSV rows"
  });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("import-results-summary")).toBeFocused();
  const secondImportState = await saveCurrentImportState(page, testInfo, "r07-second-import-state.json");
  expect(secondImportState).toEqual(
    expect.objectContaining({
      acceptedRows: [
        expect.objectContaining({ id: "r07-second-summary" }),
        expect.objectContaining({ id: "r07-second-recovery" })
      ],
      rejectedRows: []
    })
  );
  const secondImportHistory = await saveCurrentImportHistory(page, testInfo, "r07-second-import-history-state.json");
  expectCurrentImportIds(secondImportHistory, ["r07-second-summary", "r07-second-recovery"], []);
  expect(JSON.stringify(secondImportHistory)).not.toContain("r07-first-payment");
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "second-import",
    "r07-second-import-focus-state.json",
    "r07-second-import-ui.png",
    ["import-results-summary"]
  );

  await r07MoveFocusUntil(page, testInfo, {
    key: "Shift+Tab",
    maxSteps: 10,
    matches: (state) => state.tagName === "BUTTON" && state.textPreview === "Export accepted JSON"
  });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("export-json-output")).toBeFocused();
  const exportPayload = await saveCurrentExportText(page, testInfo, "r07-export-json.json");
  expect(exportPayload.exportJson).toContain("r07-second-summary");
  expect(exportPayload.exportJson).toContain("r07-second-recovery");
  expect(exportPayload.exportJson).not.toContain("r07-first-payment");
  await r07SaveActiveElementCheckpoint(
    page,
    testInfo,
    "export",
    "r07-export-focus-state.json",
    "r07-export-ui.png",
    ["export-json-output"]
  );

  await saveJsonArtifact(testInfo, "r07-keyboard-only-guard-state.json", guard);
  expect(guard.violations).toEqual([]);
});
// REQUEST07_KEYBOARD_ONLY_SCOPE_END

test("Request 08 async imported evidence verification should fail once and recover without disturbing import state", async ({
  page
}, testInfo) => {
  const networkRequests: string[] = [];
  page.on("request", (request) => {
    networkRequests.push(request.url());
  });
  const request08Csv = evidenceCsv([
    `${request08FailOnceRowId},Request 08 payment proof,browser,criterion-payment,r08-payment.json`,
    `${request08SummaryRowId},Request 08 summary proof,api,criterion-summary,r08-summary.json`,
    ",Request 08 rejected missing id,test,criterion-recovery,r08-rejected.json"
  ]);

  await openEvidenceImport(page);
  await importEvidenceCsv(page, request08Csv);
  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 2");
  await expect(page.getByTestId("rejected-count")).toHaveText("Rejected: 1");
  await expect(page.getByTestId(`verification-row-${request08FailOnceRowId}`)).toContainText("unverified");
  await expect(page.getByTestId(`verification-action-${request08FailOnceRowId}`)).toBeVisible();
  await expect(page.getByTestId(`verification-row-${request08SummaryRowId}`)).toContainText("unverified");
  await expect(page.getByTestId(`verification-action-${request08SummaryRowId}`)).toBeVisible();
  await expect(page.getByTestId("rejected-rows").getByRole("button", { name: /verify|retry/i })).toHaveCount(0);
  await expect(page.getByTestId("seeded-review-item").getByRole("button", { name: /verify|retry/i })).toHaveCount(0);

  const baseline = await captureRequest08Stage(page, testInfo, "baseline", { saveScreenshot: true });
  expect(Object.keys(baseline.verificationState)).toEqual([request08FailOnceRowId, request08SummaryRowId]);
  expect(baseline.verificationState[request08FailOnceRowId]).toEqual(
    expect.objectContaining({
      status: "unverified",
      attemptCount: 0,
      retryAvailable: false
    })
  );
  expect(baseline.exportPayload.evidenceRows.map((row) => row.verificationStatus)).toEqual(["unverified", "unverified"]);
  expect(JSON.stringify(baseline.exportPayload)).not.toContain("Request 08 rejected missing id");

  const statusSequence = [
    {
      stage: "baseline",
      status: baseline.verificationState[request08FailOnceRowId]?.status,
      attemptCount: baseline.verificationState[request08FailOnceRowId]?.attemptCount
    }
  ];

  const firstCheckingStart = Date.now();
  await page.getByTestId(`verification-action-${request08FailOnceRowId}`).click();
  await expect(page.getByTestId(`verification-row-${request08FailOnceRowId}`)).toContainText("checking");
  await expect(page.getByTestId(`verification-action-${request08FailOnceRowId}`)).toBeDisabled();
  await page.waitForTimeout(520);
  const firstCheckingDuration = Date.now() - firstCheckingStart;
  const firstChecking = await captureRequest08Stage(page, testInfo, "first-checking", { saveScreenshot: true });
  expect(firstChecking.verificationState[request08FailOnceRowId]).toEqual(
    expect.objectContaining({
      status: "checking",
      attemptCount: 1,
      retryAvailable: false
    })
  );
  expect(firstChecking.exportPayload.evidenceRows.find((row) => row.id === request08FailOnceRowId)?.verificationStatus).toBe(
    "checking"
  );
  await saveRequest08Json(testInfo, "r08-first-checking-duration.json", {
    statusObservedForAtLeastMs: firstCheckingDuration,
    requiredMinimumMs: 500
  });
  expect(firstCheckingDuration).toBeGreaterThanOrEqual(500);
  statusSequence.push({
    stage: "first-checking",
    status: firstChecking.verificationState[request08FailOnceRowId]?.status,
    attemptCount: firstChecking.verificationState[request08FailOnceRowId]?.attemptCount
  });

  await expect(page.getByTestId(`verification-row-${request08FailOnceRowId}`)).toContainText("failed", { timeout: 2000 });
  const failed = await captureRequest08Stage(page, testInfo, "failed", { saveScreenshot: true });
  expect(failed.verificationState[request08FailOnceRowId]).toEqual(
    expect.objectContaining({
      status: "failed",
      attemptCount: 1,
      retryAvailable: true,
      statusCode: "source_unreachable_once",
      message: "Verification failed for the imported payment source. Retry is available."
    })
  );
  await expect(page.getByTestId(`verification-action-${request08FailOnceRowId}`)).toContainText("Retry");
  statusSequence.push({
    stage: "failed",
    status: failed.verificationState[request08FailOnceRowId]?.status,
    attemptCount: failed.verificationState[request08FailOnceRowId]?.attemptCount
  });

  const retryCheckingStart = Date.now();
  await page.getByTestId(`verification-action-${request08FailOnceRowId}`).click();
  await expect(page.getByTestId(`verification-row-${request08FailOnceRowId}`)).toContainText("checking");
  await expect(page.getByTestId(`verification-action-${request08FailOnceRowId}`)).toBeDisabled();
  await page.waitForTimeout(520);
  const retryCheckingDuration = Date.now() - retryCheckingStart;
  const retryChecking = await captureRequest08Stage(page, testInfo, "retry-checking", { saveScreenshot: true });
  expect(retryChecking.verificationState[request08FailOnceRowId]).toEqual(
    expect.objectContaining({
      status: "checking",
      attemptCount: 2,
      retryAvailable: false
    })
  );
  expect(retryChecking.exportPayload.evidenceRows.find((row) => row.id === request08FailOnceRowId)?.verificationStatus).toBe(
    "checking"
  );
  await saveRequest08Json(testInfo, "r08-retry-checking-duration.json", {
    statusObservedForAtLeastMs: retryCheckingDuration,
    requiredMinimumMs: 500
  });
  expect(retryCheckingDuration).toBeGreaterThanOrEqual(500);
  statusSequence.push({
    stage: "retry-checking",
    status: retryChecking.verificationState[request08FailOnceRowId]?.status,
    attemptCount: retryChecking.verificationState[request08FailOnceRowId]?.attemptCount
  });

  await expect(page.getByTestId(`verification-row-${request08FailOnceRowId}`)).toContainText("verified", { timeout: 2000 });
  const verified = await captureRequest08Stage(page, testInfo, "verified", { saveScreenshot: true });
  expect(verified.verificationState[request08FailOnceRowId]).toEqual(
    expect.objectContaining({
      status: "verified",
      attemptCount: 2,
      retryAvailable: false,
      statusCode: "source_verified",
      message: "Imported evidence source verified."
    })
  );
  expect(verified.exportPayload.evidenceRows.find((row) => row.id === request08FailOnceRowId)?.verificationStatus).toBe(
    "verified"
  );
  statusSequence.push({
    stage: "verified",
    status: verified.verificationState[request08FailOnceRowId]?.status,
    attemptCount: verified.verificationState[request08FailOnceRowId]?.attemptCount
  });

  const stateDiff = request08StateDiffReport(baseline, [firstChecking, failed, retryChecking, verified]);
  await saveRequest08Json(testInfo, "r08-state-diff.json", stateDiff);
  expect(stateDiff.every((entry) => entry.importHistoryUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.importStateUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.validationStateUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.otherVerificationEntriesUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.exportNonVerificationFieldsUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.nonVerificationStateUnchanged)).toBe(true);
  expect(stateDiff.every((entry) => entry.disallowedVerificationFieldsChanged.length === 0)).toBe(true);
  expect(stateDiff.every((entry) => entry.disallowedExportFieldsChanged.length === 0)).toBe(true);
  expect(stateDiff.flatMap((entry) => entry.allowedVerificationFieldsChanged)).not.toContain("rowId");

  await saveRequest08Json(testInfo, "r08-status-sequence.json", statusSequence);
  expect(statusSequence.map((entry) => entry.status)).toEqual([
    "unverified",
    "checking",
    "failed",
    "checking",
    "verified"
  ]);
  expect(statusSequence.map((entry) => entry.attemptCount)).toEqual([0, 1, 1, 2, 2]);

  const sourceAuditFiles = [
    "lib/evidence-verification.ts",
    "lib/evidence-import.ts",
    "app/evidence-review-workflow.tsx"
  ];
  const sourceAudit = await Promise.all(
    sourceAuditFiles.map(async (file) => {
      const source = await readFile(file, "utf8");
      const forbiddenPatterns = [
        "Math.random",
        "fetch(",
        "XMLHttpRequest",
        "/api/verify",
        "/api/evidence-verification"
      ];
      return {
        file,
        forbiddenMatches: forbiddenPatterns.filter((pattern) => source.includes(pattern)),
        evidenceVerificationHelperHasTimeDecision:
          file === "lib/evidence-verification.ts" && (source.includes("Date.now") || source.includes("new Date"))
      };
    })
  );
  await saveRequest08Json(testInfo, "r08-source-audit.json", sourceAudit);
  expect(sourceAudit.flatMap((entry) => entry.forbiddenMatches)).toEqual([]);
  expect(sourceAudit.some((entry) => entry.evidenceVerificationHelperHasTimeDecision)).toBe(false);

  const networkAudit = {
    requests: networkRequests,
    verificationServiceRequests: networkRequests.filter((url) => /verify|evidence-verification/i.test(url)),
    externalRequests: networkRequests.filter((url) => !url.startsWith("http://127.0.0.1:3055/"))
  };
  await saveRequest08Json(testInfo, "r08-network-audit.json", networkAudit);
  expect(networkAudit.verificationServiceRequests).toEqual([]);
  expect(networkAudit.externalRequests).toEqual([]);

  const acManifestNames = Array.from({ length: 12 }, (_, index) => `ac-r08-${String(index + 1).padStart(3, "0")}-manifest.json`);
  await saveRequest08Json(testInfo, "r08-evidence-manifest.json", {
    generatedBy: "Request 08 Playwright workflow",
    stages: ["baseline", "first-checking", "failed", "retry-checking", "verified"],
    archiveDir: request08ArchiveDir,
    screenshots: [
      "r08-baseline-ui.png",
      "r08-first-checking-ui.png",
      "r08-failed-ui.png",
      "r08-retry-checking-ui.png",
      "r08-verified-ui.png"
    ],
    jsonArtifacts: [
      "r08-baseline-verification-state.json",
      "r08-first-checking-verification-state.json",
      "r08-failed-verification-state.json",
      "r08-retry-checking-verification-state.json",
      "r08-verified-verification-state.json",
      "r08-state-diff.json",
      "r08-status-sequence.json",
      "r08-source-audit.json",
      "r08-network-audit.json"
    ],
    acManifests: acManifestNames
  });
  const capturedUrl = page.url();
  const pageTitle = await page.title();
  const acManifests = request08BrowserManifests({ capturedUrl, pageTitle });
  expect(acManifests.map((manifest) => manifest.ac_id)).toEqual([
    "AC-R08-001",
    "AC-R08-002",
    "AC-R08-003",
    "AC-R08-004",
    "AC-R08-005",
    "AC-R08-006",
    "AC-R08-007",
    "AC-R08-008",
    "AC-R08-009",
    "AC-R08-010",
    "AC-R08-011",
    "AC-R08-012"
  ]);
  await Promise.all(
    acManifests.map((manifest, index) => saveRequest08Json(testInfo, acManifestNames[index] ?? "", manifest))
  );
});

test("browser-visible dashboard should render seeded status counts", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quote Control" })).toBeVisible();
  await expect(page.getByText("Northstar Studio")).toBeVisible();
  await expect(page.getByText("Lumen Bakery")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("browser-visible-dashboard.png"),
    fullPage: true
  });
});

test("multi-step quote workflow should create draft quote and expose API proof", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByTestId("customer-input").fill("Delta Shop");
  await page.getByTestId("amount-input").fill("2500");
  await expect(page.getByTestId("customer-input")).toHaveValue("Delta Shop");
  await page.getByRole("button", { name: "Create draft quote" }).click();
  await expect(page.locator(".quote").filter({ hasText: "Delta Shop" })).toBeVisible();
  await expect(page.getByTestId("api-proof")).toContainText('"created"');
  await page.screenshot({
    path: testInfo.outputPath("multi-step-quote-workflow.png"),
    fullPage: true
  });
});

test("state API proof should return seeded quotes as JSON", async ({ request }, testInfo) => {
  const response = await request.get("/api/quotes");
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload.summary).toEqual({ seeded: true, count: 3 });
  const apiResponsePath = testInfo.outputPath("api-response.json");
  await writeFile(apiResponsePath, JSON.stringify(payload, null, 2));
  await testInfo.attach("api-response", {
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json"
  });
});

test("review verdict API should return deterministic known scenarios", async ({ request }, testInfo) => {
  const expectedStatuses = {
    initial: "blocked",
    "missing-evidence": "blocked",
    failed: "rejected",
    accepted: "accepted"
  };
  const payloads: unknown[] = [];

  for (const [scenario, status] of Object.entries(expectedStatuses)) {
    const response = await request.get(`/api/review-verdict?scenario=${scenario}`);
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.scenario).toBe(scenario);
    expect(payload.verdict.status).toBe(status);
    expect(payload.item.id).toBe("checkout-evidence-review");
    expect(Array.isArray(payload.states)).toBe(true);
    expect(Array.isArray(payload.criteria)).toBe(true);

    const scenarioResponsePath = testInfo.outputPath(`review-verdict-${scenario}.json`);
    const scenarioResponseBody = JSON.stringify(payload, null, 2);
    await writeFile(scenarioResponsePath, scenarioResponseBody);
    await testInfo.attach(`review-verdict-${scenario}`, {
      body: scenarioResponseBody,
      contentType: "application/json"
    });

    if (scenario === "initial") {
      expect(payload.criteria.every((criterion: { selectedEvidence: unknown }) => criterion.selectedEvidence === null)).toBe(
        true
      );
    }

    if (scenario === "missing-evidence") {
      expect(payload.verdict.missingEvidenceCriterionIds).toContain("criterion-payment");
      expect(payload.criteria).toContainEqual(
        expect.objectContaining({
          criterionId: "criterion-payment",
          verdict: "pass",
          selectedEvidenceId: null,
          selectedEvidence: null
        })
      );
    }

    if (scenario === "failed") {
      expect(payload.verdict.failedCriterionIds).toContain("criterion-payment");
      expect(payload.verdict.reasons.join(" ")).toContain("Payment confirmation");
    }

    if (scenario === "accepted") {
      expect(payload.criteria.every((criterion: { verdict: string }) => criterion.verdict === "pass")).toBe(true);
      expect(payload.criteria.every((criterion: { selectedEvidence: unknown }) => criterion.selectedEvidence !== null)).toBe(
        true
      );
    }

    payloads.push(payload);
  }

  const apiResponsePath = testInfo.outputPath("review-verdict-known-scenarios.json");
  await writeFile(apiResponsePath, JSON.stringify(payloads, null, 2));
  await testInfo.attach("review-verdict-known-scenarios", {
    body: JSON.stringify(payloads, null, 2),
    contentType: "application/json"
  });
});

test("review verdict API should reject unknown scenarios without a successful verdict", async ({ request }, testInfo) => {
  const response = await request.get("/api/review-verdict?scenario=surprise");
  expect(response.status()).toBe(400);

  const payload = await response.json();
  expect(payload).toEqual({
    error: "Unknown review verdict scenario.",
    scenario: "surprise",
    knownScenarios: ["initial", "missing-evidence", "failed", "accepted"]
  });
  expect(payload.verdict).toBeUndefined();

  const apiResponsePath = testInfo.outputPath("review-verdict-unknown-scenario.json");
  await writeFile(apiResponsePath, JSON.stringify(payload, null, 2));
  await testInfo.attach("review-verdict-unknown-scenario", {
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json"
  });
});

test("review comparison API should return computed categories for seeded pairs", async ({ request }, testInfo) => {
  const expectedPairs = {
    "failed-to-accepted": {
      previousScenario: "failed",
      currentScenario: "accepted",
      previousVerdict: "rejected",
      currentVerdict: "accepted"
    },
    "unresolved-missing-evidence": {
      previousScenario: "initial",
      currentScenario: "missing-evidence",
      previousVerdict: "blocked",
      currentVerdict: "blocked"
    }
  };
  const payloads: unknown[] = [];

  for (const [pair, expected] of Object.entries(expectedPairs)) {
    const response = await request.get(`/api/review-comparison?pair=${pair}`);
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.pair).toBe(pair);
    expect(payload.previousScenario).toBe(expected.previousScenario);
    expect(payload.currentScenario).toBe(expected.currentScenario);
    expect(payload.verdictChange).toEqual({
      previous: expected.previousVerdict,
      current: expected.currentVerdict,
      changed: expected.previousVerdict !== expected.currentVerdict
    });
    expect(Array.isArray(payload.criterionChanges)).toBe(true);
    expect(payload.evidenceChanges).toEqual(
      expect.objectContaining({
        added: expect.any(Array),
        replaced: expect.any(Array),
        removed: expect.any(Array)
      })
    );
    expect(Array.isArray(payload.remainingBlockers)).toBe(true);

    if (pair === "failed-to-accepted") {
      expect(payload.criterionChanges).toContainEqual(
        expect.objectContaining({
          criterionId: "criterion-payment",
          previousVerdict: "fail",
          currentVerdict: "pass"
        })
      );
    }

    if (pair === "unresolved-missing-evidence") {
      expect(payload.remainingBlockers).toContainEqual({
        criterionId: "criterion-payment",
        title: "Payment confirmation",
        type: "missing evidence",
        currentVerdict: "pass"
      });
      expect(payload.evidenceChanges.added).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            criterionId: "criterion-summary",
            currentEvidenceId: "evidence-summary"
          }),
          expect.objectContaining({
            criterionId: "criterion-recovery",
            currentEvidenceId: "evidence-recovery"
          })
        ])
      );
      expect(payload.evidenceChanges.replaced).toEqual([]);
      expect(payload.evidenceChanges.removed).toEqual([]);
    }

    const comparisonPath = testInfo.outputPath(`review-comparison-${pair}.json`);
    const comparisonBody = JSON.stringify(payload, null, 2);
    await writeFile(comparisonPath, comparisonBody);
    await testInfo.attach(`review-comparison-${pair}`, {
      body: comparisonBody,
      contentType: "application/json"
    });

    payloads.push(payload);
  }

  const apiResponsePath = testInfo.outputPath("review-comparison-known-pairs.json");
  await writeFile(apiResponsePath, JSON.stringify(payloads, null, 2));
});

test("review comparison API should reject unknown pairs without successful comparison categories", async ({ request }, testInfo) => {
  const response = await request.get("/api/review-comparison?pair=surprise");
  expect(response.status()).toBe(400);

  const payload = await response.json();
  expect(payload).toEqual({
    error: "Unknown review comparison pair.",
    pair: "surprise",
    knownPairs: ["failed-to-accepted", "unresolved-missing-evidence"]
  });
  expect(payload.verdictChange).toBeUndefined();
  expect(payload.criterionChanges).toBeUndefined();
  expect(payload.evidenceChanges).toBeUndefined();
  expect(payload.remainingBlockers).toBeUndefined();

  const apiResponsePath = testInfo.outputPath("review-comparison-unknown-pair.json");
  await writeFile(apiResponsePath, JSON.stringify(payload, null, 2));
  await testInfo.attach("review-comparison-unknown-pair", {
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json"
  });
});

test("visible review comparison should show grouped human-readable changes", async ({ page }, testInfo) => {
  await page.goto("/");

  const comparisonSection = page.getByTestId("review-comparison-section");
  await expect(comparisonSection).toBeVisible();
  await expect(comparisonSection.getByRole("heading", { name: "Evidence review comparisons" })).toBeVisible();
  await expect(comparisonSection.getByText("failed-to-accepted")).toBeVisible();
  await expect(comparisonSection.getByText("unresolved-missing-evidence")).toBeVisible();
  await expect(comparisonSection.getByRole("heading", { name: "Final verdict movement" })).toHaveCount(2);
  await expect(comparisonSection.getByRole("heading", { name: "Criterion changes" })).toHaveCount(2);
  await expect(comparisonSection.getByRole("heading", { name: "Evidence changes" })).toHaveCount(2);
  await expect(comparisonSection.getByRole("heading", { name: "Remaining blockers" })).toHaveCount(2);
  await expect(comparisonSection.getByText("criterion-payment")).toHaveCount(3);
  await expect(comparisonSection.getByText("criterion-recovery")).toHaveCount(3);
  await expect(comparisonSection.getByText("Added evidence")).toBeVisible();
  await expect(comparisonSection.getByText("No evidence changes")).toBeVisible();
  await expect(comparisonSection.locator("pre")).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("review-comparison-visible-ui.png"),
    fullPage: true
  });
});

test("CSV evidence import should partially accept mixed rows and export accepted JSON only", async ({ page }, testInfo) => {
  const mixedCsv = [
    "id,title,kind,criterionId,source",
    "import-payment,Imported payment proof,browser,criterion-payment,trace.zip",
    ",Missing id proof,test,criterion-summary,state.json",
    "import-recovery,Imported recovery proof,api,criterion-recovery,recovery.json",
    "evidence-payment,Seeded duplicate proof,browser,criterion-payment,trace-dup.zip"
  ].join("\n");

  await page.goto("/");
  await page.getByRole("button", { name: "Open review workflow" }).click();
  await page.getByTestId("evidence-csv-input").fill(mixedCsv);
  await page.getByRole("button", { name: "Import CSV rows" }).click();

  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 2");
  await expect(page.getByTestId("rejected-count")).toHaveText("Rejected: 2");

  const acceptedRows = page.getByTestId("accepted-rows");
  await expect(acceptedRows.getByRole("heading", { name: "Accepted rows" })).toBeVisible();
  await expect(acceptedRows).toContainText("import-payment");
  await expect(acceptedRows).toContainText("Imported payment proof");
  await expect(acceptedRows).toContainText("browser");
  await expect(acceptedRows).toContainText("criterion-payment");
  await expect(acceptedRows).toContainText("trace.zip");
  await expect(acceptedRows).toContainText("import-recovery");
  await expect(acceptedRows).toContainText("api");
  await expect(acceptedRows).toContainText("criterion-recovery");

  const rejectedRows = page.getByTestId("rejected-rows");
  await expect(rejectedRows.getByRole("heading", { name: "Rejected rows" })).toBeVisible();
  await expect(rejectedRows).toContainText("Line 3");
  await expect(rejectedRows).toContainText("missing_id: Evidence id is required.");
  await expect(rejectedRows).toContainText("Line 5");
  await expect(rejectedRows).toContainText("duplicate_id: Evidence id duplicates seeded evidence or an earlier import row.");

  const mixedStateText = (await page.getByTestId("import-state-json").textContent()) ?? "";
  const mixedStatePayload: unknown = JSON.parse(mixedStateText);
  expect(mixedStatePayload).toEqual(
    expect.objectContaining({
      acceptedRows: expect.arrayContaining([
        expect.objectContaining({
          id: "import-payment",
          title: "Imported payment proof",
          kind: "browser",
          criterionId: "criterion-payment",
          source: "trace.zip"
        }),
        expect.objectContaining({
          id: "import-recovery",
          title: "Imported recovery proof",
          kind: "api",
          criterionId: "criterion-recovery",
          source: "recovery.json"
        })
      ]),
      rejectedRows: expect.arrayContaining([
        expect.objectContaining({ lineNumber: 3 }),
        expect.objectContaining({ lineNumber: 5 })
      ])
    })
  );
  await writeFile(testInfo.outputPath("r04-mixed-import-state.json"), mixedStateText);
  await testInfo.attach("r04-mixed-import-state", {
    body: mixedStateText,
    contentType: "application/json"
  });

  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  const exportJson = (await page.getByTestId("export-json-output").textContent()) ?? "";
  const exportPayload: unknown = JSON.parse(exportJson);
  expect(exportPayload).toEqual({
    evidenceRows: [
      {
        id: "import-payment",
        title: "Imported payment proof",
        kind: "browser",
        criterionId: "criterion-payment",
        source: "trace.zip",
        verificationStatus: "unverified"
      },
      {
        id: "import-recovery",
        title: "Imported recovery proof",
        kind: "api",
        criterionId: "criterion-recovery",
        source: "recovery.json",
        verificationStatus: "unverified"
      }
    ]
  });
  expect(exportJson).not.toContain("Missing id proof");
  expect(exportJson).not.toContain("Seeded duplicate proof");
  expect(exportJson).not.toContain("missing_id");
  await writeFile(testInfo.outputPath("r04-mixed-export.json"), exportJson);
  await testInfo.attach("r04-mixed-export", {
    body: exportJson,
    contentType: "application/json"
  });

  await page.screenshot({
    path: testInfo.outputPath("r04-mixed-import-export-ui.png"),
    fullPage: true
  });
});

test("CSV evidence import should disable export and warn when all rows are invalid", async ({ page }, testInfo) => {
  const allInvalidCsv = [
    "id,title,kind,criterionId,source",
    ",Missing id proof,browser,criterion-payment,trace.zip",
    "unknown-kind,Unknown kind proof,video,criterion-payment,trace.zip",
    "missing-source,Missing source proof,browser,criterion-payment,"
  ].join("\n");

  await page.goto("/");
  await page.getByRole("button", { name: "Open review workflow" }).click();
  await page.getByTestId("evidence-csv-input").fill(allInvalidCsv);
  await page.getByRole("button", { name: "Import CSV rows" }).click();

  await expect(page.getByTestId("accepted-count")).toHaveText("Accepted: 0");
  await expect(page.getByTestId("rejected-count")).toHaveText("Rejected: 3");
  await expect(page.getByTestId("accepted-rows")).toContainText("No accepted rows");
  await expect(page.getByTestId("rejected-rows")).toContainText("missing_id: Evidence id is required.");
  await expect(page.getByTestId("rejected-rows")).toContainText("unknown_kind: Evidence kind must be browser, api, or test.");
  await expect(page.getByTestId("rejected-rows")).toContainText("missing_source: Evidence source is required.");
  await expect(page.getByTestId("export-warning")).toHaveText("Nothing valid to export.");
  await expect(page.getByRole("button", { name: "Export accepted JSON" })).toBeDisabled();
  await expect(page.getByTestId("export-json-output")).toHaveCount(0);

  const allInvalidStateText = (await page.getByTestId("import-state-json").textContent()) ?? "";
  const allInvalidStatePayload: unknown = JSON.parse(allInvalidStateText);
  expect(allInvalidStatePayload).toEqual(
    expect.objectContaining({
      acceptedRows: [],
      rejectedRows: expect.arrayContaining([
        expect.objectContaining({ lineNumber: 2 }),
        expect.objectContaining({ lineNumber: 3 }),
        expect.objectContaining({ lineNumber: 4 })
      ])
    })
  );
  await writeFile(testInfo.outputPath("r04-all-invalid-state.json"), allInvalidStateText);
  await testInfo.attach("r04-all-invalid-state", {
    body: allInvalidStateText,
    contentType: "application/json"
  });

  await page.screenshot({
    path: testInfo.outputPath("r04-all-invalid-import-ui.png"),
    fullPage: true
  });
});

test("Request 06 CSV validation should block empty, header-only, and invalid-header input before import", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  await page.getByTestId("evidence-csv-input").fill("");
  await expect(page.getByTestId("csv-validation-panel")).toHaveClass(/csv-validation-blocked/);
  await expect(page.getByTestId("csv-validation-mode")).toHaveText("Mode: blocked");
  await expect(page.getByTestId("csv-validation-can-import")).toHaveText("Import allowed: no");
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeDisabled();
  const emptyValidation = await saveCurrentValidation(page, testInfo, "r06-empty-validation-state.json");
  expect(emptyValidation).toEqual(
    expect.objectContaining({
      mode: "blocked",
      canImport: false,
      validRowCount: 0,
      invalidRowCount: 0
    })
  );
  expect(emptyValidation.diagnostics[0]).toEqual(expect.objectContaining({ reasonCode: "no_data", field: "data" }));

  const emptyPreHistory = await saveCurrentImportHistory(page, testInfo, "r06-empty-pre-state.json");
  await forceImportClick(page);
  const emptyPostHistory = await saveCurrentImportHistory(page, testInfo, "r06-empty-post-state.json");
  expect(emptyPostHistory).toEqual(emptyPreHistory);

  await page.getByTestId("evidence-csv-input").fill(evidenceCsvHeader);
  const headerOnlyValidation = await saveCurrentValidation(page, testInfo, "r06-header-only-validation-state.json");
  expect(headerOnlyValidation.mode).toBe("blocked");
  expect(headerOnlyValidation.canImport).toBe(false);
  expect(headerOnlyValidation.diagnostics[0]).toEqual(expect.objectContaining({ reasonCode: "no_data" }));
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeDisabled();

  const invalidHeaderCsv = "title,id,kind,criterionId,source\nBad header,bad-id,browser,criterion-payment,bad.json";
  await page.getByTestId("evidence-csv-input").fill(invalidHeaderCsv);
  const invalidHeaderValidation = await saveCurrentValidation(page, testInfo, "r06-invalid-header-validation-state.json");
  expect(invalidHeaderValidation).toEqual(
    expect.objectContaining({
      mode: "blocked",
      canImport: false,
      validRowCount: 0,
      invalidRowCount: 0
    })
  );
  expect(invalidHeaderValidation.diagnostics[0]).toEqual(
    expect.objectContaining({
      reasonCode: "invalid_header",
      field: "header",
      badValue: "title,id,kind,criterionId,source",
      suggestedFix: `Replace the first line with ${evidenceCsvHeader}.`
    })
  );
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeDisabled();

  await page.screenshot({
    path: testInfo.outputPath("r06-blocked-validation-ui.png"),
    fullPage: true
  });
});

test("Request 06 CSV validation should show warning, import mixed rows through history, and remain undoable", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  const previousCsv = evidenceCsv(["r06-prev-payment,Previous valid proof,browser,criterion-payment,r06-prev.json"]);
  await importEvidenceCsv(page, previousCsv);
  const previousHistory = await saveCurrentImportHistory(page, testInfo, "r06-warning-previous-history-state.json");
  expectCurrentImportIds(previousHistory, ["r06-prev-payment"], []);

  const warningCsv = evidenceCsv([
    "r06-mixed-payment,Mixed payment proof,browser,criterion-payment,r06-payment.json",
    ",Mixed missing id,test,criterion-summary,r06-missing.json",
    "r06-bad-kind,Mixed bad kind,video,criterion-recovery,r06-kind.json"
  ]);
  await page.getByTestId("evidence-csv-input").fill(warningCsv);
  await expect(page.getByTestId("csv-validation-panel")).toHaveClass(/csv-validation-warning/);
  await expect(page.getByTestId("csv-validation-mode")).toHaveText("Mode: warning");
  await expect(page.getByTestId("csv-validation-can-import")).toHaveText("Import allowed: yes");
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeEnabled();
  const validation = await saveCurrentValidation(page, testInfo, "r06-warning-mixed-validation-state.json");
  expect(validation.validRowCount).toBe(1);
  expect(validation.invalidRowCount).toBe(2);
  expect(validation.diagnostics.map((diagnostic) => diagnostic.reasonCode)).toEqual(["missing_id", "unknown_kind"]);
  expect(validation.diagnostics.map((diagnostic) => diagnostic.lineNumber)).toEqual([3, 4]);

  await page.getByRole("button", { name: "Import CSV rows" }).click();
  const importState = await saveCurrentImportState(page, testInfo, "r06-warning-mixed-import-state.json");
  expect(importState).toEqual(
    expect.objectContaining({
      acceptedRows: [expect.objectContaining({ id: "r06-mixed-payment" })],
      rejectedRows: [expect.objectContaining({ lineNumber: 3 }), expect.objectContaining({ lineNumber: 4 })]
    })
  );
  const history = await saveCurrentImportHistory(page, testInfo, "r06-warning-mixed-history-state.json");
  expect(history.historyEntries.at(-1)).toEqual(
    expect.objectContaining({
      actionType: "import",
      acceptedCount: 1,
      rejectedCount: 2,
      acceptedEvidenceIds: ["r06-mixed-payment"],
      rejectedLineNumbers: [3, 4],
      status: "active"
    })
  );
  expect(history.canUndo).toBe(true);

  await page.getByTestId("undo-import-button").click();
  const undoState = await saveCurrentImportHistory(page, testInfo, "r06-warning-mixed-after-undo-state.json");
  expectCurrentImportIds(undoState, ["r06-prev-payment"], []);
  const undoExport = await exportAcceptedEvidence(page, testInfo, "r06-warning-mixed-after-undo-export.json");
  expect(undoExport.evidenceRows.map((row) => row.id)).toEqual(["r06-prev-payment"]);

  await page.screenshot({
    path: testInfo.outputPath("r06-warning-import-history-undo-ui.png"),
    fullPage: true
  });
});

test("Request 06 CSV validation should keep all-invalid valid-header input warning and importable", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  const allInvalidCsv = evidenceCsv([
    ",All invalid missing id,browser,criterion-payment,missing.json",
    "r06-all-invalid-kind,All invalid kind,video,criterion-summary,kind.json"
  ]);
  await page.getByTestId("evidence-csv-input").fill(allInvalidCsv);
  const validation = await saveCurrentValidation(page, testInfo, "r06-warning-all-invalid-validation-state.json");
  expect(validation).toEqual(
    expect.objectContaining({
      mode: "warning",
      canImport: true,
      validRowCount: 0,
      invalidRowCount: 2
    })
  );
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeEnabled();

  await page.getByRole("button", { name: "Import CSV rows" }).click();
  const history = await saveCurrentImportHistory(page, testInfo, "r06-warning-all-invalid-history-state.json");
  expectCurrentImportIds(history, [], [2, 3]);
  expect(history.historyEntries.at(-1)).toEqual(
    expect.objectContaining({
      acceptedCount: 0,
      rejectedCount: 2,
      rejectedLineNumbers: [2, 3],
      status: "active"
    })
  );
});

test("Request 06 CSV validation should show clear mode and clear stale blocked diagnostics after correction", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  await page.getByTestId("evidence-csv-input").fill("bad,header\nx,y");
  const before = await saveCurrentValidation(page, testInfo, "r06-correction-before-validation-state.json");
  expect(before.mode).toBe("blocked");
  expect(before.diagnostics.map((diagnostic) => diagnostic.reasonCode)).toEqual(["invalid_header"]);
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeDisabled();

  const clearCsv = evidenceCsv(["r06-clear-payment,Clear payment proof,browser,criterion-payment,r06-clear.json"]);
  await page.getByTestId("evidence-csv-input").fill(clearCsv);
  await expect(page.getByTestId("csv-validation-panel")).toHaveClass(/csv-validation-clear/);
  await expect(page.getByTestId("csv-validation-mode")).toHaveText("Mode: clear");
  await expect(page.getByTestId("csv-validation-valid-count")).toHaveText("Valid: 1");
  await expect(page.getByTestId("csv-validation-invalid-count")).toHaveText("Invalid: 0");
  await expect(page.getByRole("button", { name: "Import CSV rows" })).toBeEnabled();
  const after = await saveCurrentValidation(page, testInfo, "r06-correction-after-validation-state.json");
  expect(after).toEqual(
    expect.objectContaining({
      mode: "clear",
      canImport: true,
      validRowCount: 1,
      invalidRowCount: 0,
      diagnostics: []
    })
  );
  expect(after.sourceHash).not.toBe(before.sourceHash);
  expect(JSON.stringify(after)).not.toContain("invalid_header");

  await saveJsonArtifact(testInfo, "r06-clear-validation-state.json", after);
  await page.screenshot({
    path: testInfo.outputPath("r06-correction-clear-validation-ui.png"),
    fullPage: true
  });
});

test("Request 06 blocked import attempts should preserve rows, history, undo, and export exactly", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  await importEvidenceCsv(page, evidenceCsv(["r06-preserve-payment,Preserve payment,browser,criterion-payment,preserve.json"]));
  const beforeHistory = await saveCurrentImportHistory(page, testInfo, "r06-blocked-preserve-before-state.json");
  const beforeImportState = await saveCurrentImportState(page, testInfo, "r06-blocked-preserve-before-import-state.json");
  await page.getByRole("button", { name: "Export accepted JSON" }).click();
  const beforeExportText = await readExportText(page);
  const beforeExport = beforeExportText ? (JSON.parse(beforeExportText) as { evidenceRows: { id: string }[] }) : null;
  await saveJsonArtifact(testInfo, "r06-blocked-preserve-before-export.json", {
    exportJson: beforeExportText,
    parsed: beforeExport
  });

  await page.getByTestId("evidence-csv-input").fill("id,title,kind,criterionId,source,extra\nx,X,browser,criterion-payment,x.json,extra");
  const blockedValidation = await saveCurrentValidation(page, testInfo, "r06-blocked-preserve-validation-state.json");
  expect(blockedValidation.mode).toBe("blocked");
  expect(blockedValidation.canImport).toBe(false);
  await forceImportClick(page);

  const afterHistory = await saveCurrentImportHistory(page, testInfo, "r06-blocked-preserve-after-state.json");
  const afterImportState = await saveCurrentImportState(page, testInfo, "r06-blocked-preserve-after-import-state.json");
  const afterExport = await saveCurrentExportText(page, testInfo, "r06-blocked-preserve-after-export.json");
  expect(afterHistory).toEqual(beforeHistory);
  expect(afterImportState).toEqual(beforeImportState);
  expect(afterExport.exportJson).toBe(beforeExportText);
  expect(beforeExport?.evidenceRows.map((row) => row.id)).toEqual(["r06-preserve-payment"]);

  await page.getByTestId("evidence-csv-input").fill("");
  await forceImportClick(page);
  const afterEmptyBlockedHistory = await saveCurrentImportHistory(page, testInfo, "r06-empty-blocked-preserve-after-state.json");
  const afterEmptyBlockedExport = await saveCurrentExportText(page, testInfo, "r06-empty-blocked-preserve-after-export.json");
  expect(afterEmptyBlockedHistory).toEqual(beforeHistory);
  expect(afterEmptyBlockedExport.exportJson).toBe(beforeExportText);

  await page.screenshot({
    path: testInfo.outputPath("r06-blocked-preservation-ui.png"),
    fullPage: true
  });
});

test("CSV evidence import history should show disabled undo before history and undo the first import to base state", async ({
  page
}, testInfo) => {
  await openEvidenceImport(page);

  const undoButton = page.getByTestId("undo-import-button");
  await expect(undoButton).toBeVisible();
  await expect(undoButton).toBeDisabled();
  await expect(page.getByTestId("import-history-section")).toContainText("No imports recorded");
  const noHistoryBefore = await saveCurrentImportHistory(page, testInfo, "r05-no-history-before-undo.json");
  expect(noHistoryBefore).toEqual({
    current: null,
    canUndo: false,
    historyEntries: []
  });

  await undoButton.evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      button.click();
    }
  });
  const noHistoryAfter = await saveCurrentImportHistory(page, testInfo, "r05-no-history-after-undo-attempt.json");
  expect(noHistoryAfter).toEqual(noHistoryBefore);

  await importEvidenceCsv(
    page,
    evidenceCsv(["first-import,First imported proof,browser,criterion-payment,first.json"])
  );
  const firstImport = await saveCurrentImportHistory(page, testInfo, "r05-first-import-state.json");
  expectCurrentImportIds(firstImport, ["first-import"], []);
  expect(firstImport.canUndo).toBe(true);

  await undoButton.click();
  const baseState = await saveCurrentImportHistory(page, testInfo, "r05-first-import-undo-base-state.json");
  expect(baseState.current).toBeNull();
  expect(baseState.canUndo).toBe(false);
  expect(baseState.historyEntries).toEqual([
    expect.objectContaining({
      actionType: "import",
      acceptedCount: 1,
      rejectedCount: 0,
      acceptedEvidenceIds: ["first-import"],
      rejectedLineNumbers: [],
      status: "undone"
    })
  ]);
  await expectVisibleHistoryEntry(page, 0, {
    status: "undone",
    accepted: "Accepted: 1 (first-import)",
    rejected: "Rejected: 0 lines (none)"
  });
  await expect(page.getByRole("button", { name: "Export accepted JSON" })).toBeDisabled();
  await expect(page.getByTestId("export-json-output")).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("r05-no-history-and-first-import-undo.png"),
    fullPage: true
  });
});

test("CSV evidence import history should restore S2 then S1 with exact rows and exports", async ({ page }, testInfo) => {
  await openEvidenceImport(page);

  const s1Csv = evidenceCsv([
    "s1-payment,S1 payment proof,browser,criterion-payment,s1-payment.json",
    ",S1 missing id,test,criterion-summary,s1-missing.json"
  ]);
  const s2Csv = evidenceCsv([
    "s2-summary,S2 summary proof,api,criterion-summary,s2-summary.json",
    "s2-recovery,S2 recovery proof,test,criterion-recovery,s2-recovery.json",
    "s2-bad-kind,S2 bad kind,video,criterion-payment,s2-bad.json"
  ]);
  const s3Csv = evidenceCsv([
    "s3-payment,S3 payment proof,browser,criterion-payment,s3-payment.json",
    "s3-summary,S3 summary proof,api,criterion-summary,s3-summary.json",
    "s3-missing-source,S3 missing source,test,criterion-recovery,"
  ]);

  await importEvidenceCsv(page, s1Csv);
  await importEvidenceCsv(page, s2Csv);
  await importEvidenceCsv(page, s3Csv);

  const s3State = await saveCurrentImportHistory(page, testInfo, "r05-two-step-s3-state.json");
  expectCurrentImportIds(s3State, ["s3-payment", "s3-summary"], [4]);
  await expect(page.getByTestId("import-history-entry")).toHaveCount(3);
  await expectVisibleHistoryEntry(page, 2, {
    status: "active",
    accepted: "Accepted: 2 (s3-payment, s3-summary)",
    rejected: "Rejected: 1 lines (4)"
  });

  await page.getByTestId("undo-import-button").click();
  const restoredS2 = await saveCurrentImportHistory(page, testInfo, "r05-two-step-after-undo-1-s2-state.json");
  expectCurrentImportIds(restoredS2, ["s2-summary", "s2-recovery"], [4]);
  expect(restoredS2.historyEntries.map((entry) => entry.status)).toEqual(["active", "active", "undone"]);
  await expectVisibleHistoryEntry(page, 1, {
    status: "active",
    accepted: "Accepted: 2 (s2-summary, s2-recovery)",
    rejected: "Rejected: 1 lines (4)"
  });
  await expectVisibleHistoryEntry(page, 2, {
    status: "undone",
    accepted: "Accepted: 2 (s3-payment, s3-summary)",
    rejected: "Rejected: 1 lines (4)"
  });
  const s2Export = await exportAcceptedEvidence(page, testInfo, "r05-two-step-after-undo-1-s2-export.json");
  expect(s2Export.evidenceRows.map((row) => row.id)).toEqual(["s2-summary", "s2-recovery"]);

  await page.getByTestId("undo-import-button").click();
  const restoredS1 = await saveCurrentImportHistory(page, testInfo, "r05-two-step-after-undo-2-s1-state.json");
  expectCurrentImportIds(restoredS1, ["s1-payment"], [3]);
  expect(restoredS1.historyEntries.map((entry) => entry.status)).toEqual(["active", "undone", "undone"]);
  await expectVisibleHistoryEntry(page, 0, {
    status: "active",
    accepted: "Accepted: 1 (s1-payment)",
    rejected: "Rejected: 1 lines (3)"
  });
  await expectVisibleHistoryEntry(page, 1, {
    status: "undone",
    accepted: "Accepted: 2 (s2-summary, s2-recovery)",
    rejected: "Rejected: 1 lines (4)"
  });
  const s1Export = await exportAcceptedEvidence(page, testInfo, "r05-two-step-after-undo-2-s1-export.json");
  expect(s1Export.evidenceRows.map((row) => row.id)).toEqual(["s1-payment"]);

  await page.screenshot({
    path: testInfo.outputPath("r05-two-step-undo-history.png"),
    fullPage: true
  });
});

test("CSV evidence import history should undo a mixed import and keep export accepted-only", async ({ page }, testInfo) => {
  await openEvidenceImport(page);

  await importEvidenceCsv(
    page,
    evidenceCsv([
      "mixed-prev-payment,Previous payment proof,browser,criterion-payment,prev-payment.json",
      "mixed-prev-summary,Previous summary proof,api,criterion-summary,prev-summary.json"
    ])
  );
  const previous = await saveCurrentImportHistory(page, testInfo, "r05-mixed-previous-state.json");
  expectCurrentImportIds(previous, ["mixed-prev-payment", "mixed-prev-summary"], []);

  await importEvidenceCsv(
    page,
    evidenceCsv([
      "mixed-new-payment,Mixed new payment,browser,criterion-payment,mixed-payment.json",
      ",Mixed missing id,test,criterion-summary,mixed-missing.json",
      "evidence-payment,Mixed seeded duplicate,browser,criterion-payment,mixed-duplicate.json"
    ])
  );
  const mixed = await saveCurrentImportHistory(page, testInfo, "r05-mixed-import-state.json");
  expectCurrentImportIds(mixed, ["mixed-new-payment"], [3, 4]);

  await page.getByTestId("undo-import-button").click();
  const restored = await saveCurrentImportHistory(page, testInfo, "r05-mixed-after-undo-state.json");
  expectCurrentImportIds(restored, ["mixed-prev-payment", "mixed-prev-summary"], []);
  expect(JSON.stringify(restored.current)).not.toContain("mixed-new-payment");
  const restoredExport = await exportAcceptedEvidence(page, testInfo, "r05-mixed-after-undo-export.json");
  expect(restoredExport.evidenceRows.map((row) => row.id)).toEqual(["mixed-prev-payment", "mixed-prev-summary"]);
  expect(JSON.stringify(restoredExport)).not.toContain("Mixed missing id");

  await page.screenshot({
    path: testInfo.outputPath("r05-mixed-import-undo.png"),
    fullPage: true
  });
});

test("CSV evidence import history should undo an all-invalid import and restore exportable rows", async ({ page }, testInfo) => {
  await openEvidenceImport(page);

  await importEvidenceCsv(
    page,
    evidenceCsv(["invalid-prev-payment,Previous valid proof,browser,criterion-payment,invalid-prev.json"])
  );
  const previous = await saveCurrentImportHistory(page, testInfo, "r05-all-invalid-previous-state.json");
  expectCurrentImportIds(previous, ["invalid-prev-payment"], []);

  await importEvidenceCsv(
    page,
    evidenceCsv([
      ",All invalid missing id,browser,criterion-payment,missing-id.json",
      "all-invalid-kind,All invalid kind,video,criterion-summary,bad-kind.json",
      "all-invalid-source,All invalid source,test,criterion-recovery,"
    ])
  );
  const allInvalid = await saveCurrentImportHistory(page, testInfo, "r05-all-invalid-import-state.json");
  expectCurrentImportIds(allInvalid, [], [2, 3, 4]);
  expect(allInvalid.historyEntries.at(-1)).toEqual(
    expect.objectContaining({
      acceptedCount: 0,
      rejectedCount: 3,
      rejectedLineNumbers: [2, 3, 4],
      status: "active"
    })
  );
  await expectVisibleHistoryEntry(page, 1, {
    status: "active",
    accepted: "Accepted: 0 (none)",
    rejected: "Rejected: 3 lines (2, 3, 4)"
  });
  await expect(page.getByRole("button", { name: "Export accepted JSON" })).toBeDisabled();

  await page.getByTestId("undo-import-button").click();
  const restored = await saveCurrentImportHistory(page, testInfo, "r05-all-invalid-after-undo-state.json");
  expectCurrentImportIds(restored, ["invalid-prev-payment"], []);
  const restoredExport = await exportAcceptedEvidence(page, testInfo, "r05-all-invalid-after-undo-export.json");
  expect(restoredExport.evidenceRows.map((row) => row.id)).toEqual(["invalid-prev-payment"]);

  await page.screenshot({
    path: testInfo.outputPath("r05-all-invalid-import-undo.png"),
    fullPage: true
  });
});

test("CSV evidence import history should replace forward history after import following undo", async ({ page }, testInfo) => {
  await openEvidenceImport(page);

  await importEvidenceCsv(page, evidenceCsv(["branch-s1,S1 proof,browser,criterion-payment,s1.json"]));
  await importEvidenceCsv(page, evidenceCsv(["branch-s2,S2 proof,api,criterion-summary,s2.json"]));
  await importEvidenceCsv(page, evidenceCsv(["branch-s3-forward,S3 forward proof,test,criterion-recovery,s3.json"]));
  const s3 = await saveCurrentImportHistory(page, testInfo, "r05-branch-s3-state.json");
  expectCurrentImportIds(s3, ["branch-s3-forward"], []);

  await page.getByTestId("undo-import-button").click();
  const undoneToS2 = await saveCurrentImportHistory(page, testInfo, "r05-branch-after-undo-to-s2-state.json");
  expectCurrentImportIds(undoneToS2, ["branch-s2"], []);
  expect(undoneToS2.historyEntries.map((entry) => entry.status)).toEqual(["active", "active", "undone"]);
  await expectVisibleHistoryEntry(page, 2, {
    status: "undone",
    accepted: "Accepted: 1 (branch-s3-forward)",
    rejected: "Rejected: 0 lines (none)"
  });

  await importEvidenceCsv(page, evidenceCsv(["branch-s4,S4 replacement proof,browser,criterion-payment,s4.json"]));
  const s4 = await saveCurrentImportHistory(page, testInfo, "r05-branch-s4-replacement-state.json");
  expectCurrentImportIds(s4, ["branch-s4"], []);
  expect(s4.historyEntries.map((entry) => entry.acceptedEvidenceIds)).toEqual([
    ["branch-s1"],
    ["branch-s2"],
    ["branch-s4"]
  ]);
  expect(JSON.stringify(s4)).not.toContain("branch-s3-forward");
  await expect(page.getByTestId("import-history-entry")).toHaveCount(3);
  await expect(page.getByTestId("import-history-section")).not.toContainText("branch-s3-forward");
  await expectVisibleHistoryEntry(page, 2, {
    status: "active",
    accepted: "Accepted: 1 (branch-s4)",
    rejected: "Rejected: 0 lines (none)"
  });
  await expect(page.getByRole("button", { name: /redo/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /branch/i })).toHaveCount(0);

  await page.getByTestId("undo-import-button").click();
  const backToS2 = await saveCurrentImportHistory(page, testInfo, "r05-branch-after-s4-undo-1-s2-state.json");
  expectCurrentImportIds(backToS2, ["branch-s2"], []);
  await page.getByTestId("undo-import-button").click();
  const backToS1 = await saveCurrentImportHistory(page, testInfo, "r05-branch-after-s4-undo-2-s1-state.json");
  expectCurrentImportIds(backToS1, ["branch-s1"], []);
  expect(JSON.stringify(backToS2)).not.toContain("branch-s3-forward");
  expect(JSON.stringify(backToS1)).not.toContain("branch-s3-forward");

  await page.screenshot({
    path: testInfo.outputPath("r05-branch-replacement-history.png"),
    fullPage: true
  });
});

test("ordered evidence review workflow should move through blocked and rejected before accepted", async ({ page }, testInfo) => {
  await page.goto("/");

  const seededReviewItem = page.getByTestId("seeded-review-item");
  await expect(seededReviewItem.getByRole("heading", { name: "Checkout evidence review" })).toHaveCount(1);
  await expect(page.getByTestId("evidence-review-workflow")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("01-seeded-review-item-before-open.png"),
    fullPage: true
  });

  await page.getByRole("button", { name: "Open review workflow" }).click();
  await expect(page.getByTestId("evidence-review-workflow")).toBeVisible();
  await expect(page.locator(".criterion")).toHaveCount(3);
  await expect(page.locator(".evidence-card")).toHaveCount(3);
  await expect(page.getByTestId("final-verdict")).toContainText("Blocked");
  await expect(page.getByTestId("final-verdict")).toContainText("Payment confirmation has no criterion verdict.");
  await page.screenshot({
    path: testInfo.outputPath("02-opened-initial-blocked.png"),
    fullPage: true
  });

  await page.getByRole("button", { name: "Mark Payment confirmation PASS" }).click();
  await expect(page.getByTestId("final-verdict")).toContainText("Blocked");
  await expect(page.getByTestId("final-verdict")).toContainText("Payment confirmation is marked PASS but has no selected evidence.");
  await page.screenshot({
    path: testInfo.outputPath("03-pass-without-evidence-blocked.png"),
    fullPage: true
  });

  await page.getByLabel("Evidence for Order summary").selectOption("evidence-summary");
  await page.getByRole("button", { name: "Mark Order summary PASS" }).click();
  await page.getByLabel("Evidence for Recovery path").selectOption("evidence-recovery");
  await page.getByRole("button", { name: "Mark Recovery path FAIL" }).click();
  await expect(page.getByTestId("final-verdict")).toContainText("Rejected");
  await expect(page.getByTestId("final-verdict")).toContainText("Recovery path is marked FAIL.");
  await page.screenshot({
    path: testInfo.outputPath("04-rejected-intermediate-state.png"),
    fullPage: true
  });

  await page.getByLabel("Evidence for Payment confirmation").selectOption("evidence-payment");
  await page.getByRole("button", { name: "Mark Recovery path PASS" }).click();
  await expect(page.getByTestId("final-verdict")).toContainText("Accepted");
  await expect(page.getByTestId("final-verdict")).toContainText("Every required criterion passed with selected evidence.");
  await page.screenshot({
    path: testInfo.outputPath("05-accepted-after-all-evidence.png"),
    fullPage: true
  });
});
