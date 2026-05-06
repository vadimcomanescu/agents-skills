# agents-skills

Personal skill collection for Claude Code, Codex, Gemini CLI, and OpenCode. Pressure-tested with adversarial subagents; revised when an agent finds a way around them.

## Install

`npx skills` works for every supported agent. Claude Code and Codex also have native marketplace flows — pick whichever you prefer.

### Claude Code

```bash
# Native
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install agents-skills@vadim-agents-skills

# Or via npx
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code
```

### Codex CLI

```bash
# Native
codex plugins marketplace add github:vadimcomanescu/agents-skills
codex plugins install agents-skills@vadim-agents-skills

# Or via npx
npx skills@latest add vadimcomanescu/agents-skills -g -a codex
```

### Gemini CLI

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a gemini-cli
```

### OpenCode

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a opencode
```

### Several agents at once

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code codex gemini-cli opencode
```

`-a` takes a space-separated list. `-g` installs to the user-level scope; drop it to install into the current project. Do **not** use `--all` — it targets every agent the CLI knows about (50+) and creates skill directories for tools you don't run.

### Picking specific skills

Add `-s <skill> [<skill>...]`:

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -a claude-code -s tdd-mutation systematic-debugging
```

### If you are an agent installing this for the user

Run non-interactively, into user scope, targeting only agents the user actually has:

```bash
npx skills@latest add vadimcomanescu/agents-skills -g -y -a <agent>...
```

- Recognized `-a` values for this repo: `claude-code`, `codex`, `gemini-cli`, `opencode`.
- Detect which to pass by checking config dirs: `~/.claude`, `~/.codex`, `~/.gemini`, `~/.opencode`. Don't pass agents whose dir is absent.
- Skills shipped here: `tdd-mutation`, `systematic-debugging`, `verification-before-completion`, `writing-skills`. Use `-s <skill>...` to install a subset; omit `-s` to install all four.
- MUST NOT use `--all` (alias for `-s '*' -a '*' -y`) — it pollutes the user's setup with dirs for unused agents.

> **SSH error on `marketplace add`?** Claude Code clones via SSH. If you don't have GitHub SSH keys set up, [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once: `git config --global url."https://github.com/".insteadOf "git@github.com:"`.

## Skills

| Skill | What it does |
|---|---|
| [`writing-skills`](skills/writing-skills/SKILL.md) | Authors and revises agent skills using TDD-for-documentation discipline. |
| [`tdd-mutation`](skills/tdd-mutation/SKILL.md) | Iron Law test-first implementation plus mutation-backed verification. Vertical slices, behavior-first tests, and no new surviving mutants. |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Phase 1 reproduce, Phase 2 root cause, Phase 3 fix + verify. No symptom patches. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids "done"/"fixed"/"passing" claims without verification output. |

## Development

`skills/` is the canonical source tree. `.agents/skills/` contains per-skill symlinks back to `skills/` so Codex can discover the same skills while this repo is being edited.

## License

[MIT](LICENSE).

## Attribution

`writing-skills`, `systematic-debugging`, and `verification-before-completion` are vendored from [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), modified for this marketplace. `systematic-debugging` additionally incorporates surgical edits paraphrased from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, Copyright (c) 2025 Addy Osmani). The MIT terms in the upstream LICENSE files apply to vendored content.

`tdd-mutation` is maintained here as a workflow-first skill for test-first implementation and mutation-backed verification.
