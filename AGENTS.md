# agents-skills

This file provides guidance to AI coding agents working in this repository.

## Repository Overview

This repository is a personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Skills follow the [Agent Skills specification](https://agentskills.io/specification) and live under `skills/<name>/SKILL.md`.

## Agent Integration

This repo uses a skill-driven authoring model. The source skills in `skills/` are also exposed locally to Codex through `.agents/skills/` so agents can use the repo's own skill-writing workflow while editing this repo.

### Core Rules

- MUST check whether a repository skill applies before editing a skill or implementing behavior.
- MUST use `skills/<name>/SKILL.md` as the canonical source for every skill bundle.
- MUST expose each source skill to local Codex authoring through `.agents/skills/<name> -> ../../skills/<name>`.
- MUST keep `.codex-plugin/plugin.json` pointing at `"skills": "./skills/"` for plugin distribution.
- MUST NOT treat `.agents/skills/` as a second source tree. It is a local discovery surface.

### Intent To Skill Mapping

- MUST use `creating-skills` when creating, editing, or reviewing a skill.
- MUST use `tdd-mutation` when implementing features, fixing bugs, refactoring tested code, changing observable behavior, or checking test strength.
- MUST use `systematic-debugging` when behavior is failing, flaky, unreproduced, or not yet root-caused.
- MUST use `verification-before-completion` before claiming work is done, fixed, passing, or verified.

### Lifecycle Mapping

- DEFINE -> MUST identify the user intent, target behavior, existing concepts to preserve, and failure mode.
- AUTHOR -> MUST edit the smallest skill surface that changes the target behavior.
- IMPLEMENT -> MUST follow `tdd-mutation` for code behavior changes.
- DEBUG -> MUST reproduce and root-cause with `systematic-debugging` before patching.
- VERIFY -> MUST use the relevant skill workflow and report the actual checks run.
- HANDOFF -> MUST use `verification-before-completion` before completion claims.

### Execution Model

For every request:

1. MUST ground every response in a file/code read, a tool output, or current online research before stating it. Do not answer from training data; verify before claiming a fact, or say verification is impossible. This applies to chat answers, design recommendations, and "how X works" explanations — not just code edits.
2. MUST determine whether one of this repo's skills applies.
3. MUST read the applicable skill before editing or implementing.
4. MUST follow the skill workflow instead of summarizing it from memory.
5. MUST preserve the user's requested scope. Do not add tooling, manifests, scripts, or process files unless requested.

### Anti-Rationalization

MUST ignore these thoughts:

- "This is too small for a skill."
- "I can just quickly edit the skill."
- "I remember the workflow."
- "I can improve the process while I am here."

MUST use the skill first, then make the narrow requested edit.

## Repository Layers

These layers have different jobs and must not be confused:

- MUST treat `skills/<name>/SKILL.md` as the source skill body and workflow.
- MUST treat `skills/<name>/references/` as optional on-demand reference material.
- MUST treat `.agents/skills/<name>` as a local Codex symlink to `../../skills/<name>`.
- MUST treat `.codex-plugin/plugin.json` as Codex plugin metadata and skill export configuration.
- MUST treat `.claude-plugin/` as Claude plugin and marketplace metadata.
- MUST treat `.agents/plugins/marketplace.json` as the Codex local marketplace catalog.

Composition rule: the user request is the orchestrator. Skills may reference other skills only when the target workflow requires it.

## Skills

- `creating-skills`: Creates, edits, evaluates, and optimizes agent skills. Combined Anthropic + Codex creating-skills with eval pipeline, description optimization, and graphviz dot conventions.
- `tdd-mutation`: Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants.
- `systematic-debugging`: Phase 1 reproduce, Phase 2 root cause, Phase 3 fix plus verify.
- `verification-before-completion`: No "done", "fixed", or "passing" claims without output.

## Creating Or Editing A Skill

### Directory Structure

```text
skills/
  {skill-name}/
    SKILL.md
    references/       # Optional: on-demand reference material
    scripts/          # Optional: executable helpers when the skill truly needs them
    assets/           # Optional: templates or non-context assets

.agents/
  skills/
    {skill-name} -> ../../skills/{skill-name}
```

### Naming Conventions

- MUST use kebab-case for skill directories.
- MUST name the entrypoint exactly `SKILL.md`.
- MUST match the `name` frontmatter field to the parent directory.
- MUST NOT create `{skill-name}.zip` packages in this repo unless the distribution model changes.

### SKILL.md Format

```markdown
---
name: {skill-name}
description: {Capability sentence. Use when {specific triggers}. Do not use for {boundary}.}
---

# {Skill Title}

## Purpose

{Core operating idea or law.}

## When To Use

{Concrete triggers and non-triggers.}

## Workflow

{Steps the agent must follow after the skill is loaded.}

## References

- `references/{file}.md` - Load when {specific condition}.
```

### Context Efficiency

- MUST keep `SKILL.md` under 500 lines.
- MUST move detailed reference material to `references/`.
- MUST write descriptions as capability plus triggers, not workflow summaries.
- MUST link same-bundle files with relative paths from the skill root.
- MUST explain when to load each referenced file.
- MUST NOT use `@<path>` syntax inside `SKILL.md`.

### Skill Editing Workflow

1. MUST read `agents-skills:creating-skills`.
2. MUST identify the user intent and the behavior the edit must produce.
3. MUST preserve operating laws separately from attribution, examples, or historical source framing.
4. MUST edit only the smallest relevant skill surface.
5. MUST pressure-test discipline-enforcing skill edits when claiming completion.
6. MUST NOT invent scripts, extra manifests, or process files unless the user asks for them.

## Boundaries

- MUST NOT summarize a skill's workflow in its `description` field.
- MUST NOT add a skill that duplicates one already in `skills/` in this repository. Update or extend the existing skill instead.
- MUST NOT preserve removed behavior in active docs, references, examples, or skill text unless the user explicitly asks for compatibility.
- SHOULD use external repo inspection before changing repository layout or plugin metadata.
