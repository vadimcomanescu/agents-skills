# Project Plan: arianna-loop

## Architecture Overview

arianna-loop is a **9-skill bundle** implementing a long-running autonomous build pipeline. The architecture is "**thin harness, fat skills**":

- **arianna-loop** (orchestrator) is a thin skill that classifies intent, dispatches role-specialist subagents, manages state in `.agent/`, and renders the dashboard.
- **8 role skills** are fat: each holds the methodology for one role (research, spec writing, designing, planning, implementing, reviewing, critiquing, grilling).

Composition pattern (jarrodwatts): the orchestrator dispatches general-purpose subagents (Claude Code Agent tool / Codex spawn) with prompts pointing at the relevant role skill's `SKILL.md`. Subagents inherit access to all skills, so they pull in `tdd-mutation`, `systematic-debugging`, `verification-before-completion` as referenced from the role skills.

### The 9 skills

| Skill | Role | Invoked | Key methodology |
|---|---|---|---|
| arianna-loop | Orchestrator | Slash `/arianna-loop` | Phase routing, intent classification, dispatch, state files, dashboard rendering |
| arianna-research | Research coordinator | Phase 0 | Parallel topics (coordinator/teammate split per smart-ralph), external-first cross-reference, Quality Commands discovery |
| arianna-spec | Spec writer | Phase 2 | Pocock vocab (Module/Interface/Seam/Depth), decisions-as-paragraphs not formal ADRs, deep-module deletion test |
| arianna-design | Designer | Phase 3 (UI only) | Birchline aesthetic, screens.html generation, aggressively-trimmed screen list, tokens.css |
| arianna-plan | Planner | Phase 4 | Atomic tasks (≤3 files, ≤50 LOC), DAG with depends_on, refactor\|behavior tagging (Beck), parallel-wave estimation |
| arianna-implement | Worker | Phase 5 (autonomous) | TDD per task (refs `tdd-mutation`), evidence capture, `qa-hints.json` "advice letter" output, structured JSON return |
| arianna-review | Judge | Phase 6 (autonomous, per task) | Two-stage (spec-compliance then code-quality) per obra; verbatim test ratchet from Osmani; append-only history-aware log per ralph-to-ralph; refs `systematic-debugging` + `verification-before-completion` |
| arianna-critique | Fresh-subagent critic | Phase 2 + Phase 4 (auto-critic loops) | Stateless per round; READY/REVISED verdict; max 3 rounds at Spec, max 5 at Plan |
| arianna-grill | Interactive grilling | Phase 2 + Phase 4 (post-auto-critic, pre-user-gate) | Adapted from Pocock's grill-with-docs; one question at a time; updates spec.md/tasks.json + CONTEXT.md + docs/adr/ inline |

### Pipeline flow

```
User: /arianna-loop "build me X"
  ↓
Orchestrator: classify intent (LLM call), select phase set per class

HUMAN-IN-LOOP phases (user is at chat; gates are interactive)
  0 Research   → dispatch parallel arianna-research subagents → research.md → ⏸ gate
  1 Discover   → orchestrator asks 1-3 follow-ups → goal.md → ⏸ gate
  2 Spec       → arianna-spec writer
                  → arianna-critique loop ≤3 rounds (auto)
                  → arianna-grill (interactive, updates spec.md + CONTEXT.md + docs/adr/)
                  → ⏸ gate
  3 Design     → arianna-design (UI scope only)
                  → design/screens.html + design/tokens.css → ⏸ gate
  4 Plan       → arianna-plan
                  → arianna-critique plan-editor loop ≤5 rounds (auto)
                  → arianna-grill (interactive)
                  → tasks.json → ⏸ gate  ◄── FINAL HANDOFF

AUTONOMOUS phases (no user, hours-to-days)
  5 + 6 (interleaved per task):
    coordinator picks eligible task (depends_on satisfied, ≤5 in flight)
    spawn worker (arianna-implement, model alternates Claude/Codex per task)
      worker: TDD, captures evidence/<task-id>/, writes qa-hints.json, returns JSON
    spawn judge (arianna-review, fresh subagent; opposite model OR fresh subagent same model)
      stage 1 (spec-compliance) → if pass, stage 2 (code-quality)
      up to 8 review rounds with fix-loop in same worker
      if still red after 8: BLOCKED, log progress.md, continue with non-dependent tasks
    on green: merge worktree → main, delete worktree
  until tasks complete or all remaining blocked

End: dashboard refreshes with status. Code already on main. No final approval gate.
```

