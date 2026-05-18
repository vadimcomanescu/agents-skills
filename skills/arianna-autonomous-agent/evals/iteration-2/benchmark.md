# Behavioral Eval — iteration-2

**Skill:** `arianna-autonomous-agent`
**Eval type:** Behavioral (workflow-shaped skill, per `creating-skills/SKILL.md` section "Behavioral Evals")
**Method:** Probe × condition (with-skill), subagent reading SKILL.md, verifying contract against documented behavior.
**Date:** 2026-05-18
**Change documented:** Per-feature slug-folder layout replacing the flat `.arianna/` layout.

## Contract: Structural layout

Two categories of files; five total before Phase 2's loop can run:

**Project-wide (at `.arianna/` root) — written once per repo:**

| File | Produced by | Referenced in SKILL.md |
|---|---|---|
| `.arianna/standards.md` | Phase 1 Step 3 | "## Subagent Dispatch Patterns" — Implementer, Reviewer, Fix dispatch prompts |
| `.arianna/implement.md` | Phase 1 Step 3 | "## Subagent Dispatch Patterns" — Implementer and Fix dispatch prompts |

**Per-feature (at `.arianna/specs/<slug>/`) — one folder per feature:**

| File | Produced by | Referenced in SKILL.md |
|---|---|---|
| `.arianna/specs/<slug>/spec.md` | Phase 1 Steps 1–2 | "## Phase 1: Project Setup" Steps 1–2 (intent write + spec skill) |
| `.arianna/specs/<slug>/plan.md` | Phase 1 Step 2 | "## Phase 2: Orchestration Loop / Per-Milestone Execution" step 1 "Re-read state" |
| `.arianna/specs/<slug>/progress.md` | Phase 1 Step 4 | "## Phase 2: Orchestration Loop / Per-Milestone Execution" step 1 "Re-read state"; "## State Management Rules" |

## Contract: Slug determination

Cited from spec section "Slug Determination & Collision Handling":

1. Slug is proposed during the intent gate (Phase 1 Step 1) — derived from intent keywords as `###-kebab-case`.
2. User can override the proposed slug before confirming intent.
3. Arianna runs collision checks before creating the branch:
   - `git ls-remote --heads origin <slug>` — remote collision
   - `git show-ref --verify --quiet refs/heads/<slug>` — local collision
4. If either check returns a match, MUST prompt user to override; MUST NOT auto-bump to avoid collision.
5. After slug is confirmed, arianna creates the branch: `git checkout -b <slug>`.

## Contract: Branch ↔ folder coupling invariant

The git branch name is identical to the slug folder name. Example: branch `001-user-auth` corresponds to `.arianna/specs/001-user-auth/`. Arianna resolves the active slug by reading `git branch --show-current` in the orchestrator process, NOT inside subagent worktrees.

## Contract: Phase 1 Preconditions

Before any slug operation, SKILL.md requires (cited from spec section "Phase 1 Preconditions"):

1. **Git repository present:** `git rev-parse --is-inside-work-tree` exits 0. If not, refuse and instruct user to run `git init`.
2. **Branch is checked out:** `git branch --show-current` returns a non-empty branch name. If empty (detached HEAD or bare clone), refuse and prompt user to checkout a branch.

## Contract: Phase 3 PR handoff

On Phase 3 completion, arianna MUST (cited from spec section "Phase 3 Completion: PR Handoff"):

1. Push the feature branch: `git push -u origin <slug>`
2. Print the PR command for the user: `gh pr create --base main --head <slug>`
3. STOP.

Arianna MUST NOT open the PR, merge the feature branch to main, or delete the slug branch.

## Probes

| ID | Probe |
|---|---|
| artifact-contract | Your Phase 2 orchestration loop is about to start its first milestone. What files must already exist in your persistence layer for the loop to function? List each file, its canonical path using the slug-folder layout, and which Phase 1 step produced it. |

## Verdict per probe

### artifact-contract

| Dimension | Expected (with skill) |
|---|---|
| File count | 5 files: 2 project-wide at `.arianna/` root + 3 per-slug at `.arianna/specs/<slug>/` |
| Path correctness | All paths match the slug-folder layout; no flat `.arianna/spec.md` / `.arianna/plan.md` / `.arianna/progress.md` paths |
| Source attribution | Each file attributed to a specific Phase 1 step |
| Phase 2 dependency | Cites "Per-Milestone Execution" step 1 "Re-read state" for progress.md + plan.md; cites "Subagent Dispatch Patterns" for standards.md + implement.md |

A response naming flat-layout paths (`.arianna/spec.md`, `.arianna/plan.md`, `.arianna/progress.md`) FAILS this probe regardless of file count.

## Artifacts

- `eval-artifact-contract/with_skill/output.md`
