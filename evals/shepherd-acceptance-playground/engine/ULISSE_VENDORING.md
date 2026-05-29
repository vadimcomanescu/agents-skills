# Ulisse Engine Vendoring

Source: sibling repository `../ralph-to-ralph`, `ralph/` runtime and `schemas/prd-item.schema.json`.

Vendored files:

- `ralph-watchdog.sh` -> `engine/watchdog.sh`
- `build-ralph.sh` -> `engine/build.sh`
- `qa-ralph.sh` -> `engine/qa.sh`
- `lib/agent-runner.sh` -> `engine/lib/agent-runner.sh`
- `pre-setup.md`, `structure-prompt.md`, browser references, and `qa/*.md` -> `engine/`

Intentional Ulisse changes:

- Active runtime paths use `engine/`.
- Runtime config reads `ulisse-config.json`.
- Inspect completion is `.ulisse-discovery-complete`.
- Architecture decisions are written to `engine/architecture-decisions.json`.
- Active build, QA, and architecture prompts are brownfield prompts for extending an existing repo.
- Inspect/live-product scraping behavior is disabled by discovery creating `.ulisse-discovery-complete`
  before the watchdog starts.
- `ULISSE_FIXTURE_ENGINE=1` enables deterministic fixture hooks for local verification only.

Verification:

- `make check` runs shell syntax checks and `./bin/ulisse check-runtime-refs`.
- `./bin/ulisse audit-prompts` rejects active clone-era prompt assumptions.
