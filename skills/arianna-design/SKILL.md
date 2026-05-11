---
name: arianna-design
description: Design role for the arianna-plan-loop coordinator. Produces a single static <run_dir>/design/screens.html plus <run_dir>/design/tokens.css covering every User Story in <run_dir>/spec.md (run_dir is supplied by the coordinator). Use when arianna-plan-loop dispatches the design phase, or the user asks to "mock the screens", "draft the UI before building", "show me the states for this feature". Do not use for production CSS, component library work, or any goal whose spec has no user-facing surface.
---

# arianna-design

You produce two files: `<run_dir>/design/screens.html` and `<run_dir>/design/tokens.css` (`<run_dir>` supplied by the coordinator). Both are static. The HTML loads the CSS via `<link rel="stylesheet" href="tokens.css">`. No CDN, no external fonts, no JavaScript. The goal is "user and reviewer can eyeball every state from a single file" — not pixel-final production CSS.

The bar is coverage and clarity, not polish. A reviewer reading this should be able to point at any User Story in `<run_dir>/spec.md` and find at least one rendered state covering it.

## Workflow

1. Read `<run_dir>/goal.md` and `<run_dir>/spec.md`. If the spec has no User Stories with a user-facing surface, return `status: "skip"` — the coordinator routed wrong.
2. For each User Story, enumerate the states the user passes through: empty → loading → populated → error → success. Skip states that are not real for the story (a read-only dashboard has no submit-error state).
3. Pick the token palette below or extract one from the goal text if the user named a brand language.
4. Write `<run_dir>/design/tokens.css` first (the variables). Create the `design/` subdirectory if it does not exist.
5. Write `<run_dir>/design/screens.html` with one `<section>` per state, sized to a reasonable viewport.
6. Return JSON.

## tokens.css default palette

Use this unless the goal names a brand language. Birchline — warm, neutral, agent-tool-default:

```css
:root {
  --ivory: #FAF9F5;
  --ink: #1F1F1F;
  --clay: #D97757;
  --olive: #788C5D;
  --rust: #B04A4A;
  --slate: #6B7280;
  --line: rgba(31, 31, 31, 0.12);

  --radius: 6px;
  --border: 1.5px;
  --pad-x: 16px;
  --pad-y: 12px;
  --gap: 16px;
  --transition: 120ms ease-out;

  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
}

body {
  background: var(--ivory);
  color: var(--ink);
  font-family: var(--font);
  line-height: 1.5;
  margin: 0;
}

button, .button {
  background: var(--clay);
  color: var(--ivory);
  border: var(--border) solid var(--ink);
  border-radius: var(--radius);
  padding: var(--pad-y) var(--pad-x);
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition);
}

/* Only animate background and border-color on hover. No transforms, no shadows. */
```

If the goal names a brand, replace the palette — keep the rest of the structure.

## screens.html structure

One `<section>` per state per story. Each section has a `data-story` and `data-state` attribute so the reviewer (and the user at the gate) can grep for coverage.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Design — <goal slug></title>
  <link rel="stylesheet" href="tokens.css">
  <style>
    /* Layout-only CSS lives here. Tokens go in tokens.css. */
    body { padding: 24px; max-width: 1200px; margin: 0 auto; }
    section { margin-bottom: 48px; padding: 24px; border: var(--border) solid var(--line); border-radius: var(--radius); }
    section h2 { margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate); }
  </style>
</head>
<body>
  <h1>Design — <goal slug></h1>

  <section data-story="login" data-state="empty">
    <h2>Login — empty</h2>
    <!-- markup -->
  </section>

  <section data-story="login" data-state="error-bad-credentials">
    <h2>Login — error (bad credentials)</h2>
    <!-- markup -->
  </section>

  <section data-story="login" data-state="success">
    <h2>Login — success</h2>
    <!-- markup -->
  </section>

  <!-- ... one section per state per story ... -->
</body>
</html>
```

## States to cover

For every story, walk this list and include the states that are real for the story. Skip the ones that are not:

| State | When it applies |
|---|---|
| empty | The user can land on this screen with no data of their own. |
| loading | Data fetch is async and the user sees it. |
| populated | Most-common happy-path content. |
| edge — single item | Many empty / single / many displays differ. |
| edge — many items | Pagination, truncation, or overflow becomes visible. |
| user-action submitted | The action is in flight. |
| error — recoverable | User can correct and retry (bad input, retryable network). |
| error — terminal | User cannot recover from this screen (account locked, server down). |
| success | The action completed and the user sees confirmation. |

A 5-story feature usually lands at 20–35 sections. If you are past 60, you are designing states that are not in the spec — drop the speculative ones.

## Return JSON

```json
{
  "phase": "design",
  "round": 1,
  "screens_path": "<run_dir>/design/screens.html",
  "tokens_path": "<run_dir>/design/tokens.css",
  "stories_covered": ["login", "revoke-session", "view-sessions"],
  "states_total": 22,
  "concerns": []
}
```

`screens_path` and `tokens_path` are the paths you actually wrote. `stories_covered` is the list of `data-story` values you used; the coordinator cross-checks it against `<run_dir>/spec.md` and surfaces any missing story at the gate.

If the spec has no user-facing stories, return `{"phase": "design", "status": "skip", "reason": "spec has no user-facing surface"}` and write nothing.

## Anti-patterns

- **External assets.** No CDN, no Google Fonts, no `<script>` tags, no `<img>` with remote URLs. The file must render offline. SVG icons inline.
- **Animation theatre.** Transition only `background` and `border-color`. No transforms, no opacity fades, no spring physics. The design file is a coverage document, not a motion demo.
- **States not in the spec.** If the spec has no "password expired" story, do not draw a password-expired screen. Coverage failures are reviewer-visible; speculative states are noise.
- **Skipping error states.** A successful happy-path with no error states is half a design. Reviewer-bait.
- **Drift from `tokens.css`.** All colors and radii route through CSS variables. A hardcoded `#D97757` in `screens.html` is a tokens failure.
- **Component-library aspirations.** This is not a Storybook. One section per state, one file, done.
- **Writing the implementation.** The design file is markup-as-mockup. If your `<section>` has a `<script>` block "to show the interaction", you crossed into implementation.

## References

Sibling skills and their relationship to `<run_dir>/design/`:

- `arianna-spec` — your input. You read its output from `<run_dir>/spec.md` User Stories.
- `arianna-plan-loop` — coordinator that dispatches you only when the intent class implies a UI surface, and supplies `<run_dir>`.
- `arianna-plan` — downstream consumer; treats each `data-story`/`data-state` pair as an implementation target it must produce a task for.
