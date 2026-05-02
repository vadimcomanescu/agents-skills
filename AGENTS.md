# agents-skills

Public skill collection for Claude Code, Codex, Gemini CLI, and OpenCode.

## Layout

```
.claude-plugin/marketplace.json    Claude Code marketplace catalog
.agents/plugins/marketplace.json   Codex marketplace catalog
plugins/<theme>/                   Per-theme plugin manifests (Claude + Codex)
skills/<name>/SKILL.md             Canonical skill content
template/SKILL.md                  Starter template for new skills
scripts/check-consistency.sh       Cross-file consistency lint (runs in CI)
.github/workflows/validate.yml     CI: schema + frontmatter + consistency
```

## Install

```bash
# Claude Code
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install meta@agents-skills
/plugin install engineering@agents-skills

# Codex CLI
codex plugins marketplace add github:vadimcomanescu/agents-skills
codex plugins install meta@agents-skills
codex plugins install engineering@agents-skills

# Gemini CLI / OpenCode (via npx skills)
npx skills@latest add vadimcomanescu/agents-skills -a gemini-cli opencode
```

The `-a` flag is mandatory on `npx skills add` calls. Without it, `npx skills` creates skill directories for every runtime it knows about, including ones not in use. CI rejects PRs with `npx skills add` invocations missing `-a`; see `scripts/check-consistency.sh` check A.

## Before pushing

Run `bash scripts/check-consistency.sh` before pushing to `main`. Consumers `add` the marketplace by pulling from `main`, so a broken state on `main` is a broken state for users. CI runs the same checks; local first catches drift before the gate.

## Adding a new skill

1. Copy `template/SKILL.md` to `skills/<your-skill>/SKILL.md`.
2. Fill in frontmatter `name` and `description`.
3. Reference `./skills/<your-skill>` in the appropriate themed plugin's `skills` array in `.claude-plugin/marketplace.json`. The Codex catalog discovers skills by scanning the plugin source dir; no separate registration is needed there.
4. Bump the `version` in three places, all to the same value:
   - `plugins/<theme>/.claude-plugin/plugin.json`
   - `plugins/<theme>/.codex-plugin/plugin.json`
   - the matching plugin entry in `.claude-plugin/marketplace.json`
   CI rejects mismatches; see `scripts/check-consistency.sh` check B.
5. Add an entry to `CHANGELOG.md`.
6. Run `bash scripts/check-consistency.sh` locally before opening a PR.

## Themes

Current:

- `meta` — agent and skill authoring.
- `engineering` — TDD, systematic debugging, verification before completion.

Add new themed plugins by creating `plugins/<theme>/.claude-plugin/plugin.json` and `plugins/<theme>/.codex-plugin/plugin.json`, then declaring them in both marketplace catalogs.

## Contract for delivering work

The following are explicitly defined as a breach of contract, not a courtesy:

- **MUST finish the work in the same turn.** No "v0", "v1 to follow", "next step for you", "future-self note", or TODO deferred to the user. If a task is genuinely multi-turn (the user must approve a destructive action, the user must provide missing input), MUST say so explicitly and name what is blocking — never leave silently.
- **MUST test the work before claiming completion.** Run the relevant verification (`bash scripts/check-consistency.sh`, the test suite, the type-check, the build, a manual reproduction) and MUST include the output. "Should pass" is not "passes". Same rule as the `engineering:verification-before-completion` skill, applied at every handoff in this repo.
- **MUST NOT ask "want me to do X?" on the obvious finishing move.** When X is the next obvious step of work in progress, just do it. Reserve the offer pattern for genuinely optional follow-ups or for actions with significant blast radius (publishing a release, force-pushing, sending external communications).
- **MUST NOT ship partial work as a deliverable.** If `check-consistency.sh` is failing, the change is not done. If a related drift was created (a new ADR without an index entry, a new plugin without install-doc updates), the change is not done.

This contract is non-negotiable and applies to every task in this repo, regardless of size.

## No shadow canon, no legacy weight

When replacing or removing **anything** from this marketplace — a skill, a plugin theme, a cross-reference, a convention, a scaffold, an example — the old surface MUST be removed entirely. The active marketplace teaches and enforces only what is currently true.

MUST NOT keep:
- Dead skills retained "just in case" (placeholder or scaffold skills kept after real skills land).
- Dangling cross-references with "marked inactive" annotations — either the target skill is imported and the link resolves, or the line is removed.
- Deprecated marketplace entries pointing at deleted directories.
- Legacy versions of a renamed skill kept under the old name as an alias.
- Negative compatibility tests / "old behavior" fixtures unless the user explicitly asks for a supported compatibility window.

When replacing a skill (e.g. an updated version of an obra-vendored skill), the old version MUST be deleted, not kept under a `*-old` name. Use git history if you need to recover.

This rule is the local instance of Vadim's global *No shadow canon* rule (see `~/.claude/CLAUDE.md`). It exists because additive bias — keeping old things "just in case" — is how marketplaces accumulate dead weight that confuses both agents and contributors.

## License

MIT.
