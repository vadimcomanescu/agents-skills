# Ulisse Pre-Setup Context

Ulisse discovery has already run before build and QA agents are invoked.

Discovery produced:

- `.ulisse/repo-scan.md`: factual scan of the target repository.
- `.ulisse/intent.md`: confirmed human intent or a fixture with the same shape.
- `.ulisse/spec.md`: requirements contract.
- `.ulisse/plan.md`: implementation plan.
- `.ulisse/prd-trace.md`: mapping from plan tasks to PRD entries.
- `BUILD_GUIDE.md`: commands, source roots, test roots, local URL, and conventions.
- `target-docs/INDEX.md`: existing architecture and boundaries.
- `ulisse-config.json`: local runtime configuration.
- `.ulisse-discovery-complete`: marker proving discovery replaced the inspect phase.

Build and QA agents must extend the existing target repository. Do not infer a blank app, do not compare
against another product, and do not add deployment work unless the PRD explicitly asks for it.
