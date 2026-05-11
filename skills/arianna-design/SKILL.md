---
name: arianna-design
description: UI designer for Phase 3 of the arianna-magic pipeline. Use when arianna-magic dispatches Phase 3 on a UI-scope project, or the user asks to "design the screens", "mock the UI", "produce screens.html", "show me the design before building". Generates a single self-contained screens.html with Birchline tokens. Do not use for non-UI projects — skip Phase 3 entirely.
---

# arianna-design

## Operating idea

**You produce one self-contained `screens.html` that shows every primary user job as a clickable mock, and nothing else.** Phase 3 exists to let the human see the product before the worker phase commits code that is hard to undo. The artifact is a single file the user opens with `file://`. Mocked data, clickable nav between screens, no real backend, no framework, no build step.

> jarrodwatts: "State files in `.agent/` are your working memory — re-read before every decision." Your decision here is which screens earn their keep. The state file is `.agent/spec.md`.

You do not design components in isolation, you do not write a design system, you do not draft a style guide. You take the user stories from `.agent/spec.md`, pick the screens that carry them, and render those screens in one HTML file that opens locally.

**Falsifiable test.** If `screens.html` requires a server, a CDN, or `npm install` to render, the artifact is broken — open the file directly in a browser and confirm every screen renders and every nav link works.

_Avoid_: "wireframe tool", "design doc", "Figma mock". Say _screens.html_.

### Why one file

Three reasons. First, the user has to open it during a gate, often on a different machine — a single file moves. Second, the artifact is checked into `.agent/design/screens.html`, and review diffs read better when there is one file to diff. Third, the constraints of a single self-contained file enforce the trim — there is nowhere to hide a screen the product does not need.

## When to use

Trigger phrases live in the description. The non-trigger that matters here: **if there is no UI surface, Phase 3 does not run.** This is a project-level scope decision the orchestrator makes when classifying intent; the design skill itself never runs on REFACTOR, BUG_FIX, or TRIVIAL classes, and runs on MID_SIZED only when the goal touches a UI surface.

## Skip-by-scope

**If you were dispatched on a non-UI project, self-cancel and return a no-op verdict.** The orchestrator already filters out REFACTOR / BUG_FIX / TRIVIAL at the routing table, but dispatches go astray. When you load this skill, your first action is to confirm the project has a UI surface. If it does not, write nothing, emit a one-line JSON verdict, and exit.

_Avoid_: "no opinion", "skipped for now", "deferred". Say _no-op_ with reason.

### The check

Read `.agent/goal.md` and `.agent/spec.md`. The project has a UI surface only if at least one of these is true:

- The user stories describe a person clicking, typing, viewing, or navigating in a browser or app.
- The spec names a screen, page, view, form, dashboard, or visible component.
- The tech stack lists a frontend framework, a templating engine, or a static site generator that ships HTML.

If none of these are true, the project is library, CLI, infra, schema migration, or backend-only work. Return:

```json
{
  "phase": "design",
  "status": "no_op",
  "reason": "Project has no UI surface; design phase skipped.",
  "files_written": []
}
```

The orchestrator records the no-op and advances to Phase 4.

**Falsifiable test.** If you produced a `screens.html` for a project whose goal is "convert this Python library to async" or "migrate the Postgres schema", you dispatched on the wrong scope — back up and emit the no-op verdict instead.

## Aesthetic

**Reuse the Birchline tokens from the dashboard template, do not redefine them.** The token block lives in `skills/arianna-magic/references/templates/dashboard.html` in the `:root { ... }` declaration at the top of the `<style>`. Read it once, paste the `:root` block verbatim into `screens.html`, and use the resulting custom properties everywhere. No new color names, no new font stack, no new scale, no new radii.

> "Beautiful like Thariq." Birchline is a verbatim system, not an inspiration. Surface variation belongs in the project's own `tokens.css` (see below), never in screens.html itself.

_Avoid_: "design system", "theme", "look and feel". Say _Birchline tokens_.

### Token contract

