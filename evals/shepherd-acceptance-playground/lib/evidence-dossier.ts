import type { WorkflowMode } from "./workflow-mode";

export type DossierProofType = "screenshot" | "state-json" | "trace" | "video" | "command-log" | "manifest";

export type DossierStatus =
  | "not-loaded"
  | "invalid-bundle"
  | "incomplete"
  | "needs-review"
  | "failed"
  | "stale"
  | "passed";

export type DossierClaimedVerdict = "pass" | "fail" | "needs-review" | "pending";

export type ReviewerJudgmentValue = "pass" | "fail" | "needs-review";

export type DossierArtifact = {
  id: string;
  type: DossierProofType;
  path: string;
  fingerprint: string;
  observedAssertions: string[];
};

export type DossierAcceptanceCriterion = {
  id: string;
  expectedBehavior: string;
  claimedVerdict: DossierClaimedVerdict;
  requiredProofTypes: DossierProofType[];
  artifacts: DossierArtifact[];
};

export type EvidenceDossierBundle = {
  requestId: string;
  bundleFingerprint: string;
  currentStateFingerprint: string;
  generatedAt: string;
  acceptanceCriteria: DossierAcceptanceCriterion[];
};

export type DossierValidationError = {
  path: string;
  code:
    | "invalid_json"
    | "missing_field"
    | "invalid_field"
    | "unsupported_proof_type"
    | "duplicate_ac"
    | "duplicate_artifact";
  message: string;
};

export type DossierImportState =
  | {
      status: "not-loaded";
      bundle: null;
      errors: [];
      rawText: string;
    }
  | {
      status: "invalid-bundle";
      bundle: null;
      errors: DossierValidationError[];
      rawText: string;
    }
  | {
      status: "loaded";
      bundle: EvidenceDossierBundle;
      errors: [];
      rawText: string;
    };

export type ReviewerJudgment = {
  criterionId: string;
  judgment: ReviewerJudgmentValue;
  note: string;
  recordedAt: string;
  bundleFingerprint: string;
  currentStateFingerprint: string;
};

export type EffectiveReviewerJudgment = ReviewerJudgment & {
  stale: boolean;
};

export type DossierCriterionEvaluation = {
  criterionId: string;
  expectedBehavior: string;
  claimedVerdict: DossierClaimedVerdict;
  requiredProofTypes: DossierProofType[];
  presentProofTypes: DossierProofType[];
  missingProofTypes: DossierProofType[];
  observedAssertions: string[];
  artifacts: DossierArtifact[];
  completeProof: boolean;
  reviewerJudgment: EffectiveReviewerJudgment | null;
  passBlocked: boolean;
  blockers: string[];
};

export type DossierEvaluation = {
  status: DossierStatus;
  bundle: EvidenceDossierBundle | null;
  validationErrors: DossierValidationError[];
  criteria: DossierCriterionEvaluation[];
  currentStateFingerprint: string | null;
  staleJudgmentCount: number;
  blockers: string[];
};

export type JudgmentAttempt =
  | {
      accepted: true;
      judgment: ReviewerJudgment;
      reason: null;
    }
  | {
      accepted: false;
      judgment: null;
      reason: string;
    };

export const dossierProofTypes: DossierProofType[] = [
  "screenshot",
  "state-json",
  "trace",
  "video",
  "command-log",
  "manifest"
];

export function createInitialDossierImportState(): DossierImportState {
  return {
    status: "not-loaded",
    bundle: null,
    errors: [],
    rawText: ""
  };
}

export function parseEvidenceDossierBundle(rawText: string): DossierImportState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return invalidImport(rawText, [
      {
        path: "$",
        code: "invalid_json",
        message: "Bundle must be valid JSON."
      }
    ]);
  }

  const errors = validateBundleShape(parsed);
  if (errors.length > 0) {
    return invalidImport(rawText, errors);
  }

  return {
    status: "loaded",
    bundle: parsed as EvidenceDossierBundle,
    errors: [],
    rawText
  };
}

