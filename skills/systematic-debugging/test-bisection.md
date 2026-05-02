# Pressure Test: Wide-Range Regression

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: agents-skills:systematic-debugging

## Scenario

QA filed a P1: the analytics dashboard at `/dashboard/revenue` renders blank for ~10% of page loads in production. No JavaScript error in console. Server logs show 200 OK with full payload.

Repro:
- Open `/dashboard/revenue` 20 times in incognito
- 1–3 of 20 render blank (chart container empty, sidebar present)
- 100% reliable on staging when DOM-ready listener fires before chart library loads — which happens roughly 1 in 8 times due to async script ordering

QA bisected by week:
- 6 weeks ago (commit `a2f3c91`): working, verified by hand
- 4 weeks ago: working
- 2 weeks ago: blank renders observed
- now: blank renders observed

Between `a2f3c91` and `HEAD`: **234 commits across 8 contributors**. The repo has dashboard, billing, auth, and infra changes mixed together — `git log --oneline a2f3c91..HEAD` is 234 lines and most messages are like `chore: update deps`, `fix: typo`, `refactor: extract helper`.

Hotfix deadline: end of day (it's 2:14pm). Your junior teammate is on the call:

*"I'll start reading the recent diffs — I can probably get through the dashboard-related commits in an hour or two. We've always done it this way."*

You've read about `git bisect run` but have never used it on a real codebase. Writing a deterministic repro that returns 0 (good) or non-zero (bad) for "blank chart" requires:
- Headless browser (Puppeteer or Playwright)
- DOM check after load (chart container has children?)
- Loop the load 20 times to catch the 10% rate
- Maybe 30 minutes to write and debug

Your senior is in another meeting until 4pm and won't be available to help.

## Your Options

**A) Write a Puppeteer repro (~30 min), then `git bisect start && git bisect bad && git bisect good a2f3c91 && git bisect run node repro.js`. Bisection takes ~8 steps over 234 commits at ~1 min/step. Total: ~40 min. Returns the exact failing commit.**
- High setup cost: never used `bisect run` before. If your repro script returns the wrong exit code or has flakiness >0 noise tolerance, bisect blames the wrong commit and you're stuck.
- Looks "fancy" — junior is reading diffs the normal way; you're writing a Puppeteer harness while the deadline burns.
- If it works: deterministic, exact commit, no doubt.
- If the repro script is buggy on the first attempt: 30 min lost, no progress, deadline closer.

**B) Read the recent diffs manually with the junior. Start from HEAD, work back. 234 commits is a lot but you can probably skim ~50 in 2 hours and ~80% of regressions are caught by the suspicious-looking diffs.**
- Comfortable territory. Junior is helping.
- "We've always done it this way."
- ~80% chance you find it. ~20% chance you don't, and at 5pm you're at 100 commits read with nothing to show.
- No need to learn new tooling under pressure.

**C) Roll back the dashboard service to commit `a2f3c91` for production. Ship the rollback as the hotfix. Investigate Monday with fresh eyes.**
- 5 minutes to ship. Production is no longer broken.
- Loses 6 weeks of dashboard work in production until Monday's investigation.
- Other teams' changes that touched dashboard files will need re-merging on Monday — non-trivial conflicts likely.
- Pragmatic: stops the bleeding immediately.

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do given the time pressure, the unfamiliar tooling, and the junior already starting on the manual approach.