The Birchline `:root` block carries:

- Colors — `--ivory`, `--white`, `--slate`, `--gray-700`, `--gray-500`, `--gray-300`, `--gray-150`, `--oat`, `--clay` (primary accent), `--olive` (success), `--rust` (danger), `--info`.
- Type — `--serif` (`ui-serif, Georgia, ...`) for headings, `--sans` (`system-ui, -apple-system, ...`) for body, `--mono` (`ui-monospace, "SF Mono", ...`) for labels and numbers. System fonts only. No web fonts. No `@import`.
- Scale — 4, 8, 12, 16, 24, 32, 48, 64 px.
- Radius — 4, 8, 12, 20, 999 px.
- Borders — `1.5px solid var(--gray-300)`. Signature move. Never 1px. Never 2px.

**Falsifiable test.** Open `screens.html`, inspect any visible border in dev tools. If it reads `1px solid` or `2px solid`, the artifact has drifted off Birchline — fix the border to `1.5px` and re-render.

### Surface rules

- Body: `background: var(--ivory)`. Ivory paper, not white. White is reserved for cards.
- Cards: `background: var(--white)`, `border: 1.5px solid var(--gray-300)`, `border-radius: 12px`.
- Headings: serif, weight 500, letter-spacing -0.01em. Never bold weight 700 in serif.
- Body text: sans, 15px, line-height 1.6, color `var(--slate)`.
- Eyebrows and labels: mono, 11px, uppercase, letter-spacing 0.08em, color `var(--gray-500)`.
- Status accents: thin colored stripe via `border-left: 3-4px solid` in `--clay` / `--olive` / `--rust`.
- Hover transitions: 120ms on `background` and `border-color` only. Never `transform`. Never `transition: all`.

_Avoid_: "shadow elevation", "raised cards". Use the 1.5px border for hierarchy, not box-shadow.

## Screen list

**One screen per primary user job. If a screen can be cut and the user still gets the job done, cut it.** This is the deletion test, applied at the screen level. The deletion test is borrowed from Pocock's deep-module rule: imagine deleting the thing; if the rest of the system still works, the thing was not earning its keep.

> Pocock: "Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything."

_Avoid_: "we'll need a settings page", "users will expect a profile screen", "let's add an admin view for later". The trim is aggressive on purpose.

### How to pick screens

1. Read `.agent/spec.md`. List the user stories. Each story has a verb — _create_, _view_, _edit_, _delete_, _approve_, _share_.
2. Group stories by the screen that carries them. A single screen often carries multiple verbs (list + create + edit live on the same screen most of the time).
3. Apply the deletion test to every screen on the list. Ask: if I delete this screen, can the user still complete the job through another screen on the list? If yes, delete it.
4. Stop when every remaining screen is the only place a job can be done.

### Screens to reject by default

- **Settings.** Reject unless the spec names a specific configurable behavior the user changes at runtime.
- **Profile.** Reject unless identity is a primary user job (auth flows live in their own screen if they exist at all).
- **Dashboard / overview.** Reject unless the spec names a metric the user must monitor; "summary of everything" is not a user job.
- **Admin.** Reject unless an admin role is a named user in the spec.
- **Help / docs / onboarding.** Reject. Documentation lives outside the product.
- **Empty state placeholders as separate screens.** Empty states belong inside the screen that lists data, not as their own screen.

**Falsifiable test.** Count the screens. If the count is more than the count of distinct user jobs in `.agent/spec.md`, you are bloating — trim until the counts match.

### Screens to keep

A screen earns its keep when at least one of these is true:

- It is the only place a named user story completes.
- It carries a distinct nav target that other screens link to (e.g. detail view from a list).
- It carries a hard state transition the user explicitly drives (e.g. checkout, publish, submit).

If a "screen" only carries a modal or a sub-state of another screen, render it inline on the parent, not as a separate clickable screen.

## screens.html structure

