export type CriterionVerdict = "unreviewed" | "pass" | "fail";

export type ReviewVerdictStatus = "blocked" | "rejected" | "accepted";

export type EvidenceOption = {
  id: string;
  title: string;
  detail: string;
  kind: "browser" | "api" | "test";
};

export type AcceptanceCriterion = {
  id: string;
  title: string;
  description: string;
  required: boolean;
};

export type CriterionReviewState = {
  criterionId: string;
  verdict: CriterionVerdict;
  selectedEvidenceId: string | null;
};

export type ReviewVerdict = {
  status: ReviewVerdictStatus;
  reasons: string[];
  failedCriterionIds: string[];
  missingCriterionIds: string[];
  missingEvidenceCriterionIds: string[];
};

export type RequiredCriteriaStatusSummary = {
  requiredTotal: number;
  passingCount: number;
  failingCount: number;
  unreviewedCount: number;
  missingEvidenceCount: number;
  passingCriterionIds: string[];
  failingCriterionIds: string[];
  unreviewedCriterionIds: string[];
  missingEvidenceCriterionIds: string[];
};

export type EvidenceReviewScenarioName = "initial" | "missing-evidence" | "failed" | "accepted";

export type EvidenceReviewComparisonPairId = "failed-to-accepted" | "unresolved-missing-evidence";

export type ScenarioCriterionState = CriterionReviewState & {
  title: string;
  required: boolean;
  selectedEvidence: EvidenceOption | null;
};

export type EvidenceReviewScenario = {
  scenario: EvidenceReviewScenarioName;
  item: EvidenceReviewItem;
  states: CriterionReviewState[];
  criteria: ScenarioCriterionState[];
  verdict: ReviewVerdict;
};

export type EvidenceReviewItem = {
  id: string;
  title: string;
  summary: string;
  criteria: AcceptanceCriterion[];
  evidence: EvidenceOption[];
};

export type VerdictChange = {
  previous: ReviewVerdictStatus;
  current: ReviewVerdictStatus;
  changed: boolean;
};

export type CriterionChange = {
  criterionId: string;
  title: string;
  previousVerdict: CriterionVerdict;
  currentVerdict: CriterionVerdict;
  previousEvidenceId: string | null;
  currentEvidenceId: string | null;
};

export type AddedEvidenceChange = {
  criterionId: string;
  title: string;
  currentEvidenceId: string;
  currentEvidenceTitle: string;
};

export type ReplacedEvidenceChange = {
  criterionId: string;
  title: string;
  previousEvidenceId: string;
  previousEvidenceTitle: string;
  currentEvidenceId: string;
  currentEvidenceTitle: string;
};

export type RemovedEvidenceChange = {
  criterionId: string;
  title: string;
  previousEvidenceId: string;
  previousEvidenceTitle: string;
};

export type EvidenceChanges = {
  added: AddedEvidenceChange[];
  replaced: ReplacedEvidenceChange[];
  removed: RemovedEvidenceChange[];
};

export type RemainingBlocker = {
  criterionId: string;
  title: string;
  type: "missing evidence" | "unresolved required proof";
  currentVerdict: CriterionVerdict;
};

export type EvidenceReviewComparison = {
  pair: string;
  previousScenario: EvidenceReviewScenarioName;
  currentScenario: EvidenceReviewScenarioName;
  verdictChange: VerdictChange;
  criterionChanges: CriterionChange[];
  evidenceChanges: EvidenceChanges;
  remainingBlockers: RemainingBlocker[];
};

export type EvidenceReviewComparisonInput = {
  pair: string;
  previousScenario: EvidenceReviewScenario;
  currentScenario: EvidenceReviewScenario;
};

