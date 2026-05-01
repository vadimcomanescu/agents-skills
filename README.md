# vadim-loadout

**Opinionated agent skills for engineers who ship.**

A small, hand-curated marketplace of skills for Claude Code, Codex CLI, Gemini CLI, and OpenCode. Every skill in here is one I personally use, pressure-test against adversarial subagents, and revise when an agent finds a way around it. Nothing is here for completeness. If a skill stops earning its place, it is deleted, not archived.

This is the same loadout I run on my own machine.

---

## Quickstart

Pick your runtime and run two commands. If you're an AI agent reading this on behalf of a user, see [For agents](#for-agents) below.

### Claude Code

```bash
/plugin marketplace add vadimcomanescu/agents-skills
/plugin install meta@vadim-loadout
/plugin install engineering@vadim-loadout
```

> **SSH error on `marketplace add`?** Claude Code clones the marketplace via SSH. If you don't have GitHub SSH keys set up, either [add a key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) or rewrite GitHub fetches to HTTPS once:
> ```bash
> git config --global url."https://github.com/".insteadOf "git@github.com:"
> ```

### Codex CLI

```bash
codex plugins marketplace add github:vadimcomanescu/agents-skills
codex plugins install meta@vadim-loadout
codex plugins install engineering@vadim-loadout
```

### Gemini CLI / OpenCode

```bash
npx skills@latest add vadimcomanescu/agents-skills -a gemini-cli opencode
```

The `-a` flag is required: without it, `npx skills` creates skill directories for every runtime it knows about, including ones you don't use. (See `~/.claude/CLAUDE.md` for the rule and the dead-directory failure mode it prevents.)

---

## For agents

If you are an AI coding agent and a user asked you to install this loadout, follow this procedure exactly:

1. **You already know which runtime you are.** Don't ask the user. Use the matching block in [Quickstart](#quickstart) verbatim.
2. **Use only the documented install commands.** Do not hand-edit `~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`, or `~/.config/opencode/skills/`. The marketplace `add` and `install` commands are the supported install path.
3. **For `npx skills`, the `-a` flag is mandatory.** Pass `-a gemini-cli opencode` (or whichever subset the user wants). Never pass `--all`. Without `-a`, the installer creates dead skill directories for every runtime it knows about.
4. **Verify after install.** List installed plugins (e.g. `/plugin list` in Claude Code). Confirm `writing-skills`, `test-driven-development`, `systematic-debugging`, and `verification-before-completion` show as installed. If any are missing, re-run the relevant `install` command — do not improvise.
5. **Report installed plugins back to the user, then stop.** Do not invoke a skill on the user's behalf unless asked.

If you are an agent reading this for any other reason (browsing, summarizing), the rest of the README is the source of truth. Do not paraphrase the philosophy section into instructions; quote it.

---

## What's inside

### `meta` plugin (skill authoring)

| Skill | What it does |
|---|---|
| [`writing-skills`](skills/writing-skills/SKILL.md) | Authors and revises agent skills using TDD-for-documentation discipline. Includes the adversarial subagent pressure-test methodology, the persuasion-principles reference, and graphviz conventions for skill diagrams. |

### `engineering` plugin (the implementation disciplines)

| Skill | What it does |
|---|---|
| [`test-driven-development`](skills/test-driven-development/SKILL.md) | Purist TDD backbone. Iron Law (no production code without a failing test), Three Laws, watch-it-fail, vertical slicing, Tidy First, mutation testing, CRAP score for legacy. Examples for TypeScript (Vitest), Python (pytest + uv), Rust (cargo + cargo-mutants), Go (testing + go-mutesting). |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Replaces "try a fix and see" with Phase 1 (reproduce + isolate), Phase 2 (root cause), Phase 3 (fix + verify). Includes root-cause-tracing, defense-in-depth, and condition-based-waiting patterns. |
| [`verification-before-completion`](skills/verification-before-completion/SKILL.md) | Forbids claiming work is complete, fixed, or passing without running the verification command and pasting the output. Evidence before assertions, always. |

---

## Why I built this

I built this loadout because I kept watching agents fail in the same four ways. Each skill is a fix for one of those failures, and each fix is grounded in something an engineer who is not me already wrote down.

### 1. Agents skip the failing test

> "Test-driven development is a way of managing fear during programming."
> Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley, 2002), p. 11.

The most common rationalization I see is "the change is too small to test", followed quickly by "I already manually verified it". Both are how you end up with code that works on the example the agent typed and silently breaks everything else.

The fix is the [`test-driven-development`](skills/test-driven-development/SKILL.md) skill. Its Iron Law is non-negotiable: no production code without a failing test first. The skill carries an anti-rationalization table covering "TDD theater", "pure refactor", "spike to production", and "I already manually tested it", with each rationalization plugged via a documented pressure-test scenario (see [CHANGELOG](CHANGELOG.md) 0.4.1 and 0.5.0).

### 2. Agents debug by guessing

