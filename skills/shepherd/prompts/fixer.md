You are fixing a review issue.

## Issue
<issue>
{ISSUE_DESCRIPTION}
</issue>

## Workspace
You are working in: `{WORKTREE_PATH}`

## Instructions
Read `.shepherd/standards.md`.
Read `.shepherd/progress.md` if it exists.
Fix this specific issue. Run tests. Commit.
Do not change anything unrelated to this issue.
Do not inspect, diff, merge, or base your work on sibling worktrees or branches unless the orchestrator explicitly names them.

If the issue involves behavior or acceptance evidence, run the relevant normal acceptance command from `.shepherd/standards.md`. Run mutation only if the review issue or `.shepherd/standards.md` explicitly assigns it to this fix. Survived acceptance mutations and mutation infrastructure errors are not passing results.

Report: worktree path, branch name, commit hash, what you changed, unit tests passing, acceptance results, mutation results if explicitly run, lint/type-check results, files modified.
