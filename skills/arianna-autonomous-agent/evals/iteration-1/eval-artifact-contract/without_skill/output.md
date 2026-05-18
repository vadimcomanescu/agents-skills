Based on general autonomous orchestration principles, the persistence layer needs these files before the first milestone loop iteration:

1. **Plan / roadmap file** (e.g., `PLAN.md` or `milestones.json`) — ordered list of milestones with acceptance criteria. Produced by the planning/decomposition setup step.

2. **Current state pointer** (e.g., `state.json` or `current_milestone`) — which milestone is active, attempt count, status. Produced by the init step that seeds the loop at milestone 0/1.

3. **Configuration / charter** (e.g., `config.yaml`, `CHARTER.md`) — project goal, constraints, model settings, tool allowlist, stop conditions. Produced by the user-input intake / scoping step.

4. **Scratchpad / working memory** (e.g., `NOTES.md`, `scratch/`) — empty but initialized, so the agent has a defined write target. Produced by directory bootstrap.

5. **Log / journal file** (e.g., `journal.ndjson`, `history.log`) — append-only event stream for resumption and audit. Produced by logging-init.

6. **Verification spec** (e.g., `tests/` seed, `acceptance.md`) — how "done" is measured per milestone. Produced by the spec/test-authoring setup step.

7. **Repo workspace** — git-initialized target directory with baseline commit, so diffs and rollback are defined. Produced by workspace bootstrap.

Without all seven, the loop cannot decide what to do, where to write, how to verify, or how to resume.