export const seededEvidenceReview: EvidenceReviewItem = {
  id: "checkout-evidence-review",
  title: "Checkout evidence review",
  summary: "Verify the checkout workflow against acceptance criteria before it can be accepted.",
  criteria: [
    {
      id: "criterion-payment",
      title: "Payment confirmation",
      description: "The browser replay shows the checkout payment step completing with an order number.",
      required: true
    },
    {
      id: "criterion-summary",
      title: "Order summary",
      description: "The UI shows the final cart total, customer email, and delivery method after checkout.",
      required: true
    },
    {
      id: "criterion-recovery",
      title: "Recovery path",
      description: "The run proves the customer can recover after a declined card without losing the cart.",
      required: true
    }
  ],
  evidence: [
    {
      id: "evidence-payment",
      title: "Replay: successful payment",
      detail: "Chromium trace captures payment submission, confirmation screen, and generated order number.",
      kind: "browser"
    },
    {
      id: "evidence-summary",
      title: "Screenshot: checkout summary",
      detail: "Full-page capture shows final total, customer email, and selected delivery method.",
      kind: "browser"
    },
    {
      id: "evidence-recovery",
      title: "API proof: declined-card recovery",
      detail: "State proof records the rejected payment response followed by a successful retry with the same cart ID.",
      kind: "api"
    }
  ]
};

export function createInitialCriterionStates(criteria: AcceptanceCriterion[]): CriterionReviewState[] {
  return criteria.map((criterion) => ({
    criterionId: criterion.id,
    verdict: "unreviewed",
    selectedEvidenceId: null
  }));
}

export function calculateReviewVerdict(criteria: AcceptanceCriterion[], states: CriterionReviewState[]): ReviewVerdict {
  const failedCriterionIds: string[] = [];
  const missingCriterionIds: string[] = [];
  const missingEvidenceCriterionIds: string[] = [];
  const rejectedReasons: string[] = [];
  const blockedReasons: string[] = [];

  for (const criterion of criteria) {
    if (!criterion.required) {
      continue;
    }

    const state = states.find((candidate) => candidate.criterionId === criterion.id);
    if (!state || state.verdict === "unreviewed") {
      missingCriterionIds.push(criterion.id);
      blockedReasons.push(`${criterion.title} has no criterion verdict.`);
      continue;
    }

    if (state.verdict === "fail") {
      failedCriterionIds.push(criterion.id);
      rejectedReasons.push(`${criterion.title} is marked FAIL.`);
      continue;
    }

    if (!state.selectedEvidenceId) {
      missingEvidenceCriterionIds.push(criterion.id);
      blockedReasons.push(`${criterion.title} is marked PASS but has no selected evidence.`);
    }
  }

  if (failedCriterionIds.length > 0) {
    return {
      status: "rejected",
      reasons: rejectedReasons,
      failedCriterionIds,
      missingCriterionIds,
      missingEvidenceCriterionIds
    };
  }

  if (blockedReasons.length > 0) {
    return {
      status: "blocked",
      reasons: blockedReasons,
      failedCriterionIds,
      missingCriterionIds,
      missingEvidenceCriterionIds
    };
  }

  return {
    status: "accepted",
    reasons: ["Every required criterion passed with selected evidence."],
    failedCriterionIds,
    missingCriterionIds,
    missingEvidenceCriterionIds
  };
}

export function summarizeRequiredCriteria(
  criteria: AcceptanceCriterion[],
  states: CriterionReviewState[]
): RequiredCriteriaStatusSummary {
  const passingCriterionIds: string[] = [];
  const failingCriterionIds: string[] = [];
  const unreviewedCriterionIds: string[] = [];
  const missingEvidenceCriterionIds: string[] = [];

  for (const criterion of criteria) {
    if (!criterion.required) {
      continue;
    }

    const state = states.find((candidate) => candidate.criterionId === criterion.id);

    if (!state || state.verdict === "unreviewed") {
      unreviewedCriterionIds.push(criterion.id);
      continue;
    }

    if (state.verdict === "fail") {
      failingCriterionIds.push(criterion.id);
      continue;
    }

    if (!state.selectedEvidenceId) {
      missingEvidenceCriterionIds.push(criterion.id);
      continue;
    }

    passingCriterionIds.push(criterion.id);
  }

  return {
    requiredTotal:
      passingCriterionIds.length +
      failingCriterionIds.length +
      unreviewedCriterionIds.length +
      missingEvidenceCriterionIds.length,
    passingCount: passingCriterionIds.length,
    failingCount: failingCriterionIds.length,
    unreviewedCount: unreviewedCriterionIds.length,
    missingEvidenceCount: missingEvidenceCriterionIds.length,
    passingCriterionIds,
    failingCriterionIds,
    unreviewedCriterionIds,
    missingEvidenceCriterionIds
  };
}