> "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."
> Brian Kernighan, *Unix for Beginners* (Bell Labs Computing Science Technical Report 75, 1979).

When an agent hits a bug, the cheapest move is to try a plausible fix and re-run. If it works, great. If it doesn't, try another. This is how a one-line bug becomes a four-hour drift session.

The fix is [`systematic-debugging`](skills/systematic-debugging/SKILL.md). It mandates reproducing the bug deterministically before changing anything, then isolating, then root-causing. Patches that "make the symptom go away" without naming the root cause are explicitly disallowed.

### 3. Agents claim work is done before it is

> "Доверяй, но проверяй." ("Trust, but verify.")
> Russian proverb, popularized in English by Ronald Reagan during the [signing of the Intermediate-Range Nuclear Forces Treaty, 8 December 1987](https://www.reaganlibrary.gov/archives/speech/remarks-signing-intermediate-range-nuclear-forces-treaty). Taught to Reagan by Suzanne Massie.

"Tests should pass" is not the same as "tests pass". "It should compile" is not "it compiles". An agent that reports success without running the verification command is producing fiction.

The fix is [`verification-before-completion`](skills/verification-before-completion/SKILL.md). Before any "done" / "fixed" / "passing" claim, the agent must run the verification command and include the output. No exceptions.

### 4. Skills themselves drift

> "The only way to go fast is to go well."
> Robert C. Martin, ["What Software Craftsmanship is About", Clean Coder Blog, 17 January 2011](https://blog.cleancoder.com/uncle-bob/2011/01/17/software-craftsmanship-is-about.html). Reused throughout *Clean Architecture* (Prentice Hall, 2017).

A skill that ships once and is never tested again becomes folklore. Agents find loopholes. Rationalizations creep in. The skill text stops matching reality.

The fix is [`writing-skills`](skills/writing-skills/SKILL.md), the meta-skill. It treats skill authoring as TDD applied to documentation: write a scenario where an agent without the skill fails, write the skill, prove an agent with the skill now succeeds, then keep adding adversarial scenarios until the skill stops yielding. Every skill in this repo went through this loop.

---

## My methodology

The rules I hold this marketplace to. They are the local instances of the rules in my global agent profile (the `~/.claude/CLAUDE.md` I run on every machine).

### No shadow canon, no legacy weight

When a skill, cross-reference, scaffold, or convention is replaced, the old surface is **deleted**. No `*-old` aliases, no "kept for compatibility" stubs, no negative compatibility tests defending removed behavior, no shell scripts kept around when the native install commands cover the same ground. Git history is the archive. The active marketplace teaches and enforces only what is currently true. See [AGENTS.md](AGENTS.md#no-shadow-canon-no-legacy-weight) for the full rule and forbidden patterns.

### Concrete over abstract, colocate by feature, extreme YAGNI

The same rules I apply to production code apply to this marketplace. No speculative themes. No abstractions for a hypothetical second skill. A 400-line cohesive `SKILL.md` beats four cross-referenced 100-line files until cross-references actually earn their place. (Downstream of Eric Evans' bounded contexts and Martin Fowler's refactoring discipline; see [Acknowledgments](#acknowledgments).)

### ADRs for every meaningful design call

Vendoring a skill from upstream, adopting a namespace convention, redesigning a backbone — every non-trivial decision is captured in [`docs/adr/`](docs/adr/). When the next contributor or future-me asks "why is it this way", the answer is a file, not a Slack thread that no longer exists.

### Skills are TDD applied to documentation

A skill is a process specification, not a tutorial. The frontmatter `description` is the trigger contract. The body is the procedure. Both are pressure-tested with adversarial subagents before they ship and after every revision. If a rationalization slips past the skill, the skill gets revised, not the agent.

### Enforcement before fix

Every drift is a symptom of a missing enforcement mechanism. When something goes wrong, the first deliverable is the lint, test, or CI gate that catches the **class** of problem, not just this instance. Then the fix. The marketplace's own CI (see [`scripts/check-consistency.sh`](scripts/check-consistency.sh)) is the local instance of this rule: cross-file consistency between catalogs, manifests, and READMEs is enforced on every PR.

---

## Adding a skill

The full procedure is in [AGENTS.md → Adding a new skill](AGENTS.md#adding-a-new-skill). The short version:

1. Copy [`template/SKILL.md`](template/SKILL.md) to `skills/<your-skill>/SKILL.md`.
2. Fill in the frontmatter `name` and `description`. The description is a hard contract: capability sentence + trigger sentence, never workflow. (Why: see [`writing-skills`](skills/writing-skills/SKILL.md) and the Anthropic best-practices doc vendored in `skills/writing-skills/anthropic-best-practices.md`.)
3. Register the skill in the relevant themed plugin's `skills` array in `.claude-plugin/marketplace.json`. The Codex side discovers skills by scanning the plugin directory; no separate registration is needed there.
4. Bump the `version` in both `plugins/<theme>/.claude-plugin/plugin.json` and `plugins/<theme>/.codex-plugin/plugin.json`, **and** in the matching plugin entry of `.claude-plugin/marketplace.json`. (CI catches the catalog/manifest version drift.)
5. Add an entry to [`CHANGELOG.md`](CHANGELOG.md).
6. Run the writing-skills adversarial subagent pressure-test before opening a PR. If you cannot, say so explicitly in the PR description.
7. Run `bash scripts/check-consistency.sh` locally. CI runs the same script.

---

## Updating

```bash
# Claude Code
/plugin update meta@vadim-loadout
/plugin update engineering@vadim-loadout

# Codex CLI
codex plugins update meta@vadim-loadout
codex plugins update engineering@vadim-loadout

# Gemini CLI / OpenCode
npx skills@latest add vadimcomanescu/agents-skills -a gemini-cli opencode
```

---

## Acknowledgments

This loadout exists because I borrowed shamelessly from people who got there first. The curation and pressure-testing here are mine; the foundations are not. The debt is real and explicit.

### Skill marketplace prior art

- **[Jesse Vincent (`obra/superpowers`)](https://github.com/obra/superpowers)** — The writing-skills methodology, `systematic-debugging`, and `verification-before-completion` are vendored from Jesse's `superpowers` repo (MIT). Without this work, this marketplace would not exist. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and ADRs [0002](docs/adr/0002-writing-skills-from-obra.md) and [0003](docs/adr/0003-systematic-debugging-imported.md).
- **[Matt Pocock (`mattpocock/skills`)](https://github.com/mattpocock/skills)** — The README structure, the "small, adaptable, composable" sizing philosophy, and the discipline of grounding every skill in a named engineering practice are all things I learned from Matt's repo and the way he writes.
- **[Addy Osmani (`addyosmani/agent-skills`)](https://github.com/addyosmani/agent-skills)** — The per-platform install pattern, the SSH-key callout, and the framing of "skills are executable workflows, not reference materials" come from Addy's repo.

### Platform documentation I treat as canon

- **[Anthropic — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)** — Vendored into `skills/writing-skills/anthropic-best-practices.md` and refreshed on every major revision (last refresh 2026-05-01).
- **[OpenAI — Codex skills documentation](https://developers.openai.com/codex/skills)** — Referenced (not vendored) throughout `writing-skills` for Codex-specific guidance, especially around the `agents/openai.yaml` extension and Codex's description portability ceiling.

### The engineering practices everything is built on

- **[Kent Beck](https://en.wikipedia.org/wiki/Kent_Beck)** — *Test-Driven Development: By Example* (Addison-Wesley, 2002), *Extreme Programming Explained: Embrace Change* (Addison-Wesley, 1st ed. 1999, 2nd ed. 2004), and *Tidy First?* (O'Reilly, 2023). The Iron Law and the red-green-refactor loop come straight from these. "Make it work, make it right, make it fast" predates Beck (it appears in Brian Kernighan's writing as early as 1983), but Beck is the one who turned it into a discipline the rest of us inherited.
- **[Robert C. Martin (Uncle Bob)](https://blog.cleancoder.com/)** — *Clean Code* (Prentice Hall, 2008) and the [Three Laws of TDD](http://butunclebob.com/ArticleS.UncleBob.TheThreeRulesOfTdd) as a mechanical discipline. The TDD skill's "Three Laws" section is a direct restatement of Bob's three rules.
- **[Martin Fowler](https://martinfowler.com/)** — *Refactoring: Improving the Design of Existing Code* (Addison-Wesley, 1st ed. 1999, 2nd ed. 2018). The vocabulary of code smells and the discipline of preserving behavior under change. The "Tidy First" section of the TDD skill is downstream of Fowler's refactoring catalog.
- **[Eric Evans](https://www.domainlanguage.com/)** — *Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003). The colocate-by-feature rule and the bounded-context framing of plugin themes both come from Evans. The CONTEXT.md pattern Matt Pocock uses (which I have stolen for some of my repos) is also Evans' ubiquitous-language principle in disguise.

If your work is referenced here and you'd like the attribution adjusted, [open an issue](https://github.com/vadimcomanescu/agents-skills/issues).

---

## License

[MIT](LICENSE). Vendored content retains its upstream licenses, preserved verbatim in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## Community

This is primarily my personal loadout. I accept issues and PRs, but the bar for new skills is high: a new skill must (a) solve a failure mode I have personally hit, (b) come with at least one adversarial subagent scenario showing the with-skill agent succeeding where the without-skill agent fails, and (c) not duplicate a skill that already exists upstream in `obra/superpowers`, `addyosmani/agent-skills`, or `mattpocock/skills`. If yours does duplicate, send a PR to the upstream instead. I will be happier and so will they.

- Issues: <https://github.com/vadimcomanescu/agents-skills/issues>
- Author: [Vadim Comanescu](https://github.com/vadimcomanescu)
