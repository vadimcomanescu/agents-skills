# Verification Evidence

ACs live in `.shepherd/spec.md`; `.shepherd/verification.md` maps each AC to proof. Implementer evidence is candidate only. QA owns PASS/FAIL/WAIVED against the approved spec.

## Verification Report Fields

Every behavior-changing AC in `.shepherd/verification.md` needs:

- AC ID
- proof modality
- required artifact
- milestone owner
- QA result: `PASS`, `FAIL`, `WAIVED`, or `pending`
- evidence path
- verified revision: commit, worktree fingerprint, or state-file path
- evidence state: `fresh`, `stale`, `current`, or `pending`
- waiver text, or `none`

Run during setup:

```bash
python3 skills/shepherd/scripts/validate_verification.py --allow-pending .shepherd/verification.md
```

Run before completion:

```bash
python3 skills/shepherd/scripts/validate_verification.py .shepherd/verification.md
python3 skills/shepherd/scripts/validate_evidence.py .shepherd/verification.md
python3 skills/shepherd/scripts/validate_freshness.py .shepherd/verification.md
python3 skills/shepherd/scripts/validate_final_report.py .shepherd/verification.md .shepherd/final-report.md
```

## Proof Modalities

| Modality | Requires | Insufficient |
|---|---|---|
| Unit | test file and command output | only integration or manual report |
| Acceptance-spec mutation | kit acceptance-mutation report at `--level full` with exit 0, `survived=0`, `errors=0`, `total>0` | passing normal acceptance alone, a `total=0` run, or a `--level hard` run that skips all mutations |
| Component | component test output, fixture, and relevant diff | only screenshot |
| Integration | command output and involved service state | only unit output |
| Browser-visible | saved screenshot from the actual app, browser execution evidence, and browser evidence manifest with captured URL, page title, observed assertions, and verdict | text report, mock screenshot, planned screenshot, wrong page, auth redirect, empty shell |
| Multi-step browser workflow | saved screenshot, browser evidence manifest, plus replayable Playwright trace/video, agent-browser trace/video recording, screen recording, or equivalent | final screenshot only |
| API/state/data | API response, database output, persisted-state file, or backend assertion output | UI-only proof |
| Manual | human note with exact observation, reason automation is impossible, and artifact when feasible | vague approval |
| Waiver | explicit user approval and scope | assumed approval |

## Freshness

Evidence is stale when behavior-relevant files changed after capture. If implementer, refactorer, or architect changes behavior-relevant files, mark affected AC rows stale and rerun QA before approval.

Accepted evidence must identify the current commit, a dirty-worktree fingerprint generated at capture time, or a `state-file:<path>` artifact that records the exact dirty worktree state used for verification. Do not mark evidence fresh from memory.

## Browser Evidence

Browser-visible ACs require saved screenshots from the actual app. Multi-step workflows also require replayable proof: Playwright trace/video, agent-browser trace/video recording, screen recording, or equivalent repo-native browser artifact.

Tool choice is flexible. Artifact strength is not.

Browser evidence must prove the intended AC state. A file path is necessary but not sufficient. Reject screenshots of auth redirects, wrong routes, empty shells, loading/error states, or pages whose visible assertions do not match the AC. Store a JSON manifest beside browser artifacts:

```json
{
  "type": "browser-evidence",
  "ac_id": "AC-001",
  "expected_route_or_state": "/dashboard shows KPI cards",
  "captured_url": "http://localhost:3015/",
  "page_title": "AutoBlitz Sec",
  "assertions": ["KPI section visible", "Cursanti metric visible"],
  "commands": ["agent-browser open ...", "agent-browser screenshot ..."],
  "artifacts": ["evidence/dashboard.png", "evidence/dashboard.snapshot.txt"],
  "verdict": "PASS"
}
```

## Rejected Proof

Do not accept:

- implementer or refactorer report text as proof by itself
- missing artifact paths
- artifact paths that do not exist
- browser artifacts that do not prove the intended route, page, or state
- stale evidence
- UI-only proof for state/API/data behavior
- final reports missing any AC row
- unapproved extra user-visible behavior