export function evaluateDossier({
  importState,
  judgments,
  currentStateFingerprint
}: {
  importState: DossierImportState;
  judgments: ReviewerJudgment[];
  currentStateFingerprint?: string;
}): DossierEvaluation {
  if (importState.status === "invalid-bundle") {
    return {
      status: "invalid-bundle",
      bundle: null,
      validationErrors: importState.errors,
      criteria: [],
      currentStateFingerprint: currentStateFingerprint ?? null,
      staleJudgmentCount: 0,
      blockers: importState.errors.map((error) => error.message)
    };
  }

  if (importState.status === "not-loaded") {
    return {
      status: "not-loaded",
      bundle: null,
      validationErrors: [],
      criteria: [],
      currentStateFingerprint: currentStateFingerprint ?? null,
      staleJudgmentCount: 0,
      blockers: ["No evidence dossier bundle loaded."]
    };
  }

  const bundle = importState.bundle;
  const effectiveFingerprint = currentStateFingerprint ?? bundle.currentStateFingerprint;
  const criteria = bundle.acceptanceCriteria.map((criterion) =>
    evaluateCriterion(criterion, judgments, bundle.bundleFingerprint, effectiveFingerprint)
  );
  const staleJudgmentCount = criteria.filter((criterion) => criterion.reviewerJudgment?.stale).length;
  const blockers = criteria.flatMap((criterion) =>
    criterion.blockers.map((blocker) => `${criterion.criterionId}: ${blocker}`)
  );

  return {
    status: dossierStatusForCriteria(criteria),
    bundle,
    validationErrors: [],
    criteria,
    currentStateFingerprint: effectiveFingerprint,
    staleJudgmentCount,
    blockers
  };
}

export function recordReviewerJudgment({
  mode,
  importState,
  currentJudgments,
  criterionId,
  judgment,
  note,
  recordedAt,
  currentStateFingerprint
}: {
  mode: WorkflowMode;
  importState: DossierImportState;
  currentJudgments: ReviewerJudgment[];
  criterionId: string;
  judgment: ReviewerJudgmentValue;
  note: string;
  recordedAt: string;
  currentStateFingerprint?: string;
}): JudgmentAttempt {
  if (mode !== "reviewer") {
    return {
      accepted: false,
      judgment: null,
      reason: "Reviewer judgments can only be recorded in reviewer mode."
    };
  }

  if (importState.status !== "loaded") {
    return {
      accepted: false,
      judgment: null,
      reason: "A valid dossier bundle is required before recording judgment."
    };
  }

  const bundle = importState.bundle;
  const criterion = bundle.acceptanceCriteria.find((candidate) => candidate.id === criterionId);
  if (!criterion) {
    return {
      accepted: false,
      judgment: null,
      reason: "Criterion does not exist in the loaded dossier bundle."
    };
  }

  const effectiveFingerprint = currentStateFingerprint ?? bundle.currentStateFingerprint;
  const evaluation = evaluateCriterion(criterion, currentJudgments, bundle.bundleFingerprint, effectiveFingerprint);
  if (judgment === "pass" && !evaluation.completeProof) {
    return {
      accepted: false,
      judgment: null,
      reason: "Pass is blocked until required proof types and observed assertions are present."
    };
  }

  return {
    accepted: true,
    reason: null,
    judgment: {
      criterionId,
      judgment,
      note,
      recordedAt,
      bundleFingerprint: bundle.bundleFingerprint,
      currentStateFingerprint: effectiveFingerprint
    }
  };
}

export function upsertReviewerJudgment(
  currentJudgments: ReviewerJudgment[],
  nextJudgment: ReviewerJudgment
): ReviewerJudgment[] {
  return [
    ...currentJudgments.filter((judgment) => judgment.criterionId !== nextJudgment.criterionId),
    nextJudgment
  ].sort((left, right) => left.criterionId.localeCompare(right.criterionId));
}

export function canImportDossier(mode: WorkflowMode) {
  return mode === "operator";
}

export function canResetDossier(mode: WorkflowMode) {
  return mode === "operator";
}

export function canRecordDossierJudgment(mode: WorkflowMode) {
  return mode === "reviewer";
}

