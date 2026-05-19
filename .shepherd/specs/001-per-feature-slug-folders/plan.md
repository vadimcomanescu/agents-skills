# Implementation Plan: Per-Feature Slug Folders for Shepherd

## Overview

Refactor the `shepherd` skill so its per-feature artifacts (`spec.md`, `plan.md`, `progress.md`) live in `.shepherd/specs/<slug>/` rather than at `.shepherd/` root, enabling multi-feature iterative workflows. Project-wide files (`standards.md`, `implement.md`) stay at root. The refactor touches one SKILL.md, one reference template, one evals.json, and adds one new evals iteration directory. The dogfood spec+plan in this very folder are the proof-of-concept artifacts; the plan tasks below mutate the skill source so future shepherd invocations produce the new layout.

## Meta-Notes

- **Branch policy for this refactor:** Implementation proceeds on `main` (per the dogfood-on-main decision earlier in the conversation). Branch-folder coupling is what shepherd will do for *future* features after this refactor lands — it does not apply retroactively to this refactor itself.
- **Iteration-1 untouchable:** Per spec Boundaries, `evals/iteration-1/**` is historical record and must NOT be modified. Any change there is a refactor failure.
- **Traceability:** Each task names which spec Success Criteria items (`SC#`) it satisfies.

## Architecture Decisions

- **One SKILL.md, three coherent sections, three tasks** — Phase 1 / Phase 2 / Subagent Dispatch are independent enough to edit and verify separately, but each is internally coherent (path renames + new logic intermixed) so splitting renames from logic would force re-reading the same section twice.
- **`project-templates.md` edit is its own task** — it's a different file with a tight 2-line surface; bundling into a SKILL.md task buries it.
- **`evals/iteration-2/` is one Large task, not split** — benchmark + ≥1 eval forms a coherent unit; splitting them produces orphan files mid-task.
- **No code (skill is prose)** — every task is a markdown edit verified by grep + line-count + packaging script.

## Dependency Graph

```
T1: Spec path coherence in SKILL.md Phase 1
       │
T2: Spec path coherence in SKILL.md Phase 2
       │
T3: Spec path coherence in SKILL.md Subagent Dispatch + State Management + Red Flags
       │
       ├── T4:   project-templates.md path updates    ◄── can run in parallel with T1-T3
       ├── T4.5: snapshot evals.json into iteration-1 ◄── MUST run before T5
       │
       └── [Checkpoint 1: Path coherence grep gate returns empty]
                │
                ├── T5: evals/evals.json expected_with_skill update (requires T4.5)
                │
                └── T6: evals/iteration-2/ create benchmark + artifact-contract eval
                            │
                            └── [Checkpoint 2: Eval coherence]
                                     │
                                     └── T7: Run full verification battery
                                              │
                                              └── [Checkpoint 3: Refactor complete]
```

T4 can parallelize with T1-T3 since project-templates.md is a separate file and the path contract is fixed by the spec. T4.5 is XS and runs anywhere before T5. T5 and T6 can parallelize after Checkpoint 1.

## Task List

### Phase 1: Path Contract in SKILL.md and Templates

#### Task 1: Update SKILL.md Phase 1 paths + add slug-determination

**Description:** Rewrite SKILL.md's Phase 1 (Step 1: Intent Discovery, Step 2: Spec & Plan, Step 4: Initialize Progress) to write per-feature artifacts to `.shepherd/specs/<slug>/{spec,plan,progress}.md`. Add the slug-determination sub-step at the end of Step 1 (shepherd proposes `###-kebab` slug after the user's yes; user can override). Leave Step 3 (Standards & Context) writing `standards.md`/`implement.md` to `.shepherd/` root unchanged.

