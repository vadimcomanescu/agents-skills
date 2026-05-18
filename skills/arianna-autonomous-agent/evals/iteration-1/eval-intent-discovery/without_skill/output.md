First action: invoke a **scoping/intake process** (sometimes called discovery, charter, or kickoff).

**Discipline enforced:** turn the vague request into a concrete, falsifiable specification. No code, no infra, no tool selection until the ambiguity is removed. The agent interrogates the user (or, if non-interactive, records explicit assumptions) on: target users, core jobs-to-be-done, must-have entities/metrics on the dashboard, auth model, data sources, deployment target, budget/scale, success criteria.

**Gate that must pass before advancing:** a written spec passes an acceptance check — every milestone downstream can cite a specific requirement in it; there are no open `TBD` blockers on scope, data model, or non-functional constraints (auth, hosting, SLAs). If the user is unreachable, the gate is "assumptions are explicit, numbered, and flagged as revisable."

**Artifact on disk:** a project charter / spec file — typically `SPEC.md`, `PROJECT.md`, or `docs/charter.md` at the repo root — containing problem statement, in/out of scope, user stories, data entities, non-functional requirements, milestone breakdown, and the assumptions ledger. This artifact becomes the contract every later phase (architecture, milestones, tests, acceptance) is verified against.
