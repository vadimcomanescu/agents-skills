# Anti-patterns and fixes

Concrete before/after for every bloat pattern flagged in phase 3. Apply the **After** column directly.

---

## 1. Default-behavior instructions

Telling the agent to do things every modern agent already does. Each one steals an instruction slot from your real custom rules.

**Before**
```markdown
- Write clean, readable code
- Use meaningful variable names
- Handle errors appropriately
- Add comments where the code is complex
- Follow language best practices
- All interactive components must use proper ARIA
- Keyboard navigation must work
```

**After**: delete entirely. Keep only project-specific deviations from default behavior (e.g. "use Radix UI primitives, not custom ARIA").

---

## 2. Hardcoded inventories

Static counts and exhaustive lists go stale within days.

**Before**
```markdown
## Components (47 total)
Button, Input, Select, Dialog, Dropdown, Tooltip, Avatar, Badge, ...
```

**After**
```markdown
## Components
Discover available components: `ls src/components/ui/`
```

---

## 3. Prose where code would work

Verbose descriptions of formats a code block conveys instantly.

**Before** (5 lines)
> Commit messages should follow conventional commits format. The first line should be the type, followed by an optional scope in parentheses, then a colon and space, then a short description in imperative mood…

**After** (2 lines)
```markdown
## Commits
`type(scope): description` — imperative mood, ≤ 72 chars.
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
```

---

## 4. Vague qualifiers

Words that give the model permission to ignore the instruction.

**Before**
```markdown
- Try to use semantic tokens when possible
- Ideally, components should be tested
- Consider using TypeScript strict mode
- You might want to add error handling
```

**After**
```markdown
- Use semantic tokens. Never use raw color scales.
- Test every component. Minimum: render, variant, ref forwarding.
- Enable TypeScript strict mode. No `any`.
- Handle errors with Result types.
```

---

## 5. Meta-instruction prefixes

Preambles that add tokens without meaning.

**Before**
```markdown
- You should always run the type checker before committing
- Remember to use the project's custom ESLint config
- It is important to follow the naming conventions
- Please use the approved icon library
```

**After**
```markdown
- Run `npx tsc --noEmit` before committing
- Use the project ESLint config (do not override)
- Follow naming conventions (see Code Style)
- Use icons from `src/components/ui/icons/`
```

---

## 6. Contradictory rules

Rules that fight each other produce unpredictable behavior.

**Before**
```markdown
## Code Style
- Keep functions under 20 lines
- Always add comprehensive error handling with retry logic

## Performance
- Minimize code in hot paths
- Add detailed logging for every operation
```

**After**: resolve via propose-and-ask, then scope:
```markdown
## Code Style
- Keep functions under 30 lines. Extract helpers for complex logic.

## Hot Paths
- Minimize allocations and logging. Log at `debug` only.

## Non-Hot Paths
- Structured logging at `info`. Retry transient failures with backoff.
```

---

## 7. Missing boundaries

Files that say what TO do but never what NOT to do. Most agent incidents come from unbounded actions, not wrong implementations.

**Before**
```markdown
## Workflow
- Use feature branches
- Write tests for new code
- Run the linter
```

**After**
```markdown
## Workflow
- Use `feature/` branches from `main`
- Write tests for new code (`npx vitest run`)
- Run `npm run lint` before committing

## Boundaries
- Never push directly to `main`
- Never run `git push --force`
- Never modify `.github/workflows/` without approval
- Never add runtime dependencies without checking existing alternatives
- Never delete test files
```

---

## 8. Monolithic files

Everything in a single 500+ line file instead of a layered architecture.

**Before**: one 600-line AGENTS.md including API reference (80 lines), token catalog (60), component props (100), full project history (50).

**After**
```
AGENTS.md (150 lines)          # Core rules, commands, structure
references/
  api-reference.md             # API details
  tokens.md                    # Token catalog
  component-props.md           # Props documentation
docs/adr/                      # Architecture rationale
```

AGENTS.md links to reference files: "See `references/tokens.md` for the token catalog."

---

## 9. Inline rationale

Every rule immediately followed by its justification — doubles file length, and agents act on rules not reasons.

**Before**
```markdown
- Use `vitest` instead of `jest` because vitest has native ESM support,
  faster execution through esbuild, and doesn't require babel for TypeScript.
- Use named exports because they enable better tree-shaking, make refactoring
  easier with find-and-replace, and prevent naming conflicts at import sites.
```

**After** (rules in AGENTS.md, rationale in `docs/adr/`)
```markdown
- Use `vitest` (never `jest`)
- Use named exports (no default exports)
```

---

## 10. Tool-specific lock-in

Only one tool sees the file because the file uses tool-specific naming or syntax.

**Before**: only a `.cursorrules` file, or only a `CLAUDE.md` with Claude-specific tags.

**After**
```bash
# Primary file uses the open standard
AGENTS.md

# Symlinks for tool-specific discovery
ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md .cursorrules
```

Content uses no tool-specific features.

---

## 11. Stale path references

Paths that no longer exist.

**Before**
```markdown
- Tests are in `src/__tests__/`  (directory moved 3 months ago)
- Config is in `config/settings.yaml`  (renamed to `config.yml`)
- See `docs/ARCHITECTURE.md` for details  (file deleted)
```

**After**: verify every path. Prefer runtime discovery:
```markdown
- Tests are co-located: `find src -name '*.test.tsx'`
- Config: `config.yml`
- Architecture: `docs/adr/`
```

---

## 12. Generated content without staleness warning

Including command output without noting it will go stale.

**Before**
```markdown
## Dependencies (from package.json, last updated 2024-01-15)
react: 18.2.0
next: 14.0.4
```

**After**
```markdown
## Dependencies
Check current versions: `cat package.json | jq '.dependencies'`
```

---

## 13. Cross-section duplication

Same command, rule, or fact stated in multiple sections. The most common token waste in AGENTS.md files — each copy looks reasonable in isolation.

**Before** (same commands in 3 sections)
```markdown
## Quick Reference
| Test | `npm run test` |
| Lint | `npm run lint` |

## Verification
npm run test    # All tests pass
npm run lint    # Clean lint

## Quality Gates
| `npm run test` | vitest run |
| `npm run lint` | ESLint check only |
```

**After** (each fact has exactly one home)
```markdown
## Quick Reference
| Test | `npm run test` |
| Lint | `npm run lint` |

## Verification
After every change, run `npm run test:all` (typecheck + lint + tests).
```

**Detection**: for each CLI command, grep the file. If it appears in two or more H2 sections, it's duplicated. Same for stated rules.

---

## 14. Zero-value sections

A section whose entire content is already covered by the quick reference or another section.

**Before**
```markdown
## Quick Reference
| Components | `npm run docs:inventory` or `ls src/components/ui` |

## Component Inventory      <-- adds nothing new
Discover components at runtime:
npm run docs:inventory
ls src/components/ui
```

**After**: delete the zero-value section entirely. If it has one unique fact, fold that fact into the quick reference row.

---

## 15. Unbounded "best practices"

Generic accessibility, generic security, generic performance rules that any modern agent applies by default.

**Before**
```markdown
## Accessibility Requirements
- All interactive components must use proper ARIA
- Keyboard navigation must work
- Focus indicators must be visible
- Screen reader labels must be present
```

**After**: delete. Only keep accessibility rules that are **project-specific**, e.g. "focus ring uses `focus-visible:ring-1` with the project's accent color" or "use Radix UI primitives, not custom ARIA".
