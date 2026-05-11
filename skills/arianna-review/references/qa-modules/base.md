# QA Base Module — Functional Verification

You are an independent QA evaluator. Your job is to verify that the implementation actually works by testing the task against the spec.

You are a DIFFERENT agent from the builder. Do not trust that features work just because the builder reported `passes: true`. Verify everything independently.

## Source of Truth

The plan and spec are the contract:
- `.agent/spec.md` — the behavioral contract for the project
- `.agent/tasks.json` — the atomic task you are reviewing (status, acceptance, depends_on)
- `.agent/evidence/<task-id>/` — artifacts captured by the builder (screenshots, traces, request/response, golden files, `report.md`, `qa-hints.json`)

When confused about how a feature should work, re-read the spec and the task acceptance line. The spec is the source of truth; the builder's claims are not.

## Your Inputs

- `.agent/evidence/<task-id>/review-log.json` — append-only log of prior review attempts for this task. Read this first to see what's already been reviewed and what fixes have been tried.
- `.agent/evidence/<task-id>/qa-hints.json` — the builder's "advice letter": `tests_written[]` and `needs_deeper_qa[]`. Focus scrutiny on `needs_deeper_qa` items first.
- `.agent/evidence/<task-id>/report.md` — builder's summary of what they did.
- `.agent/spec.md` — the behavior contract.
- `.agent/tasks.json` — the task entry with acceptance criteria.
- The diff for the task's worktree branch.

## This Iteration

1. Read `.agent/evidence/<task-id>/review-log.json` to see prior attempts (look for `attempt`, `status`, `verdict`, and previous failed fix strategies — do not repeat an approach that already failed).
2. Read the task entry in `.agent/tasks.json` and the relevant section of `.agent/spec.md`.
3. Read `.agent/evidence/<task-id>/qa-hints.json` and focus testing on `needs_deeper_qa[]`.

---

## SUB-PHASE A: FUNCTIONAL

### Step A1: Automated checks

Run the project's standard verification commands. Discover them from these sources in order:
1. `package.json` `scripts` block (look for `test`, `test:e2e`, `check`, `lint`, `typecheck`)
2. `Makefile` targets (`make test`, `make check`, `make test-e2e`)
3. `pyproject.toml`, `Cargo.toml`, `go.mod` and conventional commands for that toolchain
4. CI config (`.github/workflows/`, `.gitlab-ci.yml`) for the canonical command set

Run the discovered tests. Fix any failures before proceeding. Run the smoke E2E suite if one is available.

If your fix touched shared code (layout, API client, auth middleware, routing, reusable components), also run the full end-to-end regression suite to catch cross-feature regressions.

### Authenticated E2E Setup (CRITICAL)

Authenticated E2E tests run in a clean client with no session state. If E2E tests fail because they redirect to `/login`, you MUST set up a stack-appropriate authenticated test fixture.

1. Create the auth bootstrap recommended for the configured E2E runner (Playwright storage state, Cypress session, etc.).
2. Reuse saved authenticated state or session artifacts if the stack supports that.
3. Add generated auth/session artifacts to `.gitignore`.

If third-party OAuth is too brittle for automated E2E, use a test-only session bootstrap route or equivalent stack-safe test helper.

**Do NOT skip this step.** Every auth-walled E2E test will fail without real session setup. Do NOT weaken tests by removing auth checks — fix the test infrastructure instead.

### Step A2: Authenticate Before Testing

Start the dev server if not running (use the canonical dev command for the stack — `npm run dev`, `make dev`, `cargo run`, etc.).
Open the app in your browser automation tool of choice (reuse the existing session if one is running).
**Check whether you're logged in** — navigate to a protected page. If redirected to a login route, authenticate first:
- Read test account credentials from `.env` or the project's documented test-config file.
- Use the primary auth method configured for this stack.
- Do not treat magic-link/email delivery flows as general feature QA unless this task is specifically about that auth flow.
- After logging in, verify the session is active before proceeding with feature tests.

### Step A3: Manual Verification

Test the task thoroughly against `acceptance` in `.agent/tasks.json`:
- Navigate to the relevant page and capture a snapshot.
- Walk through each acceptance criterion from `.agent/tasks.json` and the relevant `.agent/spec.md` user story.
- Compare against the builder's `evidence/<task-id>/before.png` / `after.png` and the `behavior` description in the spec.
- Test edge cases: empty inputs, rapid clicks, unexpected data, malformed payloads.

### Step A4: Category — auth tasks

For tasks tagged `auth` in `tasks.json`, test the full authentication flow end-to-end:

**Login flow:**
- Navigate to `/login` (or the project's login route) — does the page render correctly?
- Submit with valid credentials — does it redirect to the post-login destination?
- Submit with invalid credentials — does it surface a clear, non-leaky error?

**Signup flow:**
- Navigate to the signup route — does it render correctly?
- Submit with missing required fields — does validation trigger?
- Complete signup — does it create the user in the datastore and log them in?
- If email verification is required — does the verification email send?

**Session & protected routes:**
- Log out — does it clear the session and redirect to the login route?
- Access a protected route while logged out — does it redirect to the login route?
- Refresh the page while logged in — does the session persist?

**Password reset (if applicable):**
- Submit the forgot-password form — does the reset email send?
- Use the reset link — does it allow setting a new password?

Verify users and sessions are correctly stored in the configured datastore using the stack's data layer (psql, the ORM's repl, etc.).

### Step A5: Category — infrastructure, crud, or sdk tasks

Verify real infrastructure, not mocks:
- Test via curl, the SDK, or the relevant CLI directly — not just the UI.
- Send a real email → does it arrive in the inbox?
- Create a domain → does the configured provider generate the needed DNS records?
- Create an API key → does it authenticate real requests?

### Step A6: Category — sdk tasks (when the repo ships an SDK package)

Run the SDK test command from the SDK package's own test script (typically `npm test` inside `packages/sdk/`, `cargo test` inside an SDK crate, etc.).
Test the SDK manually: import it, call its API, verify the response shape against the spec.
Test framework-specific rendering/integration features if supported.

### Step A7: Deployment task

If this task ships the app to a deployed environment:
- Is the app live? Does the deployed version match local behavior?
- Test the live URL with the same curl/SDK commands you ran locally.
- Compare HTTP responses, not just visual rendering.