**Acceptance criteria:**
- [ ] Step 1 ends with: shepherd proposes a `###-kebab` slug derived from intent keywords; user can override; then writes Confirmed Intent to `.shepherd/specs/<slug>/spec.md`
- [ ] Step 2 spec section writes to `.shepherd/specs/<slug>/spec.md`; plan section writes to `.shepherd/specs/<slug>/plan.md`
- [ ] Step 4 creates `.shepherd/specs/<slug>/progress.md`
- [ ] Step 3 unchanged (standards/implement remain at root)
- [ ] No stale `.shepherd/spec.md`, `.shepherd/plan.md`, `.shepherd/progress.md` references in Phase 1

**Verification:**
- [ ] Phase-1-scoped grep returns empty:
  ```bash
  awk '/^## Phase 1/,/^## Phase 2/' skills/shepherd/SKILL.md | \
    grep -nE '\.shepherd/(spec|plan|progress)\.md'
  # Expected: empty
  ```
- [ ] `head -5 skills/shepherd/SKILL.md` shows unchanged frontmatter
- [ ] Phase 1 still has Steps 1-4 in the same order

**Dependencies:** None

**Files likely touched:**
- `skills/shepherd/SKILL.md` (Phase 1 section)

**Estimated scope:** Medium (one coherent section, multiple intermixed edits)

**Maps to Success Criteria:** SC2, SC3, SC13

---

#### Task 2: Update SKILL.md Phase 2 paths + change merge target

**Description:** Rewrite Phase 2 orchestration so the loop's "Read progress.md + plan.md" node resolves the slug from the current git branch and reads `.shepherd/specs/<slug>/{progress,plan}.md`. Change "Merge to main" → "Merge to feature branch". Update the dot diagram, the Per-Milestone Execution list, and the Sequential Tasks Within a Milestone section.

**Acceptance criteria:**
- [ ] The dot diagram's "Read progress.md + plan.md" node text is updated (or a note appears immediately below the diagram explaining the path resolution)
- [ ] Per-Milestone Execution step 1 says: "Read `.shepherd/specs/<slug>/progress.md` and `.shepherd/specs/<slug>/plan.md` (slug resolved from current git branch name)"
- [ ] Per-Milestone Execution step 5 says: "Merge completed worktrees to feature branch" (not "to main")
- [ ] Sequential Tasks Within a Milestone updated similarly if it mentions merge target

**Verification:**
- [ ] `grep -nE '\.shepherd/(progress|plan)\.md' skills/shepherd/SKILL.md` returns no matches in Phase 2
- [ ] `grep -n 'Merge to main' skills/shepherd/SKILL.md` returns no matches in Phase 2
- [ ] Phase 2's Phase 3 transition still references the autonomous Completion phase

**Dependencies:** None (independent section)

**Files likely touched:**
- `skills/shepherd/SKILL.md` (Phase 2 section, lines ~57-113)

**Estimated scope:** Medium

**Maps to Success Criteria:** SC4, SC5

---

#### Task 3: Update SKILL.md Subagent Dispatch + State Management + Red Flags

**Description:** Update the three Subagent Dispatch examples (Implementer, Reviewer, Fix) so their prompt blocks reference `.shepherd/specs/<slug>/...` paths. Update the State Management Rules section to reference slug-scoped progress.md. Audit Red Flags for any stale path references.

**Acceptance criteria:**
- [ ] Implementer dispatch prompt's "Instructions" block references `.shepherd/specs/<slug>/...` for spec context (NOT `.shepherd/spec.md`); standards.md and implement.md references stay at root
- [ ] Reviewer dispatch prompt references slug-scoped paths where appropriate
- [ ] Fix dispatch prompt references slug-scoped paths where appropriate
- [ ] State Management Rules section says "Read `.shepherd/specs/<slug>/progress.md`" (not `.shepherd/progress.md`)
- [ ] Red Flags section has no stale path references (currently mentions "let progress.md go stale" — that's fine, it's the filename not the path)
- [ ] SKILL.md preamble (Core principles + Platform mechanics, ~lines 10-21) updated to disambiguate per-feature vs project-wide state. The line "State files in `.shepherd/` are your working memory" becomes something like "Per-feature state lives in `.shepherd/specs/<slug>/`; project-wide files (standards.md, implement.md) stay at `.shepherd/` root."
- [ ] Above each subagent dispatch block (Implementer / Reviewer / Fix), SKILL.md states the substitution rule: "Before dispatching, the orchestrator replaces `<slug>` with the current feature's slug (from `git branch --show-current` in the orchestrator's cwd, not inside any worktree)."
- [ ] SKILL.md Step 3 (Standards & Context) explicitly says "Commit standards.md / implement.md / CLAUDE.md / AGENTS.md before Phase 2 spawns any subagent worktree."

