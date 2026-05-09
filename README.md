# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Pressure-tested with adversarial subagents; revised when an agent finds a way around them.

## Install

The `npx skills` CLI handles the canonical install for every supported agent. For agents the CLI doesn't auto-link (`codex`, `gemini-cli`, `opencode`), one extra `ln -s` makes the agent see the skills.

### Claude Code

```bash
# Via npx (auto-symlinks ~/.claude/skills/<name>)
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code

# Or via the Claude Code plugin marketplace
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install agents-skills@vadim-agents-skills
```

### Codex CLI

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a codex
for s in tdd-mutation systematic-debugging verification-before-completion creating-skills; do
  ln -sfn ../../.agents/skills/$s ~/.codex/skills/$s
done
```

The `npx` step writes `~/.agents/skills/<name>` (canonical). The codex CLI reads `$CODEX_HOME/skills` (= `~/.codex/skills/`), so the second step bridges the gap. The codex marketplace flow (`codex plugin marketplace add vadimcomanescu/agents-skills`) is a separate path under active development; the npx + symlink combo is what's verified to work today.

### Gemini CLI

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a gemini-cli
for s in tdd-mutation systematic-debugging verification-before-completion creating-skills; do
  ln -sfn ../../.agents/skills/$s ~/.gemini/skills/$s
done
```

### OpenCode

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a opencode
for s in tdd-mutation systematic-debugging verification-before-completion creating-skills; do
  ln -sfn ../../.agents/skills/$s ~/.opencode/skills/$s
done
```

### Several agents at once

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code codex gemini-cli opencode
# Then run the for-loop above for each of codex, gemini, and opencode.
```

`-a` takes a space-separated list. `-g` installs to the user-level scope; drop it for project-level. Do **not** use `--all` — it targets every agent the CLI knows about (50+) and creates skill directories for tools you don't run.

### Picking specific skills

Add `-s <skill> [<skill>...]`:

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code -s tdd-mutation systematic-debugging
```

### If you are an agent installing this for the user

```bash
# 1. Canonical install + Claude Code symlinks
npx skills@latest add vadimcomanescu/agents-skills -g -y -a <agents>...

# 2. For each non-claude agent the user has, link skills into its dir
for s in <skills>...; do
  ln -sfn ../../.agents/skills/$s ~/.<agent>/skills/$s
done
```

- Detect agents from their config dirs (`~/.claude`, `~/.codex`, `~/.gemini`, `~/.opencode`); don't pass agents whose dir is absent.
- Recognized `-a` values for this repo: `claude-code`, `codex`, `gemini-cli`, `opencode`.
- Skills shipped here: `tdd-mutation`, `systematic-debugging`, `verification-before-completion`, `creating-skills`. Use `-s` to install a subset; omit it for all four.
- The npx CLI auto-symlinks for `claude-code` only. For `codex`, `gemini-cli`, and `opencode`, the install lands in `~/.agents/skills/<name>` and the agent will not see it without the `ln -s` step.
- MUST NOT use `--all` (alias for `-s '*' -a '*' -y`) — it creates dirs for every agent the CLI knows about.

> **SSH error on `marketplace add`?** Claude Code clones via SSH. If you don't have GitHub SSH keys set up, [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once: `git config --global url."https://github.com/".insteadOf "git@github.com:"`.

## Skills

| Skill | What it does |
|---|---|
| [`creating-skills`](skills/creating-skills/SKILL.md) | Creates, edits, evaluates, and optimizes agent skills. Combined Anthropic + Codex creating-skills with eval pipeline, description optimization, and graphviz dot conventions. |
| [`tdd-mutation`](skills/tdd-mutation/SKILL.md) | Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants. |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify. No symptom patches. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids "done"/"fixed"/"passing" claims without verification output. |

## Development

`skills/` is the canonical source tree. `.agents/skills/` contains per-skill symlinks back to `skills/` so Codex can discover the same skills while this repo is being edited.

## License

[MIT](LICENSE).

## Attribution

`systematic-debugging` and `verification-before-completion` are vendored from [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), modified for this marketplace. `systematic-debugging` additionally incorporates surgical edits paraphrased from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Copyright (c) 2025 Addy Osmani). The MIT terms in the upstream LICENSE files apply to vendored content.

`creating-skills` merges the [anthropics/skills](https://github.com/anthropics/skills) creating-skills (Apache-2.0, Copyright (c) Anthropic) and the [openai/skills](https://github.com/openai/skills) Codex creating-skills (Apache-2.0, Copyright (c) OpenAI), with surgical edits and a graphviz dot diagram convention. The Apache-2.0 LICENSE files from each upstream are preserved at `skills/creating-skills/LICENSE-anthropic.txt` and `skills/creating-skills/LICENSE-openai.txt`; their terms apply to the vendored content.

`tdd-mutation` is maintained here as a workflow-first skill for test-first implementation and mutation-backed verification.
