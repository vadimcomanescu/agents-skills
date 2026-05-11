---

## SUB-PHASE B: API CONTRACT

Test every API endpoint relevant to this task for correct shapes, status codes, and error formats.

### Step B1: Discover Endpoints

List the API routes touched by this task. The exact discovery command depends on the stack:
- **Next.js App Router** — `find src/app/api -name "route.ts" | sort`
- **Next.js Pages Router** — `find pages/api -type f | sort`
- **Express / Fastify / Hono** — grep for router mounts (`app.get`, `router.post`, etc.)
- **Go** — grep for `http.HandleFunc`, `mux.HandleFunc`, framework-specific route registration
- **Python / FastAPI** — inspect router config (`@app.get`, `@router.post`)
- **Rails / Phoenix** — read `config/routes.rb` or `router.ex`

Identify all endpoints the task adds or modifies. Cross-check against `.agent/spec.md` and `.agent/tasks.json` to confirm the surface is complete.

### Step B2: Happy-path contract checks

For each endpoint, send a valid request with curl and verify:
- HTTP status code matches expectation (200, 201, etc.)
- Response body shape matches the documented/expected schema (required fields present, correct types)
- `Content-Type` is `application/json` (or whatever the spec declares)

Example:
```bash
curl -s -X GET http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" | jq .
```

### Step B3: Error format checks

Verify consistent error responses across the surface:
- Missing required fields → 400 with `{ error: string }` or `{ errors: [...] }`
- Invalid auth → 401
- Forbidden (authenticated but not allowed) → 403
- Not found → 404
- Conflict (e.g., duplicate unique field) → 409
- Server error → 500 (never leaks stack traces)

```bash
# Missing auth
curl -s -X GET http://localhost:3000/api/<endpoint> | jq .
# Expected: 401 { "error": "Unauthorized" }

# Bad input
curl -s -X POST http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Expected: 400 with error details
```

### Step B4: Record API contract results

Note any endpoint that returns wrong status codes, malformed bodies, or inconsistent error shapes. These are API contract bugs — fix them before moving on.

Add findings to the `issues[]` array of the review-log entry with `category: "spec_mismatch"` (if the spec is contradicted) or `category: "error_handling"` (if error shapes are inconsistent). Include the curl command and stdout excerpt in `evidence.commands` and `evidence.stdout_excerpt`.