### Intent classes → phase set

- **TRIVIAL** → 1, 5, 6
- **REFACTOR** → 0, 1, 2, 4, 5, 6
- **MID_SIZED** → 0, 1, 2, (3 if UI), 4, 5, 6
- **GREENFIELD** → all 7 (0-6)
- **BUG_FIX** → 0, 1 (reproduce-first sub-step), 2, 4, 5, 6

### State files in `.agent/`

**Committed** (lifecycle = source or provenance):
- `research.md`, `goal.md`, `spec.md`, `tasks.json`
- `design/screens.html`, `design/tokens.css` (when UI)
- `implement.md`, `review.md` (orchestrator-written templates the subagents read)
- `dashboard.html` (regenerated per phase; tracked so the artifact shown to the human is preserved)
- `evidence/<task-id>/` (screenshots, traces, goldens, `report.md`, `qa-hints.json`)

**Gitignored** (lifecycle = runtime state):
- `progress.md` (churns rapidly; orchestrator working memory)
- `gates/*.decision.json` (transient back-channel files)
- `*.lock`, `*.log`

**Repo-root** (Pocock convention, not under `.agent/`):
- `CONTEXT.md` (domain language, created lazily by `arianna-grill` when first term is resolved)
- `docs/adr/NNNN-<slug>.md` (ADRs, created lazily, only when hard-to-reverse AND surprising AND real trade-off)

### Dual-model rotation

`tasks.json` has `built_by: claude | codex` field per task. Coordinator alternates per dispatch and records on completion. Judge is always different from `built_by`:
- **Both CLIs installed:** opposite vendor judges
- **Only one CLI installed:** fresh subagent of same vendor (principle: fresh context > different vendor)

### Reviewer design (`arianna-review` — three-source synthesis)

**Two-stage dispatch** (obra pattern):
1. **Stage 1: spec-compliance** subagent (fresh, different model). Does the diff match the plan? Yes/No only.
2. **Stage 2: code-quality** subagent (fresh, runs only if Stage 1 passes). Tests verify real behavior, edge cases, error handling.

**Verbatim anti-cheat lines baked into the prompt:**
- `"You are a DIFFERENT agent from the builder. Do not trust that features work just because passes: true."` — ralph-to-ralph
- `"it is unacceptable to remove or edit tests because this could lead to missing or buggy functionality"` — Osmani test ratchet
- `"HARD STOP: review exactly ONE task per invocation."` — ralph-to-ralph
- `"Verify by reading code, not by trusting report."` — obra
- `"Do not repeat an approach that already failed."` — ralph-to-ralph (history-aware footer)
- `"Strengths first. Calibrated praise helps the implementer trust the rest."` — obra

**Verdict schema** (append-only `.agent/evidence/<task-id>/review-log.json`):

```json
{
  "task_id": "...",
  "stage": "spec_compliance" | "code_quality",
  "attempt": 1,
  "status": "pass" | "fail" | "partial",
  "verdict": "Ready to merge: Yes | No | With fixes",
  "verdict_reasoning": "1-2 sentence summary",
  "strengths": ["..."],
  "issues": [{
    "severity": "critical" | "major" | "minor" | "nit",
    "category": "spec_mismatch" | "missing_test" | "weakened_test" | "edge_case" | "security" | "perf" | "error_handling" | "other",
    "where": {"file": "...", "line": 123, "symbol": "..."},
    "expected": "...",
    "observed": "...",
    "fix": "...",
    "evidence": {"commands": [], "stdout_excerpt": "...", "artifacts": []}
  }],
  "skipped_checks": ["a11y", "security"]
}
```

**Progressive QA modules by task category** (`skills/arianna-review/references/qa-modules/`):
- `auth` → load `security.md` + `api.md`
- `crud` → load `api.md` + `security.md` + `a11y.md`
- `ui` → load `a11y.md`
- `infra` → load `base.md` only

