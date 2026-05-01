# Third-party notices

This repository vendors content from upstream open-source projects. Per the MIT license, the copyright notices and permission text below MUST be preserved.

## obra/superpowers

The following skills were vendored substantially from <https://github.com/obra/superpowers>:

- `skills/writing-skills/` — full directory copied verbatim with surgical edits documented in [docs/adr/0002-writing-skills-from-obra.md](docs/adr/0002-writing-skills-from-obra.md). Includes:
  - `SKILL.md` (cross-references ported, CSO description rule reconciled, Codex compatibility section added)
  - `anthropic-best-practices.md` (refreshed from <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>; obra's vendored copy was the basis)
  - `persuasion-principles.md` (verbatim)
  - `testing-skills-with-subagents.md` (cross-reference ported)
  - `graphviz-conventions.dot` (verbatim)
  - `render-graphs.js` (verbatim)
  - `examples/CLAUDE_MD_TESTING.md` (verbatim)
- `skills/systematic-debugging/` — full directory copied verbatim, cross-references ported. See [docs/adr/0003-systematic-debugging-imported.md](docs/adr/0003-systematic-debugging-imported.md).
- `skills/verification-before-completion/` — full directory copied verbatim. See [docs/adr/0003-systematic-debugging-imported.md](docs/adr/0003-systematic-debugging-imported.md).

The TDD skill (`skills/test-driven-development/`) draws inspiration from obra's TDD skill but is not a vendored copy. See [docs/adr/0001-tdd-skill-backbone.md](docs/adr/0001-tdd-skill-backbone.md) for the design choices and what was adopted from where.

### License (obra/superpowers)

```
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## addyosmani/agent-skills

The `systematic-debugging` skill in this marketplace incorporates surgical additions paraphrased from <https://github.com/addyosmani/agent-skills/blob/main/skills/debugging-and-error-recovery/SKILL.md> (MIT). Specifically, the inline edits to Phase 1 of `skills/systematic-debugging/SKILL.md` draw on:

- "Stop-the-Line Rule" → preserve-evidence-before-re-running guidance in Step 1
- "Treating Error Output as Untrusted Data" → "errors are clues, not testimony" framing in Step 1
- "Git Bisection" example → wide-regression-range bisect guidance in Step 3
- "Instrumentation Guidelines" → temporary/permanent/unsafe lifecycle paragraph in Step 4

The text was rewritten from scratch against observed pressure-scenario failures rather than copied verbatim. See [docs/adr/0005-systematic-debugging-osmani-additions.md](docs/adr/0005-systematic-debugging-osmani-additions.md) for the experimental rationale.

The README's per-platform install pattern, SSH-key callout, and "skills are executable workflows" framing also draw on addyosmani's repo (already credited in [README.md → Acknowledgments](README.md#skill-marketplace-prior-art)).

### License (addyosmani/agent-skills)

```
MIT License

Copyright (c) 2025 Addy Osmani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Anthropic — Skill authoring best practices

`skills/writing-skills/anthropic-best-practices.md` is sourced from <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices> (refreshed 2026-05-01). Anthropic documentation is generally available under permissive terms for community use. The file is annotated with source URL and refresh date at the top.

## OpenAI — Codex skills documentation

References to <https://developers.openai.com/codex/skills> appear throughout `skills/writing-skills/` for Codex-specific guidance. The Codex documentation is referenced, not vendored.
