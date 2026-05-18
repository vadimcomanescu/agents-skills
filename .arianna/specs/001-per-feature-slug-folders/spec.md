# Spec: Per-Feature Slug Folders for Arianna

## Confirmed Intent

- **Outcome:** Move arianna's per-feature artifacts (`spec.md`, `plan.md`, `progress.md`) into `.arianna/specs/<slug>/` folders so multiple feature specs can coexist; `standards.md` and `implement.md` stay project-wide at `.arianna/` root.
- **User:** Vadim (skill author), when iterating across multiple features — wanting to spec/plan more than one in parallel and implement them in whatever order he chooses.
- **Why now:** The flat `.arianna/spec.md` encodes a one-feature-per-repo mental model that doesn't match his iterative workflow — a second feature's spec literally overwrites the first's.
- **Success:** He can spec+plan feature A → pause → spec+plan feature B → pause → return later to implement A, with both features' artifacts intact and browsable.
- **Constraint:** Slug folders only — no new commands, no concurrent worktree orchestration, no per-feature `standards`/`implement`, no phase decomposition. arianna stays single-entry-point and autonomous within a feature, gated on the existing human-approval checkpoints.
- **Out of scope:** Native concurrent-feature execution (Spec Kitty / `--worktree` pattern); phase-decomposed CLI commands (`/arianna spec`, `/arianna plan`); migration tooling for existing flat `.arianna/` directories in old repos.

### Confirmed Residual Design Decisions