Adapted from `/home/vadim/Code/ralph-to-ralph/ralph/qa/{base,api,security,a11y,footer}.md`. Unloaded modules go in `skipped_checks[]` — explicit, never silent.

### The "advice letter" — `qa-hints.json`

Builder (worker) writes per feature/task:

```json
{
  "feature_id": "...",
  "tests_written": ["...", "..."],
  "needs_deeper_qa": ["Cascade delete behavior (only tested FK presence, not actual cascade)", "..."]
}
```

Judge reads this first and focuses scrutiny on `needs_deeper_qa[]`. Encodes builder honesty cheaply (forces declaration of what wasn't fully verified) and saves reviewer time (skip what's covered).

### Dashboard — Birchline design system (verbatim)

Single self-contained `.agent/dashboard.html`, regenerated by `scripts/render_dashboard.py` at every phase transition. Sections per phase. Current gate highlighted. "Save decision" buttons trigger browser downloads of `<phase>.decision.json`; user moves into `.agent/gates/`; orchestrator polls.

```css
:root {
  /* Colors */
  --ivory:    #FAF9F5;
  --white:    #FFFFFF;
  --slate:    #141413;
  --gray-700: #3D3D3A;
  --gray-500: #87867F;
  --gray-300: #D1CFC5;
  --gray-150: #F0EEE6;
  --clay:     #D97757;  /* primary accent */
  --olive:    #788C5D;  /* success */
  --rust:     #B04A4A;  /* danger */
  --info:     #5C7CA3;

  /* Type — system fonts only */
  --serif: ui-serif, Georgia, "Times New Roman", serif;   /* all headings */
  --sans:  system-ui, -apple-system, sans-serif;           /* body */
  --mono:  ui-monospace, "SF Mono", Menlo, monospace;      /* labels/numbers */

  /* Scale: 4, 8, 12, 16, 24, 32, 48, 64 */
  /* Radius: 4, 8, 12, 20, 999 */
  /* Borders: 1.5px solid var(--gray-300) — NOT 1px (signature) */
}
```

**Layout:** `max-width: 1080-1180px` for dashboards. Two-column main + 300px sticky aside for diagrams. Hover transitions 120ms on `background` / `border-color` only (never `transform-translate`, except `-1px` lift on SVG nodes).

**Per-phase section patterns** (copy from `/tmp/thariq-html/`):
- **Phase cards** ← `11-status-report.html` `.stat-card`: status accent via `border-left: 3-4px solid`; eyebrow `PHASE 03` in mono; metric in serif 44px (print-magazine cue)
- **Task DAG** ← `13-flowchart-diagram.html`: hand-authored inline SVG with `<marker>` arrow defs (gray-500 default / olive success / rust fail); diamonds for gates; paired with 300px sticky aside
- **Design prototype** ← `07-prototype-animation.html`: `grid: 1fr 240px`, `.stage` white card height 360px overflow-hidden, side rail "DialKit"-style; easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Evidence wall** ← `16-implementation-plan.html` `.mock` frame: framed screenshot card with mono uppercase label strip on top; grid `repeat(2, 1fr)` gap 28px
- **Review reports** ← `11-status-report.html` + `16-implementation-plan.html`: eyebrow → serif H1 38px → gray-500 lead → numbered `.num` chips in `--oat` color → risk pills 22px

### Composition with existing repo skills

- `arianna-implement/SKILL.md` references **tdd-mutation** (TDD discipline)
- `arianna-review/SKILL.md` references **systematic-debugging** (diagnostic order) + **verification-before-completion** (evidence before claims)
- `arianna-grill/SKILL.md` adapts (with attribution) Pocock's `grill-with-docs` methodology
- `creating-skills` is used only at authoring time (when writing these skills), not invoked at pipeline runtime

## Decisions log

Load-bearing decisions, sourced:

