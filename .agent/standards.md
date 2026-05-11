# Project Standards

These standards apply to writing the arianna-magic skill bundle. Subagents implementing tasks read this file before writing any code or markdown.

## SKILL.md conventions (from `skills/creating-skills/SKILL.md`)

- Frontmatter has exactly two fields: `name` (kebab-case, matches directory) and `description` (capability + trigger sentences, <1024 chars, never summarize the workflow)
- Body lives under frontmatter, imperative voice
- Body section order: operating idea → when to use (only if description can't carry triggers) → patterns → decision table (decision-heavy skills) → diagnostic order (symptom-triggered) → verification → anti-patterns → references
- ≤500 lines per `SKILL.md` body. Overflow goes in `references/`.
- Same-bundle file references: relative paths, no `@` prefix (e.g., `references/foo.md` not `@references/foo.md`)
- Cross-skill references: name them plainly (`see the tdd-mutation skill`)

## Pocock style (mandatory across all skills)

- **Lead each major section with a one-sentence bold rule, then unpack in plain prose.** The bold sentence is the whole rule. The next sentence is the gloss.
- **Define every term in one sentence, with a paired `_Avoid_:` line** naming what NOT to use for the same concept.
- **Cite a named book/author in a single blockquote, then drop the formality.** One quote per principle. Then teach.
- **Use everyday phrasing where academia uses Latin.** "Not terribly useful." "Earning its keep." Conversational, not formal.
- **State `why` via a falsifiable test, not theory.** "The deletion test. Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything."
- **Anti-patterns get equal billing with rules.** Named, explicit, with "DO NOT" framing.
- **Reject academic framings in a dedicated section when relevant.** Show what was considered and explicitly dropped.
- **One excellent code example beats five mediocre ones.** Pick the most natural language for the domain.

## What NOT to include

- No `README.md`, `INSTALLATION.md`, `QUICK_REFERENCE.md`, `CHANGELOG.md`, or "how this skill was built" notes
- No auxiliary docs explaining design rationale (that goes in `.agent/plans.md` decisions log, not in the skill)
- No academic vocabulary as load-bearing artifacts: no "ubiquitous language", no "aggregate", no "bounded context" (Pocock retired these). Say "shared language", "context", "module".
- No DDD ceremony as separate phases or files
- No file paths or code snippets in spec.md (Pocock: "they may end up being outdated very quickly") — exception: schemas/state machines that ARE the decision
- No bulk test plans (Pocock: "tests written in bulk test imagined behavior, not actual behavior")
- No interview phase in `arianna-spec` (Pocock to-prd: "Do NOT interview the user — just synthesize what you already know" — the interview happens in `arianna-grill` instead)
- No `// TODO`, no skipped tests, no `any` types, no "fix later"

## Scripts

- Python 3 stdlib only. No `pip install`, no `npm install`, no external packages.
- Bash + Python only; no Node/TypeScript runtime.
- All scripts live in `skills/<name>/scripts/`, executable (`chmod +x`)
- Each script has a one-line `--help` output and a docstring on the first function

## Dashboard HTML

- Self-contained single file. No CDN, no external JS, no web fonts.
- System fonts only (`ui-serif`, `system-ui`, `ui-monospace`).
- Birchline tokens verbatim (see `.agent/plans.md` for the full `:root` block). 1.5px borders (not 1px) — signature move.
- Inline SVG for diagrams (mermaid CLI pre-rendering optional, never required).
- Hover transitions 120ms on `background` / `border-color` only.

## Validation gate (mandatory before marking a task done)

```bash
python skills/creating-skills/scripts/quick_validate.py skills/arianna-<name>
```

Must pass clean. Fix issues and rerun — do not commit a skill that fails validation.

## Cross-references between skills (audit at Milestone 6.1)

- `arianna-implement/SKILL.md` references **tdd-mutation** (existing in `skills/`, do not duplicate its content)
- `arianna-review/SKILL.md` references **systematic-debugging** + **verification-before-completion** (existing, do not duplicate)
- `arianna-grill/SKILL.md` is adapted from Pocock's `grill-with-docs` (external; attribute in a comment at top of `SKILL.md`)
- `arianna-design/SKILL.md` references the Birchline tokens in `arianna-magic/references/templates/dashboard.html` (do not redefine the tokens; reference them)

## Git

- Each commit is a single logical change that validates clean
- Commit messages explain WHY, not WHAT (the diff shows what)
- Conventional-commits format if existing commits in this repo use it (check `git log --oneline -20`)
- No `--no-verify`, no `--amend` over pushed commits

## Self-review before reporting "done"

Before declaring a task complete:
1. Run `quick_validate.py` on the affected skill(s) — must pass
2. Read your own diff — would you approve this in code review?
3. Confirm the task's stated acceptance criteria are met (look at the milestone in `.agent/plans.md`)
4. Confirm cross-references to other skills resolve (`grep -l "tdd-mutation" skills/arianna-implement/SKILL.md` if applicable)