export const knownEvidenceReviewScenarios: EvidenceReviewScenarioName[] = [
  "initial",
  "missing-evidence",
  "failed",
  "accepted"
];

export const knownEvidenceReviewComparisonPairs: EvidenceReviewComparisonPairId[] = [
  "failed-to-accepted",
  "unresolved-missing-evidence"
];

export const evidenceReviewComparisonPairs: Record<
  EvidenceReviewComparisonPairId,
  { previousScenario: EvidenceReviewScenarioName; currentScenario: EvidenceReviewScenarioName }
> = {
  "failed-to-accepted": {
    previousScenario: "failed",
    currentScenario: "accepted"
  },
  "unresolved-missing-evidence": {
    previousScenario: "initial",
    currentScenario: "missing-evidence"
  }
};

const evidenceReviewScenarioStates: Record<EvidenceReviewScenarioName, CriterionReviewState[]> = {
  initial: createInitialCriterionStates(seededEvidenceReview.criteria),
  "missing-evidence": [
    { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: null },
    { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
    { criterionId: "criterion-recovery", verdict: "pass", selectedEvidenceId: "evidence-recovery" }
  ],
  failed: [
    { criterionId: "criterion-payment", verdict: "fail", selectedEvidenceId: "evidence-payment" },
    { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
    { criterionId: "criterion-recovery", verdict: "fail", selectedEvidenceId: "evidence-recovery" }
  ],
  accepted: [
    { criterionId: "criterion-payment", verdict: "pass", selectedEvidenceId: "evidence-payment" },
    { criterionId: "criterion-summary", verdict: "pass", selectedEvidenceId: "evidence-summary" },
    { criterionId: "criterion-recovery", verdict: "pass", selectedEvidenceId: "evidence-recovery" }
  ]
};

export function getEvidenceReviewScenario(scenario: string): EvidenceReviewScenario | null {
  if (!isEvidenceReviewScenarioName(scenario)) {
    return null;
  }

  const states = evidenceReviewScenarioStates[scenario].map((state) => ({ ...state }));
  const criteria = states.map((state) => {
    const criterion = seededEvidenceReview.criteria.find((candidate) => candidate.id === state.criterionId);
    const selectedEvidence =
      seededEvidenceReview.evidence.find((candidate) => candidate.id === state.selectedEvidenceId) ?? null;

    if (!criterion) {
      throw new Error(`Unknown seeded criterion: ${state.criterionId}`);
    }

    return {
      ...state,
      title: criterion.title,
      required: criterion.required,
      selectedEvidence
    };
  });

  return {
    scenario,
    item: seededEvidenceReview,
    states,
    criteria,
    verdict: calculateReviewVerdict(seededEvidenceReview.criteria, states)
  };
}

function isEvidenceReviewScenarioName(scenario: string): scenario is EvidenceReviewScenarioName {
  return knownEvidenceReviewScenarios.includes(scenario as EvidenceReviewScenarioName);
}

export function compareEvidenceReviewScenarios(pair: string): EvidenceReviewComparison | null {
  if (!isEvidenceReviewComparisonPairId(pair)) {
    return null;
  }

  const definition = evidenceReviewComparisonPairs[pair];
  const previousScenario = getEvidenceReviewScenario(definition.previousScenario);
  const currentScenario = getEvidenceReviewScenario(definition.currentScenario);

  if (!previousScenario || !currentScenario) {
    throw new Error(`Invalid seeded comparison pair: ${pair}`);
  }

  return compareEvidenceReviewRuns({
    pair,
    previousScenario,
    currentScenario
  });
}

export function compareEvidenceReviewRuns({
  pair,
  previousScenario,
  currentScenario
}: EvidenceReviewComparisonInput): EvidenceReviewComparison {
  return {
    pair,
    previousScenario: previousScenario.scenario,
    currentScenario: currentScenario.scenario,
    verdictChange: {
      previous: previousScenario.verdict.status,
      current: currentScenario.verdict.status,
      changed: previousScenario.verdict.status !== currentScenario.verdict.status
    },
    criterionChanges: compareCriterionChanges(previousScenario, currentScenario),
    evidenceChanges: compareEvidenceChanges(previousScenario, currentScenario),
    remainingBlockers: findRemainingBlockers(currentScenario)
  };
}

function compareCriterionChanges(
  previousScenario: EvidenceReviewScenario,
  currentScenario: EvidenceReviewScenario
): CriterionChange[] {
  return currentScenario.criteria.flatMap((currentCriterion) => {
    const previousCriterion = previousScenario.criteria.find(
      (candidate) => candidate.criterionId === currentCriterion.criterionId
    );

    if (!previousCriterion || previousCriterion.verdict === currentCriterion.verdict) {
      return [];
    }

    return [
      {
        criterionId: currentCriterion.criterionId,
        title: currentCriterion.title,
        previousVerdict: previousCriterion.verdict,
        currentVerdict: currentCriterion.verdict,
        previousEvidenceId: previousCriterion.selectedEvidenceId,
        currentEvidenceId: currentCriterion.selectedEvidenceId
      }
    ];
  });
}

function compareEvidenceChanges(
  previousScenario: EvidenceReviewScenario,
  currentScenario: EvidenceReviewScenario
): EvidenceChanges {
  const added: AddedEvidenceChange[] = [];
  const replaced: ReplacedEvidenceChange[] = [];
  const removed: RemovedEvidenceChange[] = [];

  for (const currentCriterion of currentScenario.criteria) {
    const previousCriterion = previousScenario.criteria.find(
      (candidate) => candidate.criterionId === currentCriterion.criterionId
    );

    if (!previousCriterion) {
      continue;
    }

    const previousEvidenceId = previousCriterion.selectedEvidenceId;
    const currentEvidenceId = currentCriterion.selectedEvidenceId;

    if (previousEvidenceId === currentEvidenceId) {
      continue;
    }

    if (!previousEvidenceId && currentEvidenceId) {
      added.push({
        criterionId: currentCriterion.criterionId,
        title: currentCriterion.title,
        currentEvidenceId,
        currentEvidenceTitle: evidenceTitle(currentEvidenceId)
      });
      continue;
    }

    if (previousEvidenceId && !currentEvidenceId) {
      removed.push({
        criterionId: currentCriterion.criterionId,
        title: currentCriterion.title,
        previousEvidenceId,
        previousEvidenceTitle: evidenceTitle(previousEvidenceId)
      });
      continue;
    }

    if (previousEvidenceId && currentEvidenceId) {
      replaced.push({
        criterionId: currentCriterion.criterionId,
        title: currentCriterion.title,
        previousEvidenceId,
        previousEvidenceTitle: evidenceTitle(previousEvidenceId),
        currentEvidenceId,
        currentEvidenceTitle: evidenceTitle(currentEvidenceId)
      });
    }
  }

  return { added, replaced, removed };
}

function findRemainingBlockers(currentScenario: EvidenceReviewScenario): RemainingBlocker[] {
  const missingCriterionBlockers = currentScenario.verdict.missingCriterionIds.map((criterionId) => {
    const criterion = scenarioCriterion(currentScenario, criterionId);
    return {
      criterionId,
      title: criterion.title,
      type: "unresolved required proof" as const,
      currentVerdict: criterion.verdict
    };
  });

  const missingEvidenceBlockers = currentScenario.verdict.missingEvidenceCriterionIds.map((criterionId) => {
    const criterion = scenarioCriterion(currentScenario, criterionId);
    return {
      criterionId,
      title: criterion.title,
      type: "missing evidence" as const,
      currentVerdict: criterion.verdict
    };
  });

  return [...missingCriterionBlockers, ...missingEvidenceBlockers];
}

function scenarioCriterion(scenario: EvidenceReviewScenario, criterionId: string): ScenarioCriterionState {
  const criterion = scenario.criteria.find((candidate) => candidate.criterionId === criterionId);

  if (!criterion) {
    throw new Error(`Unknown comparison criterion: ${criterionId}`);
  }

  return criterion;
}

function evidenceTitle(evidenceId: string): string {
  const evidence = seededEvidenceReview.evidence.find((candidate) => candidate.id === evidenceId);

  if (!evidence) {
    throw new Error(`Unknown comparison evidence: ${evidenceId}`);
  }

  return evidence.title;
}

function isEvidenceReviewComparisonPairId(pair: string): pair is EvidenceReviewComparisonPairId {
  return knownEvidenceReviewComparisonPairs.includes(pair as EvidenceReviewComparisonPairId);
}