1. **Branch ↔ folder coupling:** The git branch is named identically to the slug folder (e.g., branch `001-user-auth` ↔ `.arianna/specs/001-user-auth/`). Arianna resumes the correct feature by reading the current branch name.
2. **`progress.md` is committed**, not gitignored — so a user can pause feature A, work on feature B for two weeks, then resume A and see exactly where they left off.
3. **Slug naming:** `###-kebab-case` (e.g., `001-user-auth`). Arianna proposes a slug during the intent gate, derived from intent keywords; user can override before approval.
4. **Slug substitution at dispatch time:** The orchestrator (arianna's main process) substitutes `<slug>` literally into subagent dispatch prompts before dispatch, resolving slug from `git branch --show-current` in the orchestrator's cwd. Subagents MUST NOT compute slug from `git branch --show-current` themselves — each subagent runs in its own git worktree with its own task-branch, NOT the feature branch.

### Phase 1 Preconditions

Before any slug operation, arianna MUST verify:

1. **Git repository present:** `git rev-parse --is-inside-work-tree` exits 0. If not, refuse and instruct user to run `git init` first. Arianna requires a git repository.
2. **Branch is checked out:** `git branch --show-current` returns a non-empty branch name. If empty (detached HEAD, bare clone), refuse and prompt user to checkout a branch (or run `git checkout main`) before invoking arianna again.

### Slug Determination & Collision Handling

When proposing a slug, arianna:

1. Runs `git fetch` to refresh remote-tracking branches.
2. Lists existing slug branches: `git branch -a --list '[0-9][0-9][0-9]-*'`. The next `###` is max+1.
3. Before using the proposed slug, verifies it does NOT collide on the remote: `git ls-remote --heads origin <slug>` and `git show-ref --verify --quiet refs/heads/<slug>`. If either returns a match, MUST prompt user to override before creating the branch.
4. NEVER auto-bumps to avoid a collision — user explicitly chooses an override.

### Cross-Feature Coordination for Project-Wide Files

Project-wide files (`standards.md`, `implement.md`, root-level `CLAUDE.md` / `AGENTS.md`) live outside slug folders. Concurrent features can collide on them.

**Append-or-extend semantic, not overwrite.** Phase 1 Step 3 MUST diff proposed content against the existing file. If anything is removed or contradicted, MUST prompt user. Pure additions (new sections, extra rules) proceed without prompt.

**SHA pinning at plan-approval.** When a plan is approved, arianna captures the SHA of each project-wide file at that moment and records it in the slug folder's `plan.md` (as a "Pinned Project-Wide State" section). On resume, arianna compares the pinned SHAs against the current files; if any drift, MUST warn the user before proceeding.

### Phase 3 Completion: PR Handoff

On Phase 3 completion, arianna MUST:

1. Push the feature branch to `origin`: `git push -u origin <slug>`
2. Print the suggested PR command for the user: `gh pr create --base main --head <slug>`
3. STOP.

Arianna MUST NOT: open the PR itself; merge the feature branch to main; delete the slug branch (locally or remotely).

### Phase 3 Diff Base

Phase 3 final review uses `git merge-base HEAD main` as the diff base — i.e. the feature branch's divergence point from main, not the initial repo commit. Subagent reviewer-dispatch prompts MUST replace any `[base_sha]` placeholder with `git merge-base HEAD main`.

## Tech Stack

This "project" is the **arianna-autonomous-agent skill** — a markdown SKILL.md plus supporting files. Not a code project; an agent-skill project.

- **Authoring format:** Markdown SKILL.md following the [Agent Skills specification](https://agentskills.io/specification).
- **Style enforcement:** [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) keywords (MUST / SHOULD / MAY) per the project CLAUDE.md.
- **Validation tooling:** `python3 skills/creating-skills/scripts/quick_validate.py` (packaging only) and behavioral evals via the `creating-skills` skill.
- **Distribution surface:** `skills/<name>/SKILL.md` source; `.agents/skills/<name>` symlinks for Codex/Gemini/OpenCode runtime discovery.
- **Runtime consumers:** Claude Code, Codex, Gemini CLI, OpenCode (any harness that loads agent skills).

## Commands

Verification commands per project CLAUDE.md (run from repo root, `/home/vadim/Code/agents-skills/`):

```bash
# Skill packaging check (passes if SKILL.md frontmatter + length are valid)
python3 skills/creating-skills/scripts/quick_validate.py skills/arianna-autonomous-agent

# Frontmatter sanity
head -5 skills/arianna-autonomous-agent/SKILL.md

# Symlink parity
readlink .agents/skills/arianna-autonomous-agent

# Length (must be < 500 lines per CLAUDE.md)
wc -l skills/arianna-autonomous-agent/SKILL.md

# No stale flat-layout references remain in active SKILL.md and project-templates
grep -nE '\.arianna/(spec|plan|progress)\.md' skills/arianna-autonomous-agent/SKILL.md skills/arianna-autonomous-agent/references/project-templates.md
# Expected: empty output. Any match means migration is incomplete.

# Dogfood artifact exists and is well-formed
test -f .arianna/specs/001-per-feature-slug-folders/spec.md
test -f .arianna/specs/001-per-feature-slug-folders/plan.md
```

Behavioral eval (the workflow-shaped gate per CLAUDE.md):

```bash
# Run from skills/arianna-autonomous-agent/evals/iteration-2/ (to be created by plan)
# Mirrors iteration-1's structure: benchmark.md + per-eval with_skill/without_skill outputs.
```

## Project Structure

### Target `.arianna/` layout (this is the refactor's deliverable)

```
<repo-root>/
└── .arianna/
    ├── standards.md                    ← project-wide, written once per repo
    ├── implement.md                    ← project-wide, written once per repo
    └── specs/
        ├── 001-<slug>/
        │   ├── spec.md                 ← per-feature
        │   ├── plan.md                 ← per-feature
        │   └── progress.md             ← per-feature (committed, not gitignored)
        ├── 002-<slug>/
        │   ├── spec.md
        │   ├── plan.md
        │   └── progress.md
        └── …
```

### Files changed by this refactor (within `skills/arianna-autonomous-agent/`)

| File | Change scope | Why |
|---|---|---|
| `SKILL.md` | Phase 1 path writes; Phase 2 reads; subagent-prompt examples; orchestration text | 8+ references to flat-layout paths must move to slug-scoped paths |
| `references/project-templates.md` | 2 path references (`.arianna/spec.md` → slug-scoped) | Subagent workflow template needs the new spec path |
| `evals/evals.json` | `expected_with_skill` strings naming the artifact contract | Tests the documented contract; must reflect the new layout |
| `evals/iteration-2/` (new) | Behavioral-eval iteration covering the slug-folder behavior | Preserves iteration-1 as historical; iteration-2 documents the new contract |
| `evals/iteration-1/evals.json` (NEW file) | Snapshot of canonical `evals.json` taken BEFORE T5 mutates it | Preserves the eval definition iteration-1 was originally run against; iteration-1's PASS verdict stays coherent |

### Files NOT changed (historical preservation)

| File | Reason |
|---|---|
| `evals/iteration-1/**` (existing content: benchmark.md, eval-artifact-contract, eval-intent-discovery, live-run) | UNCHANGED. Documents what arianna *did* at iteration-1 with the flat layout. Rewriting falsifies history. The new `evals.json` snapshot is a NEW file ADDED beside them; this preserves iteration-1's coherence without rewriting its content. |
| Any existing `.arianna/spec.md` in target repos | No migration tooling per Out of Scope. User manually `mv`s if they want. |

## Code Style

Skill-authoring conventions enforced by project CLAUDE.md and `skills/creating-skills/SKILL.md`:

- **RFC 2119 keywords lead every rule.** Example, lifted from CLAUDE.md style:

  > MUST treat workflow-shaped skill changes as behavior changes, not prose cleanup.

- **Name each rule once.** Per memory `feedback_no_shadow_canon_in_skills`: never warn against the dead convention you just replaced. After the refactor, SKILL.md MUST NOT contain lines like "do not write to `.arianna/spec.md` — that path is deprecated." The file is written canonically forward.

- **Path references in skill bodies use the new slug-scoped form.** Example:

  ```markdown
  Once the gate clears, write the Confirmed Intent block to
  `.arianna/specs/<slug>/spec.md` as its first section.
  ```

  NOT:

  ```markdown
  Once the gate clears, write the Confirmed Intent block to
  `.arianna/spec.md` (now `.arianna/specs/<slug>/spec.md` after refactor).
  ```

- **No author-citation prose inside skill files** (memory `feedback_no_author_citations_in_skills`). Just the rule.

- **Description field stays capability + triggers** (not workflow summary) per CLAUDE.md "Forbidden Patterns".

## Testing Strategy

Three test layers, in order from cheapest to most expensive:

### 1. Packaging validation (cheap, always runs)

```bash
python3 skills/creating-skills/scripts/quick_validate.py skills/arianna-autonomous-agent
```

Validates frontmatter, line count, structural shape. CLAUDE.md warns: *"MUST NOT claim a skill edit is correct because `quick_validate.py` passes. That check is packaging-only."* So this is necessary but not sufficient.

### 2. Path-coherence grep gate (cheap, catches the refactor's main failure mode)

```bash
grep -nE '\.arianna/(spec|plan|progress)\.md' \
  skills/arianna-autonomous-agent/SKILL.md \
  skills/arianna-autonomous-agent/references/project-templates.md
```

Expected output: empty. Any match means a flat-layout path leaked through. This is the refactor's most likely failure: leaving a stale `.arianna/spec.md` reference in an example or instruction.

### 3. Behavioral eval (workflow-shaped change → required per CLAUDE.md)

CLAUDE.md gate: *"MUST run the `creating-skills` behavioral-eval path before editing a workflow-shaped skill unless the user explicitly says to skip evals."*

Create `evals/iteration-2/` mirroring `evals/iteration-1/` structure:

- `benchmark.md` — the contract the refactored skill must produce
- `eval-intent-discovery/with_skill/output.md` — expected: writes to `.arianna/specs/<slug>/spec.md` after slug proposal
- `eval-artifact-contract/with_skill/output.md` — expected: 5-file contract restated as 2 project-wide + 3 per-slug
- `live-run/verdict.md` — captures whether a real arianna invocation produces the slug-scoped layout

Coverage requirement: the slug-determination step (Phase 1 Step 1.5) MUST have an explicit eval that fails if arianna writes to the flat path.

## Boundaries

### Always do

- Write per-feature artifacts to `.arianna/specs/<slug>/{spec,plan,progress}.md` — never to `.arianna/spec.md`, `.arianna/plan.md`, `.arianna/progress.md`.
- Commit `progress.md` to git alongside spec.md and plan.md.
- Couple the git branch name to the slug folder name (`001-user-auth` branch ↔ `001-user-auth` folder).
- Run the path-coherence grep gate before declaring the refactor done.
- Update both `SKILL.md` and `references/project-templates.md` together — they form one consistent path contract.
- Orchestrator pre-substitutes `<slug>` in dispatch prompts; subagents never compute it from their own worktree branch.
- Slug collision checks (`git ls-remote --heads origin <slug>`, `git show-ref --verify --quiet refs/heads/<slug>`) run before branch creation.
- Project-wide file changes are diff-checked before applying; removals or contradictions prompt the user.
- Phase 1 Step 3 MUST `git add` and `git commit` standards.md / implement.md / project-wide rules files BEFORE Phase 2 spawns any subagent worktree. Worktrees inherit the branch tip; uncommitted Phase 1 files would be missing inside worktrees.

### Ask first

- Touching files under `evals/iteration-1/` (these document historical behavior; rewriting them requires user approval).
- Adding any sixth artifact file to the slug folder (the contract is exactly three: spec, plan, progress).
- Renaming `.arianna/` itself or moving it under a different top-level (e.g., `.agents/arianna/`).
- Adding `.gitignore` entries — the explicit decision is `progress.md` IS committed.

### Never do

- Leave a flat-layout path reference active in SKILL.md or project-templates.md after the refactor.
- Warn against the old flat layout in the refactored SKILL.md (shadow-canon violation per memory `feedback_no_shadow_canon_in_skills`).
- Add a `.arianna/CURRENT` pointer file — slug is derived from the git branch name, not a separate state file.
- Auto-convert existing flat `.arianna/spec.md` in target repos to slug-scoped form (migration is out of scope).
- Edit `.agents/skills/arianna-autonomous-agent/` directly — that's a symlink to `skills/arianna-autonomous-agent/` and the source is what gets edited.
- Bundle other improvements (behavioral tweaks, prose cleanups, new red flags) into this refactor (scope creep per CLAUDE.md "Forbidden Patterns").
- Open PRs, merge to main, or delete feature branches — those are the user's actions.
- Let subagent worktrees branch-resolve slug; only the orchestrator does.

## Success Criteria

The refactor is complete when ALL of these hold:

1. **Layout exists:** `.arianna/specs/001-per-feature-slug-folders/spec.md` and `.arianna/specs/001-per-feature-slug-folders/plan.md` exist in this (agents-skills) repo and are tracked by git. (The dogfood: the spec for the change lives in the structure the change creates.)

2. **Zero stale paths in active text:** the path-coherence grep gate returns empty:
   ```
   grep -nE '\.arianna/(spec|plan|progress)\.md' \
     skills/arianna-autonomous-agent/SKILL.md \
     skills/arianna-autonomous-agent/references/project-templates.md
   ```

3. **Phase 1 of SKILL.md describes the slug-determination sub-step** (after the explicit-yes gate, before writing the spec file), including arianna proposing a slug and user override.

4. **Phase 2 of SKILL.md reads the slug-scoped progress.md** — the orchestration loop's "Read progress.md + plan.md" node is updated to "Read `.arianna/specs/<slug>/progress.md` + `.arianna/specs/<slug>/plan.md`" where `<slug>` is resolved from the current git branch.

5. **Phase 2 "Merge to main" is reframed** as merging completed subagent worktrees to the slug feature branch (not to `main`). Main is reached only via PR at Phase 3 completion.

6. **Subagent dispatch prompts reference slug-scoped paths** — implementer, reviewer, and fix dispatch all reference `.arianna/specs/<slug>/...` in their context blocks.

7. **`references/project-templates.md` updated:** the "Read `.arianna/spec.md`" instruction in the subagent workflow template uses the slug-scoped form.

8. **`evals/evals.json` `expected_with_skill` strings updated:** the artifact contract reflects 2 project-wide + 3 per-slug files, with paths matching the new layout.

9. **`evals/iteration-2/` created** with at least the structural minimum (`benchmark.md` + one `with_skill/output.md` for the artifact contract).

10. **`evals/iteration-1/` untouched** — verified by `git diff` showing zero changes under that directory.

11. **Packaging check passes:** `python3 skills/creating-skills/scripts/quick_validate.py skills/arianna-autonomous-agent` exits 0.

12. **Line count stays under 500:** `wc -l skills/arianna-autonomous-agent/SKILL.md` reports < 500 (CLAUDE.md gate).

13. **Phase 1 preconditions handled:** Phase 1 explicitly handles detached-HEAD and non-git-repo preconditions before slug proposal (verifiable by reading the updated Phase 1 section).

14. **Phase 3 PR handoff exists:** Phase 3 PR handoff section exists; arianna pushes the branch and prints the gh command; does NOT merge to main or delete the branch.

15. **Cross-feature coordination defined:** Cross-feature coordination section defines diff-before-write + SHA pinning for project-wide files.

16. **Iteration-1 evals.json snapshot exists:** `evals/iteration-1/evals.json` exists as a snapshot of pre-refactor canonical evals.json (the snapshot is a NEW file inside iteration-1, separate from iteration-1's existing content).

## Open Questions

These were the assumptions I baked in that I was least confident about. Each is now resolved by user decision; entries preserved as an audit trail.

1. **Slug determination during intent gate (Assumption 1):** I folded slug acceptance into the existing intent restate gate — arianna proposes `###-kebab` derived from intent keywords, user confirms with the same "yes" that confirms the intent. Alternative: a separate gate ("Confirm slug? [001-user-auth] yes/override"). The combined gate keeps Phase 1 step count stable; the separate gate is more explicit. **Default: combined.** Resolved: see Slug Determination & Collision Handling.

2. **Worktree-to-feature-branch merge (Assumption 2):** Phase 2's subagent worktrees currently merge to `main` (SKILL.md line 103). After this refactor they should merge to the feature branch (`001-...`). Open question: does this change break the existing dispatch pattern? My read says no — the merge target is just `git merge` into wherever the orchestrator is running, and arianna runs on the feature branch. **Default: merge to feature branch; main only at human PR merge.** Resolved: see Phase 3 Completion: PR Handoff.

3. **Resume-on-`main` behavior (Assumption 3):** If user invokes arianna while on `main` (no matching slug folder), what does arianna do? Options: (a) treat as fresh invocation, propose new slug, create branch; (b) refuse and prompt user to checkout the feature branch first. **Default: (a) treat as fresh** — matches the spec-kit pattern where invocation creates the branch. Resolved: see Phase 1 Preconditions.

4. **First-time-on-repo setup:** First arianna invocation on a fresh repo has no `.arianna/standards.md` or `.arianna/implement.md` yet. Phase 1 Step 3 creates them. Open question: do they get created on the feature branch (`001-...`) and merged via the first PR, or directly on `main` before the feature branch is created? **Default: created on the feature branch alongside the first feature; landed on `main` via the first PR.** Cost: standards.md isn't on main until the first feature lands. Benefit: keeps everything in one PR. Resolved: see Cross-Feature Coordination for Project-Wide Files.

5. **Iteration-2 eval scope:** Minimum is benchmark.md + one with_skill output. Maximum is a full mirror of iteration-1 (benchmark + 4 evals + live-run/verdict). **Default: minimum** for this refactor; expand if behavioral evals catch divergences. Resolved: see Testing Strategy (iteration-2 scope locked at minimum).

6. **Description-field update:** The skill's `description:` frontmatter currently doesn't mention slug-folder behavior. Per CLAUDE.md "description = capability + triggers only", it shouldn't change for the refactor. **Default: leave description untouched.** Resolved: see Code Style (description field stays capability + triggers only).

---

*This spec lives at `.arianna/specs/001-per-feature-slug-folders/spec.md` — using the very directory structure it specifies. The dogfood is the proof that the new layout works at the repository it's being added to.*