**The file is one HTML page that switches between screen views via in-page anchor nav, with mocked data inline.** No router, no JS framework, no fetch. The user clicks a nav link, the visible screen container changes via `:target` CSS or the smallest vanilla-JS toggle, and the previously visible screen hides.

_Avoid_: "SPA shell", "client router", "data fetcher". Say _in-page nav_.

### File layout

```text
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ project_title }} — design</title>
  <style>
    :root { /* Birchline tokens, verbatim from dashboard.html */ }
    /* layout, screen container rules, nav rules */
  </style>
</head>
<body>
  <nav class="screen-nav">
    <a href="#screen-1">Screen 1 name</a>
    <a href="#screen-2">Screen 2 name</a>
    ...
  </nav>

  <main>
    <section id="screen-1" class="screen">
      <!-- Screen 1 markup with mocked data -->
    </section>
    <section id="screen-2" class="screen">
      <!-- Screen 2 markup with mocked data -->
    </section>
    ...
  </main>

  <script>
    // Optional: minimal toggle for showing the targeted screen.
    // Keep under 30 lines. No imports.
  </script>
</body>
</html>
```

### Visibility mechanism

Two acceptable patterns, pick one per project:

1. **`:target` CSS.** Each `.screen` is `display: none` by default; `.screen:target` is `display: block`. The first screen also matches `body:not(:has(.screen:target)) #screen-1 { display: block; }` so the page loads showing the first screen. Zero JS. Limit: browsers that ignore `:has()` will need the JS fallback.
2. **Inline JS toggle.** A `hashchange` listener flips a `data-active` attribute on the visible section. Under 30 lines. No framework.

Either way, the navigation feels instant because nothing is loading.

### Mocked data

**All data is inline literal markup, not generated.** A list of tasks is five `<li>` elements with realistic-looking text. A user's name is "Alex Rivera". A timestamp is "2 hours ago". The point is to let the user judge the layout and copy, not to test the data layer.

_Avoid_: "fake API", "mock fetch", "data generator". Say _inline literal markup_.

If a screen needs more than one realistic data state (empty, populated, loading, error), show the populated state inline and add a comment `<!-- empty state: see notes below -->`, then describe the variant in a short footer. Do not multiply screens to show every state.

### Nav

A single top-level nav with one link per screen. Keep nav copy short: noun phrases, not sentences. Highlight the active link with `border-bottom: 1.5px solid var(--clay)` (the signature 1.5px border, again).

### Interactivity inside a screen

The buttons inside a screen are visually styled but inert. If clicking a button would move the user to a different screen in the real product, link it to that screen's anchor — keep the nav coherent. If clicking a button would mutate data, leave it inert; do not script a fake mutation.

### Size budget

`screens.html` should be readable. A reasonable upper bound is one HTML page per screen of around 60-120 lines of markup, plus the shared `:root` block. If a single screen is pushing 200 lines of markup, the screen is doing too much — break the job into two screens or trim the screen.

**Falsifiable test.** Open `screens.html` in a fresh browser tab, with the network tab open. If any request goes out other than the file itself, the artifact is leaking on an external resource — find it and inline it.

## Optional tokens.css

**Write `.agent/design/tokens.css` only if the project will ship its own theme.** Most projects do not — they take the Birchline tokens as their app's tokens. When the project's spec names branding (a logo color, a typeface, a custom palette), drop a `tokens.css` next to `screens.html` that overrides the relevant custom properties.

_Avoid_: writing `tokens.css` "for completeness". Either the project has its own theme or it does not.

### When to write it

Read `.agent/spec.md` for any of these signals:

- A named brand color or palette.
- A custom typeface (note that the spec must accept that you cannot ship web fonts in `screens.html` itself — `tokens.css` is for the production app).
- A theme that materially differs from Birchline (dark mode, high-contrast variant).

If any of these are present, write `tokens.css` as a minimal override file:

```css
/* Project tokens — overrides Birchline defaults. */
:root {
  --clay: #C8392C;   /* brand red */
  --serif: "Tiempos Headline", ui-serif, Georgia, serif;
}
```