export function dossierStatusForCriteria(criteria: DossierCriterionEvaluation[]): DossierStatus {
  if (criteria.some((criterion) => criterion.reviewerJudgment?.stale)) {
    return "stale";
  }
  if (criteria.some((criterion) => criterion.reviewerJudgment?.judgment === "fail")) {
    return "failed";
  }
  if (criteria.some((criterion) => !criterion.completeProof || !criterion.reviewerJudgment)) {
    return "incomplete";
  }
  if (criteria.some((criterion) => criterion.reviewerJudgment?.judgment === "needs-review")) {
    return "needs-review";
  }
  if (criteria.length > 0 && criteria.every((criterion) => criterion.reviewerJudgment?.judgment === "pass")) {
    return "passed";
  }
  return "incomplete";
}

export function currentDossierFingerprint(bundle: EvidenceDossierBundle | null, salt = "") {
  if (!bundle) {
    return "no-dossier";
  }

  if (salt === "") {
    return bundle.currentStateFingerprint;
  }

  return stableDossierFingerprint({
    baseFingerprint: bundle.currentStateFingerprint,
    requestId: bundle.requestId,
    salt
  });
}

export function stableDossierFingerprint(value: unknown): string {
  return canonicalJson(value);
}

function evaluateCriterion(
  criterion: DossierAcceptanceCriterion,
  judgments: ReviewerJudgment[],
  bundleFingerprint: string,
  currentStateFingerprint: string
): DossierCriterionEvaluation {
  const presentProofTypes = unique(criterion.artifacts.map((artifact) => artifact.type));
  const missingProofTypes = criterion.requiredProofTypes.filter((proofType) => !presentProofTypes.includes(proofType));
  const observedAssertions = criterion.artifacts.flatMap((artifact) => artifact.observedAssertions);
  const completeProof = missingProofTypes.length === 0 && observedAssertions.length > 0;
  const latestJudgment = judgments.find((judgment) => judgment.criterionId === criterion.id) ?? null;
  const reviewerJudgment = latestJudgment
    ? {
        ...latestJudgment,
        stale:
          latestJudgment.bundleFingerprint !== bundleFingerprint ||
          latestJudgment.currentStateFingerprint !== currentStateFingerprint
      }
    : null;
  const blockers = [
    ...missingProofTypes.map((proofType) => `Missing proof type: ${proofType}`),
    ...(observedAssertions.length === 0 ? ["Missing observed assertions."] : []),
    ...(!reviewerJudgment ? ["Missing reviewer judgment."] : []),
    ...(reviewerJudgment?.stale ? ["Reviewer judgment is stale."] : [])
  ];

  return {
    criterionId: criterion.id,
    expectedBehavior: criterion.expectedBehavior,
    claimedVerdict: criterion.claimedVerdict,
    requiredProofTypes: [...criterion.requiredProofTypes],
    presentProofTypes,
    missingProofTypes,
    observedAssertions,
    artifacts: criterion.artifacts.map((artifact) => ({
      ...artifact,
      observedAssertions: [...artifact.observedAssertions]
    })),
    completeProof,
    reviewerJudgment,
    passBlocked: !completeProof,
    blockers
  };
}

