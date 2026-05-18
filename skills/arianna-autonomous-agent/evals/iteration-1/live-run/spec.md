# Spec: feature-flag query CLI

## Confirmed Intent

- Outcome: One-line output, copy-pasteable as-is: `flag-name: ON (postgres)` — no headers, no multi-line formatting. Under 2 seconds.
- User: Oncall engineers during prod incidents. That's the target. Anything else is downstream and falls out for free.
- Why now: Friday 4pm billing bug — 20 minutes lost on a single flag-state lookup while revenue was actively on fire.
- Success: Next incident like Friday's, oncall reaches for this instead of grep/SSH; answer in the incident channel in ~2 seconds; if env / Postgres / YAML disagree, the tool shows *all three* so the disagreement is visible — never picks a winner silently.
- Constraint: Read-only against env + Postgres + YAML. Live queries every invocation — no caching, no sync, no "source of truth" pretensions. Ship fast. No new infra to maintain. Don't disrupt existing flag-management workflows.
- Out of scope: Web UI; flag editing; governance/approval; alerting. The browse/onboarding case may eventually become a `flag list` subcommand — but don't let v2 loom over v1.
- Nice-to-have: When a flag's state was last changed, where the source supports it (Postgres has timestamps; env/YAML need git-blame). v1 if cheap, otherwise fast-follow.

<!-- Locked input from interview-me. Do not edit without re-running interview-me. -->