| Decision | Rationale | Source |
|---|---|---|
| 9 skills (thin orchestrator + 8 fat roles) | "Thin harness, fat skills" per Vadim | Vadim, session 2026-05-11 |
| Orchestrator stays in chat through autonomous run | jarrodwatts model; one task per fresh subagent for context | jarrodwatts SKILL.md:7-13 + Vadim |
| Gates only pre-handoff (0-4); autonomous after Plan | "After approval, you execute autonomously" | jarrodwatts SKILL.md:50 |
| Worktree per parallel task, max 5, merge to main on green | merge-conflict cap | jarrodwatts SKILL.md:113 |
| Test ratchet verbatim in worker prompt | The canonical fix for "agent deletes failing tests" | Osmani, Long-running Agents 2026-04-28 |
| Two-stage reviewer (spec-compliance → code-quality) | Separate generation from evaluation, sequential gating | obra superpowers requesting-code-review |
| qa-hints.json builder→judge "advice letter" | tests_written + needs_deeper_qa surfaces builder honesty cheaply | ralph-to-ralph qa-hints.json |
| Append-only history-aware review log | Prevents repeat-failed-strategy + audit | ralph-to-ralph schemas/qa-report-entry.schema.json |
| grill-me-with-docs at Spec G2 and Plan G4 | Surfaces user's tacit knowledge after auto-critic exhausts | Pocock grill-with-docs + Vadim |
| Pocock vocab (Module/Interface/Seam/Depth/Adapter/Context/Deletion-test) | Domain-modeling substance without DDD academic jargon | Pocock improve-codebase-architecture/LANGUAGE.md |
| CONTEXT.md + docs/adr/ at repo root | Pocock convention; tracked with code | Pocock grill-with-docs/SKILL.md |
| Birchline visual system | "Beautiful like Thariq" | ThariqS/html-effectiveness verbatim tokens |
| Decision back-channel via file download | Async-friendly, no HTTP server, survives reboots | creating-skills eval-viewer + AWS HITL guidance |
| Dual-model judge with fresh-subagent fallback | Principle that matters is fresh context, not vendor | Vadim + trycycle subagent-defaults |
| One feature per worker invocation, then stop | HARD STOP discipline | ralph-to-ralph build-prompt.md:190 |
| Inline trycycle's run_phase.py subset | Avoid hard dep on trycycle | Pragmatic |
| Render dashboard.html via Python stdlib | No JS/npm deps; self-contained file | Birchline + offline |

## Milestones

Five milestones. Tasks within a milestone are parallel-friendly unless marked sequential. Each task: a single file or 2-3 closely related files, plus a brief acceptance signal.

### Milestone 1: Skeleton — all 9 skill directories with valid frontmatter

**Goal:** Each skill exists with a valid `SKILL.md` (frontmatter + 1-line body placeholder) that passes `quick_validate.py`.
**Depends on:** None.
**Parallelism:** All 9 skill inits are independent.

Tasks:
- **1.1** Init `arianna-loop` via `python skills/creating-skills/scripts/init_skill.py arianna-loop --path skills/`. Write frontmatter: `name: arianna-loop`; `description: Long-running autonomous build pipeline orchestrator. Use when user types /arianna-loop <goal>, or asks to "build end-to-end", "long-running build", "autonomous build", "multi-day project". Do not use for trivial one-file edits.`
- **1.2–1.9** Same for each of `arianna-research`, `arianna-spec`, `arianna-design`, `arianna-plan`, `arianna-implement`, `arianna-review`, `arianna-critique`, `arianna-grill`. Description for each = its capability sentence from the skills table above + concrete triggers (the phase it runs in + the dispatch language).
- **1.10** (Sequential after 1.1-1.9) Run `python skills/creating-skills/scripts/quick_validate.py skills/arianna-<name>` for all 9. All must pass.

**Acceptance:** 9 directories exist, each with valid `SKILL.md` frontmatter; `quick_validate.py` clean on all 9.

### Milestone 2: Orchestrator — `arianna-loop` body, scripts, templates

**Goal:** Orchestrator is functional standalone (can be triggered, classifies intent, writes initial `.agent/` files, renders an empty dashboard).
**Depends on:** Milestone 1.