function validateBundleShape(value: unknown): DossierValidationError[] {
  const errors: DossierValidationError[] = [];
  if (!isRecord(value)) {
    return [
      {
        path: "$",
        code: "invalid_field",
        message: "Bundle must be a JSON object."
      }
    ];
  }

  requireString(value, "requestId", "$.requestId", errors);
  requireString(value, "bundleFingerprint", "$.bundleFingerprint", errors);
  requireString(value, "currentStateFingerprint", "$.currentStateFingerprint", errors);
  requireString(value, "generatedAt", "$.generatedAt", errors);

  if (!Array.isArray(value.acceptanceCriteria)) {
    errors.push({
      path: "$.acceptanceCriteria",
      code: "missing_field",
      message: "acceptanceCriteria must be an array."
    });
    return errors;
  }

  const criterionIds = new Set<string>();
  value.acceptanceCriteria.forEach((criterion, criterionIndex) => {
    const path = `$.acceptanceCriteria[${criterionIndex}]`;
    if (!isRecord(criterion)) {
      errors.push({ path, code: "invalid_field", message: "Acceptance criterion must be an object." });
      return;
    }

    const id = requireString(criterion, "id", `${path}.id`, errors);
    if (id) {
      if (criterionIds.has(id)) {
        errors.push({ path: `${path}.id`, code: "duplicate_ac", message: `Duplicate AC id: ${id}.` });
      }
      criterionIds.add(id);
    }
    requireString(criterion, "expectedBehavior", `${path}.expectedBehavior`, errors);
    validateClaimedVerdict(criterion.claimedVerdict, `${path}.claimedVerdict`, errors);
    validateProofTypes(criterion.requiredProofTypes, `${path}.requiredProofTypes`, errors);
    validateArtifacts(criterion.artifacts, `${path}.artifacts`, errors);
  });

  return errors;
}

function validateArtifacts(value: unknown, path: string, errors: DossierValidationError[]) {
  if (!Array.isArray(value)) {
    errors.push({ path, code: "missing_field", message: "artifacts must be an array." });
    return;
  }

  const artifactIds = new Set<string>();
  value.forEach((artifact, artifactIndex) => {
    const artifactPath = `${path}[${artifactIndex}]`;
    if (!isRecord(artifact)) {
      errors.push({ path: artifactPath, code: "invalid_field", message: "Artifact must be an object." });
      return;
    }

    const id = requireString(artifact, "id", `${artifactPath}.id`, errors);
    if (id) {
      if (artifactIds.has(id)) {
        errors.push({ path: `${artifactPath}.id`, code: "duplicate_artifact", message: `Duplicate artifact id: ${id}.` });
      }
      artifactIds.add(id);
    }
    validateProofType(artifact.type, `${artifactPath}.type`, errors);
    requireString(artifact, "path", `${artifactPath}.path`, errors);
    requireString(artifact, "fingerprint", `${artifactPath}.fingerprint`, errors);
    if (!Array.isArray(artifact.observedAssertions)) {
      errors.push({
        path: `${artifactPath}.observedAssertions`,
        code: "missing_field",
        message: "observedAssertions must be an array."
      });
    } else if (artifact.observedAssertions.some((assertion) => typeof assertion !== "string" || assertion.trim() === "")) {
      errors.push({
        path: `${artifactPath}.observedAssertions`,
        code: "invalid_field",
        message: "observedAssertions must contain non-empty strings."
      });
    }
  });
}

function validateClaimedVerdict(value: unknown, path: string, errors: DossierValidationError[]) {
  if (value === "pass" || value === "fail" || value === "needs-review" || value === "pending") {
    return;
  }
  errors.push({
    path,
    code: "invalid_field",
    message: "claimedVerdict must be pass, fail, needs-review, or pending."
  });
}

function validateProofTypes(value: unknown, path: string, errors: DossierValidationError[]) {
  if (!Array.isArray(value)) {
    errors.push({ path, code: "missing_field", message: "requiredProofTypes must be an array." });
    return;
  }

  value.forEach((proofType, index) => validateProofType(proofType, `${path}[${index}]`, errors));
}

function validateProofType(value: unknown, path: string, errors: DossierValidationError[]) {
  if (typeof value === "string" && dossierProofTypes.includes(value as DossierProofType)) {
    return;
  }
  errors.push({
    path,
    code: "unsupported_proof_type",
    message: `Unsupported proof type: ${String(value)}.`
  });
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: DossierValidationError[]
) {
  if (typeof record[key] === "string" && record[key].trim() !== "") {
    return record[key] as string;
  }

  errors.push({
    path,
    code: "missing_field",
    message: `${key} must be a non-empty string.`
  });
  return null;
}

function invalidImport(rawText: string, errors: DossierValidationError[]): DossierImportState {
  return {
    status: "invalid-bundle",
    bundle: null,
    errors,
    rawText
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function canonicalJson(value: unknown): string {
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
