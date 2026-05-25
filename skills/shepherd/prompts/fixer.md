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

If the issue involves behavior or acceptance evidence, run the relevant normal acceptance and acceptance mutation commands from `.shepherd/standards.md`. Survived acceptance mutations and mutation infrastructure errors are not passing results.

Report: what you changed, unit tests passing, acceptance results, acceptance mutation results, lint/type-check results, files modified.