Tasks:
- **2.1** Write `skills/arianna-loop/SKILL.md` body (≤500 lines). Sections: operating idea (jarrodwatts backbone + thin-harness-fat-skills), phase routing logic (intent → phase set table), dispatch instructions (how to invoke each role skill via subagent), state-file conventions (the committed/ignored split), dashboard contract.
- **2.2** Write `skills/arianna-loop/scripts/classify_intent.py`: takes goal text as arg, returns one of {TRIVIAL, REFACTOR, MID_SIZED, GREENFIELD, BUG_FIX} on stdout. Mechanism: small set of regex heuristics over the goal text + fallback to an LLM call (implementation: orchestrator-prompted classification, not a direct API call from the script — script just emits a JSON block the orchestrator interprets).
- **2.3** Write `skills/arianna-loop/scripts/wrap_phase_prompt.py`: takes phase name + state-file paths, emits the dispatch prompt for the subagent (inline subset of trycycle's `run_phase.py` template-rendering logic, ≤80 lines).
- **2.4** Write `skills/arianna-loop/references/templates/implement.md` — template for the `.agent/implement.md` file the orchestrator writes per project. Worker dispatch prompt references `tdd-mutation` skill.
- **2.5** Write `skills/arianna-loop/references/templates/review.md` — template for `.agent/review.md`. Judge dispatch prompt with verbatim Osmani test-ratchet line + reference to `systematic-debugging` and `verification-before-completion`.
- **2.6** Write `skills/arianna-loop/references/templates/dashboard.html` — Birchline skeleton (`<style>` block with all tokens; placeholder sections for each phase; `<script>` only for click-to-detail interactions, no external deps).
- **2.7** Smoke: `quick_validate.py skills/arianna-loop` clean; `classify_intent.py "build a TODO app with Postgres-backed auth"` returns `GREENFIELD`.

**Acceptance:** All files exist, validate clean, smoke commands work.

### Milestone 3: Dashboard renderer + state-file split

**Goal:** `render_dashboard.py` produces a valid Birchline-styled HTML from a synthetic `.agent/` state.
**Depends on:** Milestone 2.

Tasks:
- **3.1** Write `skills/arianna-loop/scripts/render_dashboard.py`. Reads `.agent/*.md`, `.agent/tasks.json`, `.agent/evidence/<id>/report.md` if present. Interpolates `references/templates/dashboard.html`. Embeds inline SVG for the task DAG (hand-codes from `tasks.json` depends_on edges). Outputs `.agent/dashboard.html`.
- **3.2** Write `.gitignore` entries (or update existing one): `.agent/progress.md`, `.agent/gates/`, `.agent/*.lock`, `.agent/*.log`.
- **3.3** Smoke fixture: synthetic `.agent/` with sample `research.md`, `goal.md`, `spec.md`, `tasks.json` (3 tasks, 2 with depends_on). Run renderer. Visually verify the HTML opens, shows 5 phase cards (research/goal/spec/plan/empty-evidence), task DAG with 3 nodes + 2 edges, Birchline colors (`#FAF9F5` body, `#D97757` accent).

**Acceptance:** Renderer runs; output HTML opens in browser and matches Birchline (manual visual check).

### Milestone 4: Role skills — Phase 0-4 (research, spec, design, plan)

**Goal:** Pre-handoff role skills are written and validate clean.
**Depends on:** Milestone 2.
**Parallelism:** 4 independent skills.

Tasks:
- **4.1** `skills/arianna-research/SKILL.md`: parallel coordinator/teammate split methodology (cite smart-ralph); external-first → codebase → cross-reference order; topic decomposition rules (≤5 parallel, one topic per subagent); Quality Commands discovery (jq package.json, grep Makefile/CI); output schema for `research.md` sections (Executive Summary / External Research / Codebase Analysis / Quality Commands / Verification Tooling / Recommendations / Open Questions / Sources).
- **4.2** `skills/arianna-spec/SKILL.md`: Pocock vocab section (Module/Interface/Seam/Depth/Adapter/Context/Deletion-test with one-line definitions + `_Avoid_:` lines, verbatim from Pocock's LANGUAGE.md); spec.md output structure (Concepts → User Stories → Decisions → Modules); ADR-as-paragraph rule (no Status/Considered Options/Consequences by default); deep-module deletion test as the bar; deferred-vs-now decisions.
- **4.3** `skills/arianna-design/SKILL.md`: Birchline aesthetic (reference the dashboard tokens — don't redefine), screens.html generation methodology (single self-contained file, clickable nav between screens, mocked data, no real backend), aggressively-trimmed screen list (one screen per primary user job), gstack skip-by-scope rule for non-UI projects.
- **4.4** `skills/arianna-plan/SKILL.md`: atomic-task rules (≤3 files, ≤50 LOC, single named acceptance test, depends_on satisfied); refactor|behavior tagging (Beck rule, never both in one task); deep-module check applied at task level; parallel-wave estimation; trycycle plan-editor loop rules (5 rounds max, fresh planner per round, READY/REVISED verdict).

**Acceptance:** All 4 skills validate clean; each body <500 lines; cross-references resolve.

### Milestone 5: Role skills — Phase 5-6 + auxiliaries (implement, review, critique, grill)

**Goal:** Autonomous-phase and auxiliary role skills are written and validate clean.
**Depends on:** Milestone 4.
**Parallelism:** 4 skills + 5 QA module files.

Tasks:
- **5.1** `skills/arianna-implement/SKILL.md`: worker workflow (TDD per task, reference `tdd-mutation` skill); evidence capture rules (`evidence/<task-id>/{before.png,after.png,flow.webm,request.http,response.json,golden.json,report.md}`); `qa-hints.json` output schema (verbatim from ralph-to-ralph); HARD STOP rule (one task per invocation); structured JSON return schema.
- **5.2** `skills/arianna-review/SKILL.md`: two-stage methodology; verbatim anti-cheat lines (test ratchet, "DIFFERENT agent from builder", HARD STOP, etc. — all cited); verdict JSON schema; progressive QA modules by task category dispatch logic; references `systematic-debugging` + `verification-before-completion`; append-only log rules.
- **5.3** `skills/arianna-review/references/qa-modules/{base,api,security,a11y,footer}.md`: adapted from `/home/vadim/Code/ralph-to-ralph/ralph/qa/*.md`. Adapt the language to be project-agnostic (remove ralph-to-ralph-specific references like `target-docs/`, `prd.json`, `ever-cli` — replace with arianna-loop conventions: `.agent/spec.md`, `.agent/tasks.json`, `.agent/evidence/<task-id>/`).
- **5.4** `skills/arianna-critique/SKILL.md`: fresh-subagent-per-round discipline; READY/REVISED structured verdict; max-round caps (3 at Spec, 5 at Plan); non-convergence escalation (surface to user when pre-handoff; jarrodwatts log-and-continue when post-handoff but autonomous critique loops don't exist post-handoff anyway).
- **5.5** `skills/arianna-grill/SKILL.md`: adapted from Pocock's `grill-with-docs/SKILL.md`. Verbatim opening prompt (`Interview me relentlessly...`). Pipeline-specific write-back hooks: when a term is resolved, write to `CONTEXT.md` at repo root inline; when a decision crystallises and meets the hard-to-reverse-AND-surprising-AND-real-tradeoff bar, write a new `docs/adr/NNNN-<slug>.md` (lazy creation). Attribute Pocock in a comment at top of `SKILL.md`.

**Acceptance:** All 4 skills + 5 QA module files validate clean; each SKILL.md body <500 lines.

### Milestone 6: Cross-references + smoke test + .gitignore

**Goal:** All skills cross-reference correctly; smoke test runs to research phase.
**Depends on:** Milestone 5.

Tasks:
- **6.1** Audit cross-references: every `arianna-implement` mention of `tdd-mutation`, every `arianna-review` mention of `systematic-debugging`/`verification-before-completion`, every `arianna-grill` reference to `CONTEXT.md`/`docs/adr/` conventions. Confirm targets exist and names match.
- **6.2** Re-run `quick_validate.py` across all 9 skills.
- **6.3** Update `.gitignore` if not done in 3.2: add `.agent/progress.md`, `.agent/gates/`, `.agent/*.lock`, `.agent/*.log`.
- **6.4** Smoke test: simulate `/arianna-loop "build a TODO app with Postgres-backed auth"`. Verify the orchestrator (a) auto-classifies as `GREENFIELD`, (b) writes a draft `.agent/research.md` skeleton showing it would dispatch Phase 0 subagents. Full Phase 0 execution NOT required — orchestrator-mode invocation check only.
- **6.5** Update repo `README.md` if needed to mention `/arianna-loop` (one line under the existing skills list).

**Acceptance:** All 9 skills pass validation; smoke test produces expected `GREENFIELD` classification + research.md skeleton; cross-references resolved.