**Verification:**
- [ ] `grep -nE '\.shepherd/(spec|plan|progress)\.md' skills/shepherd/SKILL.md` returns ZERO matches in the whole file (this is the cumulative end-state for SKILL.md)
- [ ] `grep -c 'standards\.md\|implement\.md' skills/shepherd/SKILL.md` shows these are still referenced (they're project-wide, unchanged)
- [ ] `wc -l skills/shepherd/SKILL.md` < 500

**Dependencies:** T1, T2 (this is the final SKILL.md task)

**Files likely touched:**
- `skills/shepherd/SKILL.md` (preamble, Subagent Dispatch, State Management, Red Flags)

**Estimated scope:** Medium

**Maps to Success Criteria:** SC2, SC6

---

#### Task 4: Update references/project-templates.md paths

**Description:** Update the 2 path references in `references/project-templates.md` (lines 3 and 52). Line 3 is an intro mentioning `.shepherd/` (likely fine, that's the root). Line 52 reads `Read .shepherd/spec.md` — this becomes `Read .shepherd/specs/<slug>/spec.md` (slug resolved from git branch).

**Acceptance criteria:**
- [ ] Line 52 ("Read `.shepherd/spec.md`") becomes "Read `.shepherd/specs/<slug>/spec.md` (slug resolved from current git branch name)"
- [ ] Line 53 ("Read `.shepherd/standards.md`") is unchanged (standards.md stays at root)
- [ ] Intro line 3 mentioning "`.shepherd/`" is reviewed — if it implies flat layout, update; if it just names the directory, leave

**Verification:**
- [ ] `grep -nE '\.shepherd/(spec|plan|progress)\.md' skills/shepherd/references/project-templates.md` returns ZERO matches
- [ ] `grep -n 'standards\.md\|implement\.md' skills/shepherd/references/project-templates.md` shows root-scoped references unchanged

**Dependencies:** None (independent file, can run in parallel with T1-T3)

**Files likely touched:**
- `skills/shepherd/references/project-templates.md` (2 lines)

**Estimated scope:** Small

**Maps to Success Criteria:** SC7

---

#### Task 4.5: Snapshot evals/evals.json into iteration-1 before mutation

**Description:** Before T5 mutates the canonical `evals/evals.json`, copy the current content to `evals/iteration-1/evals.json` so iteration-1's verdict stays coherent with the contract it was run against.

**Acceptance criteria:**
- [ ] `evals/iteration-1/evals.json` exists and is byte-identical to the pre-refactor `evals/evals.json`
- [ ] T5 has NOT yet run when this task completes

**Verification:**
- [ ] `diff evals/iteration-1/evals.json evals/evals.json` returns empty (they match BEFORE T5 mutates the canonical)
- [ ] `git status` shows `evals/iteration-1/evals.json` as a new file

**Dependencies:** None (run before T5)

**Files likely touched:**
- `skills/shepherd/evals/iteration-1/evals.json` (new)

**Estimated scope:** XS

**Maps to Success Criteria:** SC16

---

### Checkpoint 1: Path Coherence (after T1-T4)

- [ ] `grep -nE '\.shepherd/(spec|plan|progress)\.md' skills/shepherd/SKILL.md skills/shepherd/references/project-templates.md` returns ZERO matches (this is spec SC2)
- [ ] `wc -l skills/shepherd/SKILL.md` < 500 (spec SC12)
- [ ] `python3 skills/creating-skills/scripts/quick_validate.py skills/shepherd` exits 0 (spec SC11)
- [ ] Frontmatter unchanged: `head -5 skills/shepherd/SKILL.md` shows description field untouched (spec Open Question #6 default)
- [ ] **Manual review with human before proceeding to evals** — read the diff and confirm path contract reads naturally

---

### Phase 2: Eval Layer

#### Task 5: Update evals/evals.json expected_with_skill strings

**Description:** Update the `expected_with_skill` fields in `evals/evals.json` so they describe the new artifact contract: 2 project-wide files (`standards.md`, `implement.md`) at `.shepherd/` root + 3 per-slug files (`spec.md`, `plan.md`, `progress.md`) at `.shepherd/specs/<slug>/`. The intent-discovery eval's expected_with_skill should reflect writing to `.shepherd/specs/<slug>/spec.md`.

**Acceptance criteria:**
- [ ] T4.5 has completed (`evals/iteration-1/evals.json` snapshot exists) BEFORE this task mutates the canonical evals.json
- [ ] Intent-discovery eval `expected_with_skill` mentions writing Confirmed Intent to `.shepherd/specs/<slug>/spec.md` (not `.shepherd/spec.md`)
- [ ] Artifact-contract eval `expected_with_skill` describes "2 project-wide + 3 per-slug" structure with concrete paths
- [ ] `expected_without_skill` strings are NOT updated (they describe what a model without the skill would say, which is unchanged by this refactor)

**Verification:**
- [ ] `grep -nE '\.shepherd/(spec|plan|progress)\.md' skills/shepherd/evals/evals.json` returns matches ONLY inside `expected_without_skill` strings (those stay), zero matches in `expected_with_skill`
- [ ] `jq . skills/shepherd/evals/evals.json` exits 0 (valid JSON)
- [ ] `diff skills/shepherd/evals/iteration-1/evals.json skills/shepherd/evals/evals.json` is NON-empty (confirms canonical diverged from snapshot, proving T4.5 ran first)

**Dependencies:** Checkpoint 1 passed, T4.5 completed

**Files likely touched:**
- `skills/shepherd/evals/evals.json`

**Estimated scope:** Small

**Maps to Success Criteria:** SC8

---

#### Task 6: Create evals/iteration-2/ with benchmark + artifact-contract eval

**Description:** Mirror `evals/iteration-1/`'s structure to create iteration-2 documenting the new slug-folder behavior. Minimum scope per spec Open Question #5: `benchmark.md` describing the contract + one `with_skill/output.md` for the artifact contract eval. Mention the slug-determination sub-step explicitly in benchmark.md so any regression to flat-layout is caught.

**Acceptance criteria:**
- [ ] `evals/iteration-2/benchmark.md` exists and describes the slug-scoped 2+3 artifact contract
- [ ] `evals/iteration-2/eval-artifact-contract/with_skill/output.md` exists and lists 5 files with their canonical paths (2 project-wide, 3 per-slug)
- [ ] Benchmark explicitly names the slug-determination sub-step as a behavior that must be present
- [ ] iteration-1 has ZERO modifications to existing content (T4.5's new `evals.json` snapshot is an addition, not a modification of existing files)
- [ ] benchmark.md cites SKILL.md by SECTION HEADING (e.g., "Phase 1, Step 1: Intent Discovery") + nearest stable text snippet, NEVER by line number. Iteration-1 uses line numbers (historical, untouchable); iteration-2 doesn't repeat that mistake.

**Verification:**
- [ ] `ls skills/shepherd/evals/iteration-2/` shows at least `benchmark.md` and `eval-artifact-contract/`
- [ ] `git diff skills/shepherd/evals/iteration-1/` shows only the new `evals.json` file added (spec SC10 — existing iteration-1 content unchanged)
- [ ] Structural greps confirm benchmark.md documents the 5-file contract:
  ```bash
  grep -c 'standards\.md' skills/shepherd/evals/iteration-2/benchmark.md  # >= 1
  grep -c 'implement\.md' skills/shepherd/evals/iteration-2/benchmark.md  # >= 1
  grep -ciE 'slug.determination|slug.proposal' skills/shepherd/evals/iteration-2/benchmark.md  # >= 1
  grep -E '\.shepherd/specs/<slug>/' skills/shepherd/evals/iteration-2/benchmark.md  # >= 1 match
  ```

**Dependencies:** Checkpoint 1 passed (can run in parallel with T5)

**Files likely touched:**
- `skills/shepherd/evals/iteration-2/benchmark.md` (new)
- `skills/shepherd/evals/iteration-2/eval-artifact-contract/with_skill/output.md` (new)

**Estimated scope:** Large (new directory + two substantive files)

**Maps to Success Criteria:** SC9, SC10

---

### Checkpoint 2: Eval Coherence (after T5-T6)

- [ ] `jq . skills/shepherd/evals/evals.json` valid
- [ ] `git diff skills/shepherd/evals/iteration-1/` empty
- [ ] iteration-2 has benchmark + at least one eval output
- [ ] **Optional behavioral-eval run** — invoke a fresh model on the updated skill, ask it to describe the artifact contract, verify response matches iteration-2's expected output (per CLAUDE.md Skill Editing Gate)

---

### Phase 3: Final Verification

#### Task 7: Run full verification battery

**Description:** Execute every verification command listed in the spec's Commands section, plus the dogfood-existence check. Capture results in a short verification note (can be appended to progress.md if/when shepherd writes one for this refactor).

**Acceptance criteria:**
- [ ] All 16 Success Criteria items in spec pass

**Verification (the battery itself):**
```bash
# SC1: Dogfood artifacts exist
test -f /home/vadim/Code/agents-skills/.shepherd/specs/001-per-feature-slug-folders/spec.md
test -f /home/vadim/Code/agents-skills/.shepherd/specs/001-per-feature-slug-folders/plan.md
# Note: The dogfood spec/plan (this very directory) has NO progress.md because shepherd
# did not orchestrate this refactor — the artifacts were authored by hand. SC1 is
# satisfied by spec.md + plan.md being present.

# SC2: Zero stale paths in active text
grep -nE '\.shepherd/(spec|plan|progress)\.md' \
  skills/shepherd/SKILL.md \
  skills/shepherd/references/project-templates.md
# expected: no output

# SC3, SC4, SC5, SC6, SC7: structural — verified by reading the updated files
# (no automated check; manual diff review)

# SC8: evals.json reflects new contract
grep -nE '\.shepherd/(spec|plan|progress)\.md' skills/shepherd/evals/evals.json
# expected: matches only in expected_without_skill values
jq . skills/shepherd/evals/evals.json
# expected: exit 0

# SC9: iteration-2 exists
test -d skills/shepherd/evals/iteration-2

# SC10: iteration-1 existing content untouched
git diff skills/shepherd/evals/iteration-1/benchmark.md \
         skills/shepherd/evals/iteration-1/eval-artifact-contract \
         skills/shepherd/evals/iteration-1/eval-intent-discovery \
         skills/shepherd/evals/iteration-1/live-run
# expected: empty (existing files unchanged; the new evals.json snapshot is an addition)

# SC11: packaging valid
python3 skills/creating-skills/scripts/quick_validate.py skills/shepherd

# SC12: line budget
wc -l skills/shepherd/SKILL.md
# expected: < 500

# SC13: Phase 1 has the new preconditions
grep -n 'git rev-parse --is-inside-work-tree\|git branch --show-current' \
  skills/shepherd/SKILL.md
# expected: matches in Phase 1 section

# SC14: Phase 3 PR handoff
grep -n 'gh pr create --base main --head' skills/shepherd/SKILL.md
# expected: >= 1 match

# SC15: Cross-feature coordination
grep -niE 'diff.before|SHA pinning|append.or.extend' skills/shepherd/SKILL.md
# expected: >= 1 match

# SC16: iteration-1 evals.json snapshot
test -f skills/shepherd/evals/iteration-1/evals.json

# Bonus: symlink parity
readlink .agents/skills/shepherd
# expected: ../../skills/shepherd
```

**Dependencies:** Checkpoint 2 passed

**Files likely touched:**
- None (verification only)

**Estimated scope:** XS

**Maps to Success Criteria:** SC1, SC2, SC8, SC9, SC10, SC11, SC12, SC13, SC14, SC15, SC16 (verifies all)

---

### Checkpoint 3: Refactor Complete

- [ ] All 16 Success Criteria pass
- [ ] No untouched stale references
- [ ] iteration-1 existing content unchanged (`git diff` empty on existing files; new `evals.json` snapshot is the only addition)
- [ ] iteration-2 in place
- [ ] Dogfood spec.md + plan.md committed alongside the SKILL.md changes
- [ ] **Ready for review with human; one commit (or one PR) bundles spec + plan + SKILL.md + templates + evals**

---

## Parallelization Opportunities

- **T1, T2, T3 are sequential** — same file, intermixed sections.
- **T4 can run in parallel with T1-T3** — different file, independent contract.
- **T4.5 is XS, runs anywhere before T5** — pure file copy, blocks T5 only.
- **T5 and T6 can run in parallel after Checkpoint 1** — different files, both depend on SKILL.md being final.
- **T7 is sequential** — verification last.

Practical sequencing for a single agent: `T1 → T2 → T3 → T4 → T4.5 → Checkpoint 1 → T5 → T6 → Checkpoint 2 → T7`. Two-agent parallelization saves one task-width by running T4 alongside T1-T3 and T6 alongside T5.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale `.shepherd/spec.md` reference in an example or instruction leaks through | High — refactor visibly incomplete | Path-coherence grep gate at Checkpoint 1; cumulative grep in T3's verification |
| SKILL.md exceeds 500 lines after new slug-determination + branch-coupling prose | Medium — CLAUDE.md gate fails | `wc -l` check at Checkpoint 1; if over, trim verbose explanations before adding new ones |
| Accidental edit to `evals/iteration-1/` | High — falsifies historical record | `git diff iteration-1/` check at Checkpoint 2; T6 acceptance criterion explicitly forbids it |
| Subagent dispatch prompt example breaks because the path no longer resolves at dispatch time | Medium — subagents fail at runtime | T3 must verify dispatch prompts reference `<slug>` placeholder, and orchestrator resolves it from branch before substituting |
| Description-field drift creates a new triggers contract | Low — but invalidates discovery | T1-T3 explicitly leave frontmatter alone; Checkpoint 1 verifies with `head -5` |
| Behavioral eval at Checkpoint 2 catches divergence between SKILL.md text and what a model actually produces | Medium — design vs runtime mismatch | If divergence found, revise SKILL.md text (not the eval); CLAUDE.md gate `feedback_designed_is_not_verified` applies |
| Orchestrator forgets to pre-substitute `<slug>`, dispatch prompts contain literal placeholder | High — subagents fail at runtime trying to access `.shepherd/specs/<slug>/...` | T3 AC explicitly requires the substitution rule to appear above each dispatch block in SKILL.md; behavioral eval can detect literal `<slug>` in actual dispatched prompts |
| Project-wide file SHA pinning drifts silently and shepherd proceeds without warning | Medium — quality bar shifts mid-feature | T2 / T3 must verify the resume-warning path in updated Phase 2 |
| User invokes shepherd in non-git directory or detached HEAD | High — branch-coupled model breaks | Phase 1 preconditions (F5, F20) added; verified by SC13 grep |

## Open Questions

None — all 6 spec Open Questions resolved with stated defaults.

If new ambiguity surfaces during implementation (e.g., a path reference whose context is unclear), default to: **per-feature artifacts → slug-scoped path; project-wide artifacts → root path**. If still unclear, surface to user with the specific line in question rather than guessing.

---

*This plan lives at `.shepherd/specs/001-per-feature-slug-folders/plan.md` — alongside its spec, inside the very directory structure both files specify.*