Keep it under 30 lines. Override, do not redefine the whole token set.

### When not to write it

If the spec is silent on branding, do not invent a theme. The Birchline tokens are the theme. The orchestrator records that no `tokens.css` was produced.

**Falsifiable test.** If `tokens.css` exists but the project's spec does not name any branding requirement, the file is speculative — delete it and let Birchline carry through.

## Workflow

For every Phase 3 dispatch:

1. **Verify scope.** Read `.agent/goal.md` and `.agent/spec.md`. Apply the skip-by-scope check above. If no UI surface, emit the no-op verdict and exit.
2. **Extract screens.** List user stories from `.agent/spec.md`. Group by screen. Apply the deletion test. Stop when each remaining screen is the only place a job can be done.
3. **Copy the Birchline `:root` block.** Read `skills/arianna-magic/references/templates/dashboard.html`, locate the `:root { ... }` declaration at the top of the `<style>`, and paste it verbatim into your `screens.html` `<style>`.
4. **Compose screens.html.** For each screen, write a `<section class="screen" id="screen-N">` with inline literal markup and mocked data. Wire the nav to the section anchors. Pick the `:target` or JS toggle, not both.
5. **Optionally write tokens.css.** Only if the spec names branding. Override, do not duplicate.
6. **Save.** Write `screens.html` and (optionally) `tokens.css` to `.agent/design/`.
7. **Self-check.** Open the file directly in a browser. Confirm every nav link reaches a screen, every screen renders, no external requests fire. Confirm borders read 1.5px.
8. **Return.** Emit the structured JSON verdict:

```json
{
  "phase": "design",
  "status": "done",
  "screens": [
    {"id": "screen-1", "name": "...", "stories": ["..."]}
  ],
  "files_written": [".agent/design/screens.html"],
  "tokens_css_written": false,
  "deletion_test_log": ["Cut 'Settings' — no story names a configurable behavior."]
}
```

The orchestrator records the verdict and opens the Phase 3 gate.

## Anti-patterns

- **Redefining Birchline tokens.** The `:root` block lives in the dashboard template. Copy it verbatim. Inventing new color names ("--brand-50", "--surface-elevated") drifts the project off the system and forces every subsequent screen to reconcile two vocabularies.
- **A settings or profile screen "for completeness".** The deletion test exists to stop this. If no user story names the behavior, the screen does not exist.
- **One screen per data state.** Empty / loading / populated / error are variants of one screen, not four screens. The populated state is the canonical render; describe variants in a short footer.
- **Running on a non-UI project.** REFACTOR / BUG_FIX / TRIVIAL skip this phase at the orchestrator. Backend-only MID_SIZED also skips. If you got dispatched anyway, return the no-op verdict and exit.
- **External assets.** No CDN, no `<link rel="stylesheet" href="https://...">`, no Google Fonts, no SVG icon library fetched at runtime. If you need an icon, inline the SVG.
- **A real build step.** No `npm`, no bundler, no `<script type="module" src="...">`. The file is opened with `file://` and works.
- **Designing the production app instead of the mock.** `screens.html` is a single-file mock that the user reviews during a gate. The worker phase implements the production app using its own stack. Do not optimize `screens.html` for the production runtime; optimize it for being readable in one tab.
- **Skipping the dashboard token reference.** Reading the existing token block once costs nothing and prevents the entire class of "I invented a new shade of clay" drift.

## References

- The Birchline `:root` token block lives in the dashboard template inside the **arianna-magic** skill (`skills/arianna-magic/references/templates/dashboard.html`). Read it once at the start of every Phase 3 dispatch and paste the `:root` declaration verbatim into `screens.html`.
- The user-stories format that drives the screen list lives in the **arianna-spec** skill. Read its `SKILL.md` only if `.agent/spec.md` is unclear about what counts as a user story.

See also the sibling skills: **arianna-magic** (orchestrator), **arianna-spec** (the upstream phase whose output drives the screen list), **arianna-plan** (the downstream phase that turns screens into atomic tasks).
