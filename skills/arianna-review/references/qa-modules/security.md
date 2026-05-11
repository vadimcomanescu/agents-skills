---

## SUB-PHASE C: SECURITY

Run targeted security checks relevant to this task. Focus on the most impactful checks; do not run exhaustive scans.

### Step C1: Auth bypass

Try accessing every API endpoint for this task without authentication:
```bash
curl -s -X GET http://localhost:3000/api/<endpoint> | jq .
# Must return 401, never 200 with data
```
Try accessing protected UI pages without a session:
```bash
curl -s -L http://localhost:3000/<protected-page> | grep -i "login\|unauthorized"
```

For multi-tenant endpoints, also try accessing another tenant's data with a valid-but-wrong session — must return 403 or 404, never the other tenant's records (IDOR check).

### Step C2: Input sanitization

Test inputs that could cause injection or unexpected behavior:
```bash
# SQL injection probe
curl -s -X POST http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field": "'"'"' OR 1=1 --"}' | jq .

# XSS probe (check if reflected unsanitized in response or rendered HTML)
curl -s -X POST http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field": "<script>alert(1)</script>"}' | jq .
```

Verify: no SQL errors leaked, XSS payloads not reflected as raw HTML, no template-injection echoes (`${...}`, `{{...}}` reflected verbatim is fine; evaluated server-side is not).

### Step C3: CORS check

```bash
curl -s -I -X OPTIONS http://localhost:3000/api/<endpoint> \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control"
```
Verify: `Access-Control-Allow-Origin` does NOT echo back `https://evil.com` or `*` for credentialed routes. Wildcard origins on routes that accept cookies or `Authorization` headers are a critical finding.

### Step C4: Sensitive data exposure

Check that API responses never leak:
- Passwords or password hashes
- Full database IDs where short/opaque IDs should be used
- Internal server paths or stack traces
- Environment variable values
- Other users' data when the response should be scoped to the caller
- API keys, session tokens, or refresh tokens in response bodies (these belong in `httpOnly` cookies or scoped client storage, not JSON payloads — unless the endpoint's job is explicitly to mint them)

### Step C5: Rate limiting and abuse

If the task adds a public-facing or expensive endpoint, attempt to call it in a rapid loop:
```bash
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/<endpoint>
done | sort | uniq -c
```
Verify the endpoint either rate-limits (429s appear) or the task explicitly declares "no rate limit required" in `.agent/spec.md`.

### Step C6: Record security results

Note any bypass, injection success, CORS misconfiguration, data leak, or missing rate limit. Fix critical and major security findings before moving on.

In the review-log entry, file each finding with `category: "security"` and an explicit `severity`. Treat auth-bypass and IDOR as `critical` by default.
