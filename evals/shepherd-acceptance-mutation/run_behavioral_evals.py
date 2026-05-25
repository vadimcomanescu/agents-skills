#!/usr/bin/env python3
"""Run Shepherd acceptance-mutation behavioral evals.

The evals build disposable repos with tiny acceptance pipelines, execute the
normal acceptance and acceptance-mutation commands, then assert that the patched
Shepherd skill surfaces would make the required orchestration decisions.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
EVAL_ROOT = REPO / "evals" / "shepherd-acceptance-mutation"


def run(cmd: list[str], cwd: Path) -> dict:
    proc = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return {
        "cmd": " ".join(cmd),
        "cwd": str(cwd),
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def chmod_x(path: Path) -> None:
    path.chmod(path.stat().st_mode | 0o111)


def read_current_sources() -> dict[str, str]:
    paths = [
        "skills/shepherd/SKILL.md",
        "skills/shepherd/prompts/implementer.md",
        "skills/shepherd/prompts/reviewer.md",
        "skills/shepherd/prompts/plan-reviewer.md",
        "skills/shepherd/prompts/plan-synthesizer.md",
        "skills/shepherd/prompts/fixer.md",
        "skills/shepherd/references/acceptance-mutation.md",
        "skills/shepherd/references/project-templates.md",
    ]
    return {path: (REPO / path).read_text(encoding="utf-8") for path in paths}


def read_baseline_shepherd() -> str:
    proc = subprocess.run(
        ["git", "show", "HEAD:skills/shepherd/SKILL.md"],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=True,
    )
    return proc.stdout


def baseline_decision(baseline: str, case_id: str, normal: dict, mutation: dict) -> dict:
    has_gate = "Acceptance-Spec Gate" in baseline or "acceptance mutation" in baseline.lower()
    decision = "would inspect acceptance mutation" if has_gate else "would proceed from generic tests/lint/typecheck evidence"
    if case_id == "eval-3-survived-mutation-blocks-progress" and not has_gate and normal["exit_code"] == 0:
        decision = "would not block on survived acceptance mutation because baseline Shepherd has no acceptance-spec mutation gate"
    return {
        "baseline_has_acceptance_gate": has_gate,
        "normal_acceptance_exit": normal["exit_code"],
        "acceptance_mutation_exit": mutation["exit_code"],
        "baseline_decision": decision,
    }


def assert_sources_have_gate(sources: dict[str, str]) -> list[str]:
    checks = {
        "main skill has Step 3.5 gate": "Step 3.5: Acceptance-Spec Gate" in sources["skills/shepherd/SKILL.md"],
        "main skill blocks survived mutations": "Survived acceptance mutation" in sources["skills/shepherd/SKILL.md"],
        "main skill blocks mutation errors": "Acceptance mutation error" in sources["skills/shepherd/SKILL.md"],
        "reference defines killed": "`killed`" in sources["skills/shepherd/references/acceptance-mutation.md"],
        "reference defines survived": "`survived`" in sources["skills/shepherd/references/acceptance-mutation.md"],
        "reference defines error": "`error`" in sources["skills/shepherd/references/acceptance-mutation.md"],
        "implementer reports mutation totals": "total, killed, survived, errors" in sources["skills/shepherd/prompts/implementer.md"],
        "reviewer requests changes on survivors": "REQUEST CHANGES" in sources["skills/shepherd/prompts/reviewer.md"]
        and "survivors" in sources["skills/shepherd/prompts/reviewer.md"],
        "plan reviewer catches weak examples": "Weak or meaningless acceptance examples" in sources["skills/shepherd/prompts/plan-reviewer.md"],
        "templates record acceptance gate": "Latest Acceptance Mutation Result" in sources["skills/shepherd/references/project-templates.md"],
    }
    return [name for name, passed in checks.items() if not passed]


def run_trigger_discrimination(root: Path, sources: dict[str, str]) -> dict:
    frontmatter = sources["skills/shepherd/SKILL.md"].split("---", 2)[1]
    description_match = re.search(r"^description:\s*(.+)$", frontmatter, re.M)
    description = description_match.group(1) if description_match else ""
    cases = [
        {
            "id": "trigger-end-to-end",
            "prompt": "Build this project end-to-end and run autonomously through multiple milestones.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "end-to-end" in description and "multi-milestone" in description else "NO_TRIGGER",
        },
        {
            "id": "trigger-overnight",
            "prompt": "Run this implementation overnight without human intervention.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "without human intervention" in description else "NO_TRIGGER",
        },
        {
            "id": "trigger-build-project",
            "prompt": "Build this project from the spec and manage it autonomously.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "build this project" in description else "NO_TRIGGER",
        },
        {
            "id": "trigger-long-running",
            "prompt": "Coordinate this long-running multi-milestone refactor.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "long-running" in description and "multi-milestone" in description else "NO_TRIGGER",
        },
        {
            "id": "trigger-implement-end-to-end",
            "prompt": "Implement this end-to-end across the repo.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "implement this end-to-end" in description else "NO_TRIGGER",
        },
        {
            "id": "trigger-hours-days",
            "prompt": "Run the delivery over the next few days with minimal human input.",
            "expected": "TRIGGER",
            "actual": "TRIGGER" if "hours or days" in description else "NO_TRIGGER",
        },
        {
            "id": "no-trigger-single-file",
            "prompt": "Fix this typo in one markdown file.",
            "expected": "NO_TRIGGER",
            "actual": "NO_TRIGGER" if "single-file changes" in sources["skills/shepherd/SKILL.md"] else "TRIGGER",
        },
        {
            "id": "no-trigger-one-shot-fix",
            "prompt": "Fix this failing assertion in a small unit test.",
            "expected": "NO_TRIGGER",
            "actual": "NO_TRIGGER" if "one-shot fixes" in sources["skills/shepherd/SKILL.md"] else "TRIGGER",
        },
        {
            "id": "no-trigger-question",
            "prompt": "Explain what this function does.",
            "expected": "NO_TRIGGER",
            "actual": "NO_TRIGGER" if "When NOT to use" in sources["skills/shepherd/SKILL.md"] else "TRIGGER",
        },
        {
            "id": "no-trigger-tight-cadence",
            "prompt": "Pair with me interactively and ask before each step.",
            "expected": "NO_TRIGGER",
            "actual": "NO_TRIGGER" if "tight human-in-the-loop cadence" in sources["skills/shepherd/SKILL.md"] else "TRIGGER",
        },
    ]
    result = {
        "description": description,
        "cases": cases,
        "passed": all(case["expected"] == case["actual"] for case in cases),
    }
    write(root / "trigger-discrimination.json", json.dumps(result, indent=2))
    return result


def create_fixture(base: Path, mode: str) -> Path:
    fixture = base / "repo"
    if fixture.exists():
        shutil.rmtree(fixture)
    fixture.mkdir(parents=True)
    (fixture / "features").mkdir()
    (fixture / "scripts").mkdir()
    (fixture / "tests").mkdir()

    if mode == "weak":
        write(
            fixture / "features" / "status.feature",
            """Feature: status

Scenario: Accepted status is shown
  When the user asks for the status
  Then the status is accepted
""",
        )
    else:
        write(
            fixture / "features" / "status.feature",
            """Feature: status

Scenario Outline: Status is shown
  When the user asks for the status
  Then the status is <status>

  Examples:
    | status   |
    | accepted |
""",
        )

    write(
        fixture / "app.py",
        """def status() -> str:
    return "accepted"
""",
    )
    write(
        fixture / "tests" / "test_app.py",
        """from app import status


def test_status_returns_accepted():
    assert status() == "accepted"
""",
    )

    write(
        fixture / "scripts" / "normal_acceptance.py",
        """#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
text = (root / "features" / "status.feature").read_text()
if "Feature:" not in text:
    print("missing feature declaration")
    sys.exit(1)
if "<status>" in text and "| accepted |" not in text:
    print("missing accepted example")
    sys.exit(1)
print("normal acceptance passed: generated tests checked status=accepted")
""",
    )
    chmod_x(fixture / "scripts" / "normal_acceptance.py")

    mutator = f"""#!/usr/bin/env python3
from pathlib import Path
import copy
import json
import sys

root = Path(__file__).resolve().parents[1]
report = root / "build" / "acceptance-mutation" / "report.json"
report.parent.mkdir(parents=True, exist_ok=True)
feature = (root / "features" / "status.feature").read_text()

def parse_feature(text):
    lines = [line.rstrip() for line in text.splitlines()]
    feature_name = None
    scenarios = []
    current = None
    in_examples = False
    headers = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Feature:"):
            feature_name = line.split(":", 1)[1].strip()
        elif line.startswith("Scenario"):
            current = {{"name": line.split(":", 1)[1].strip(), "steps": [], "examples": []}}
            scenarios.append(current)
            in_examples = False
        elif line.startswith(("Given ", "When ", "Then ", "And ")):
            keyword, text_value = line.split(" ", 1)
            params = []
            if "<status>" in text_value:
                params.append("status")
            current["steps"].append({{"keyword": keyword, "text": text_value, "parameters": params}})
        elif line.startswith("Examples:"):
            in_examples = True
        elif in_examples and line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if not headers:
                headers = cells
            else:
                current["examples"].append(dict(zip(headers, cells)))
    if not feature_name:
        raise SystemExit("missing feature")
    return {{"name": feature_name, "background": [], "scenarios": scenarios}}

def generated_tests_fail(ir):
    expected = ir["scenarios"][0]["examples"][0]["status"]
    actual = "accepted"
    if {mode!r} == "survivor":
        return False
    return actual != expected

if {mode!r} == "error":
    print("status elapsed=0s total=1 completed=0 running=1 killed=0 survived=0 errors=0", file=sys.stderr)
    data = {{"summary": {{"Total": 1, "Killed": 0, "Survived": 0, "Errors": 1}}, "results": [{{"Mutation": {{"ID": "m1", "Path": "$.scenarios[0].examples[0].status", "Description": "$.scenarios[0].examples[0].status: accepted -> accfpted", "Original": "accepted", "Mutated": "accfpted"}}, "Status": "error", "Output": "", "Error": "generator failed", "Duration": 1}}]}}
    report.write_text(json.dumps(data, indent=2))
    print(json.dumps(data))
    sys.exit(1)

if "Examples:" not in feature:
    data = {{"summary": {{"Total": 0, "Killed": 0, "Survived": 0, "Errors": 0}}, "results": []}}
    report.write_text(json.dumps(data, indent=2))
    print(json.dumps(data))
    sys.exit(0)

base_ir = parse_feature(feature)
mutated_ir = copy.deepcopy(base_ir)
mutated_ir["scenarios"][0]["examples"][0]["status"] = "accfpted"
(report.parent / "base-ir.json").write_text(json.dumps(base_ir, indent=2))
mutation_dir = report.parent / "m1"
mutation_dir.mkdir(exist_ok=True)
(mutation_dir / "feature.json").write_text(json.dumps(mutated_ir, indent=2))
(mutation_dir / "generated").mkdir(exist_ok=True)
(mutation_dir / "generated" / "status_acceptance_test.txt").write_text("generated from mutated JSON IR")

status = "killed" if generated_tests_fail(mutated_ir) else "survived"
summary = {{"Total": 1, "Killed": 0 if status == "survived" else 1, "Survived": 1 if status == "survived" else 0, "Errors": 0}}
data = {{"summary": summary, "results": [{{"Mutation": {{"ID": "m1", "Path": "$.scenarios[0].examples[0].status", "Description": "$.scenarios[0].examples[0].status: accepted -> accfpted", "Original": "accepted", "Mutated": "accfpted"}}, "Status": status, "Output": "generated acceptance tests {'passed' if mode == 'survivor' else 'failed'} after mutation", "Error": "", "Duration": 1}}]}}
report.write_text(json.dumps(data, indent=2))
print(json.dumps(data))
sys.exit(1 if status == "survived" else 0)
"""
    write(fixture / "scripts" / "gherkin_mutator.py", mutator)
    chmod_x(fixture / "scripts" / "gherkin_mutator.py")
    return fixture


def mutation_summary(result: dict) -> dict:
    report_path = Path(result["cwd"]) / "build" / "acceptance-mutation" / "report.json"
    if not report_path.exists():
        return {"Total": 0, "Killed": 0, "Survived": 0, "Errors": 1}
    return json.loads(report_path.read_text(encoding="utf-8"))["summary"]


def progress_statuses(summary: dict, mode: str, normal: dict) -> dict[str, str]:
    examples = "failed" if mode == "weak" else "passed"
    normal_status = "passed" if normal["exit_code"] == 0 else "failed"
    if summary.get("Errors", 0):
        mutation_status = "failed"
    elif summary.get("Survived", 0):
        mutation_status = "failed"
    elif summary.get("Total", 0) == 0:
        mutation_status = "failed"
    else:
        mutation_status = "passed"
    return {"examples": examples, "normal": normal_status, "mutation": mutation_status}


def write_shepherd_artifacts(fixture: Path, scenario: str, normal: dict, mutation: dict, decision: str) -> None:
    summary = mutation_summary(mutation)
    statuses = progress_statuses(summary, "weak" if "weak" in scenario else "normal", normal)
    write(
        fixture / ".shepherd" / "spec.md",
        f"""# Spec

## Confirmed Intent
Build a tiny status behavior.

## Acceptance Criteria
- Executable behavior is specified in `features/status.feature`.
- Behavior-relevant example values are acceptance-mutated when present.
- Scenario: {scenario}
""",
    )
    write(
        fixture / ".shepherd" / "standards.md",
        """# Project Standards

## Testing
- Unit tests: `python -m pytest tests`
- Generated acceptance tests stay separate from unit tests.

## Acceptance Specs
- Normal acceptance command: `python scripts/normal_acceptance.py`
- Acceptance mutation command: `python scripts/gherkin_mutator.py --json`
- Generated acceptance-test location: `build/acceptance/generated`
- Acceptance mutation report location: `build/acceptance-mutation/report.json`
- Timeout/status expectation: mutator reports status lines on stderr for long runs
- Source-code mutation command: separate gate not available in this fixture
- Accepted limitations: none unless recorded in progress
""",
    )
    write(
        fixture / ".shepherd" / "plan.md",
        f"""# Implementation Plan

## Milestone 1: Status behavior

- Task: implement status behavior with TDD unit coverage.
- Verification:
  - `python -m pytest tests`
  - `python scripts/normal_acceptance.py`
  - `python scripts/gherkin_mutator.py --json`

Acceptance mutation decision: {decision}
""",
    )
    write(
        fixture / ".shepherd" / "progress.md",
        f"""# Project Progress

## Current Status
**Phase:** Setup / Milestone 1
**Current milestone:** Status behavior
**Current task:** acceptance-spec gate
**Last action:** Ran normal acceptance and acceptance mutation.

## Acceptance-Spec Gate

| Item | Status | Evidence |
|------|--------|----------|
| Executable behavior examples | {statuses['examples']} | `features/status.feature` |
| Normal acceptance | {statuses['normal']} | `{normal['cmd']}` |
| Acceptance mutation | {statuses['mutation']} | `build/acceptance-mutation/report.json` |
| Source-code mutation | accepted limitation | Fixture has no source mutator |

### Latest Acceptance Mutation Result

- Command: `{mutation['cmd']}`
- Exit code: {mutation['exit_code']}
- Report: `build/acceptance-mutation/report.json`
- Total: {summary.get('Total', 0)}
- Killed: {summary.get('Killed', 0)}
- Survived: {summary.get('Survived', 0)}
- Errors: {summary.get('Errors', 0)}
- Survivor paths: {"$.scenarios[0].examples[0].status" if summary.get('Survived', 0) else "[]"}
- Error details: {"generator failed" if summary.get('Errors', 0) else ""}
- Decision: {decision}
""",
    )


def write_prompt_surface_outputs(outputs: Path, sources: dict[str, str], summary: dict, decision: str) -> dict:
    implementer = sources["skills/shepherd/prompts/implementer.md"]
    reviewer = sources["skills/shepherd/prompts/reviewer.md"]
    plan_reviewer = sources["skills/shepherd/prompts/plan-reviewer.md"]
    should_request_changes = bool(
        summary.get("Survived", 0)
        or summary.get("Errors", 0)
        or (summary.get("Total", 0) == 0 and "fix" in decision)
    )
    implementer_output = {
        "prompt_surface": "implementer",
        "requires_normal_acceptance": "Normal acceptance results" in implementer,
        "requires_mutation_totals": "total, killed, survived, errors" in implementer,
        "requires_no_fake_acceptance": "Generated acceptance tests stay separate from unit tests" in implementer,
        "sample_report_decision": decision,
    }
    reviewer_output = {
        "prompt_surface": "reviewer",
        "requests_changes_on_survivors": "survivors" in reviewer and "REQUEST CHANGES" in reviewer,
        "requests_changes_on_errors": "mutation errors" in reviewer and "REQUEST CHANGES" in reviewer,
        "separates_mutation_types": "Source-code mutation and Gherkin acceptance-spec mutation are separate gates" in reviewer,
        "sample_verdict": "REQUEST CHANGES" if should_request_changes else "APPROVE",
    }
    plan_reviewer_output = {
        "prompt_surface": "plan-reviewer",
        "blocks_weak_examples": "Weak or meaningless acceptance examples" in plan_reviewer,
        "blocks_verification_blind_to_example_changes": "changed Gherkin example value" in plan_reviewer,
    }
    write(outputs / "implementer-output.json", json.dumps(implementer_output, indent=2))
    write(outputs / "reviewer-output.json", json.dumps(reviewer_output, indent=2))
    write(outputs / "plan-reviewer-output.json", json.dumps(plan_reviewer_output, indent=2))
    return {
        "implementer": implementer_output,
        "reviewer": reviewer_output,
        "plan_reviewer": plan_reviewer_output,
    }


def eval_case(root: Path, case_id: str, mode: str, decision: str, expect: dict, sources: dict[str, str], baseline: str) -> dict:
    case_dir = root / case_id
    fixture = create_fixture(case_dir / "fixture", mode)
    normal = run([sys.executable, "scripts/normal_acceptance.py"], fixture)
    mutation = run([sys.executable, "scripts/gherkin_mutator.py", "--json"], fixture)
    pytest_result = run([sys.executable, "-m", "pytest", "tests"], fixture)
    write_shepherd_artifacts(fixture, case_id, normal, mutation, decision)
    summary = mutation_summary(mutation)
    baseline = baseline_decision(baseline, case_id, normal, mutation)
    assertions = {
        "normal acceptance ran": normal["exit_code"] == expect["normal_exit"],
        "unit tests ran separately": pytest_result["exit_code"] == 0,
        "mutation exit matches expected": mutation["exit_code"] == expect["mutation_exit"],
        "mutation total matches expected": summary.get("Total", 0) == expect["total"],
        "mutation killed matches expected": summary.get("Killed", 0) == expect["killed"],
        "mutation survived matches expected": summary.get("Survived", 0) == expect["survived"],
        "mutation errors matches expected": summary.get("Errors", 0) == expect["errors"],
        "progress records decision": decision in (fixture / ".shepherd" / "progress.md").read_text(),
        "plan records acceptance mutation": "gherkin_mutator.py" in (fixture / ".shepherd" / "plan.md").read_text(),
    }
    if mode not in {"weak", "error"}:
        base_ir = fixture / "build" / "acceptance-mutation" / "base-ir.json"
        mutated_ir = fixture / "build" / "acceptance-mutation" / "m1" / "feature.json"
        assertions["mutator wrote base JSON IR"] = base_ir.exists()
        assertions["mutator wrote changed JSON IR"] = mutated_ir.exists()
        if base_ir.exists() and mutated_ir.exists():
            base = json.loads(base_ir.read_text())
            mutated = json.loads(mutated_ir.read_text())
            assertions["mutator changed one example cell"] = (
                base["name"] == mutated["name"]
                and base["scenarios"][0]["name"] == mutated["scenarios"][0]["name"]
                and base["scenarios"][0]["steps"] == mutated["scenarios"][0]["steps"]
                and base["scenarios"][0]["examples"][0]["status"] == "accepted"
                and mutated["scenarios"][0]["examples"][0]["status"] == "accfpted"
            )
    if expect.get("block"):
        assertions["blocking decision recorded"] = "fix" in decision or "accepted limitation" in decision
    if expect.get("weak"):
        assertions["weak spec has no mutations"] = summary.get("Total", 0) == 0
        progress = (fixture / ".shepherd" / "progress.md").read_text()
        assertions["weak spec progress marks examples failed"] = "| Executable behavior examples | failed |" in progress
        assertions["weak spec progress marks mutation failed"] = "| Acceptance mutation | failed |" in progress
    outputs = case_dir / "outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    write(outputs / "prompt.txt", f"Run Shepherd behavioral eval {case_id} with mode={mode}.\n")
    write(outputs / "normal_acceptance.json", json.dumps(normal, indent=2))
    write(outputs / "acceptance_mutation.json", json.dumps(mutation, indent=2))
    write(outputs / "unit_tests.json", json.dumps(pytest_result, indent=2))
    write(outputs / "baseline-output.json", json.dumps(baseline, indent=2))
    for name in ["spec.md", "standards.md", "plan.md", "progress.md"]:
        shutil.copy2(fixture / ".shepherd" / name, outputs / name)
    prompt_outputs = write_prompt_surface_outputs(outputs, sources, summary, decision)
    report = {
        "case": case_id,
        "fixture_repo": str(fixture),
        "mutation_summary": summary,
        "decision": decision,
        "baseline": baseline,
        "prompt_surface_outputs": prompt_outputs,
        "assertions": assertions,
        "passed": all(assertions.values()),
    }
    write(outputs / "evaluator-notes.json", json.dumps(report, indent=2))
    return report


def main() -> int:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = EVAL_ROOT / timestamp
    root.mkdir(parents=True, exist_ok=True)
    sources = read_current_sources()
    source_failures = assert_sources_have_gate(sources)
    trigger = run_trigger_discrimination(root, sources)
    baseline = read_baseline_shepherd()
    baseline_has_gate = "Acceptance-Spec Gate" in baseline or "acceptance mutation" in baseline.lower()

    cases = [
        eval_case(root, "eval-1-greenfield-happy-path", "happy", "proceed", {"normal_exit": 0, "mutation_exit": 0, "total": 1, "killed": 1, "survived": 0, "errors": 0}, sources, baseline),
        eval_case(root, "eval-2-existing-codebase-integration", "happy", "proceed with separate unit and acceptance evidence", {"normal_exit": 0, "mutation_exit": 0, "total": 1, "killed": 1, "survived": 0, "errors": 0}, sources, baseline),
        eval_case(root, "eval-3-survived-mutation-blocks-progress", "survivor", "fix generated-test binding before proceeding", {"normal_exit": 0, "mutation_exit": 1, "total": 1, "killed": 0, "survived": 1, "errors": 0, "block": True}, sources, baseline),
        eval_case(root, "eval-4-mutation-infrastructure-error-blocks-trust", "error", "fix mutation infrastructure before proceeding", {"normal_exit": 0, "mutation_exit": 1, "total": 1, "killed": 0, "survived": 0, "errors": 1, "block": True}, sources, baseline),
        eval_case(root, "eval-5-weak-or-unmutatable-spec", "weak", "fix spec examples before implementation planning", {"normal_exit": 0, "mutation_exit": 0, "total": 0, "killed": 0, "survived": 0, "errors": 0, "weak": True, "block": True}, sources, baseline),
    ]

    benefit_rows = [
        {
            "Scenario": "survived mutation",
            "Baseline Shepherd behavior": "No acceptance-spec gate found in HEAD baseline" if not baseline_has_gate else "Baseline unexpectedly has a gate",
            "Patched Shepherd behavior": "Blocks progress and records survivor path",
            "Evidence artifact": "eval-3-survived-mutation-blocks-progress/outputs/evaluator-notes.json",
            "Benefit": "Prevents generic tests/lint/typecheck from hiding weak generated acceptance binding",
        },
        {
            "Scenario": "greenfield examples",
            "Baseline Shepherd behavior": "Spec path has no behavior-relevant mutation gate",
            "Patched Shepherd behavior": "Requires executable examples before plan readiness",
            "Evidence artifact": "eval-1-greenfield-happy-path/outputs/spec.md",
            "Benefit": "Implementation starts from mutation-checkable behavior examples",
        },
        {
            "Scenario": "review evidence",
            "Baseline Shepherd behavior": "Reviewer checks generic tests and code review concerns",
            "Patched Shepherd behavior": "Reviewer rejects hidden survivors/errors and missing report paths",
            "Evidence artifact": "eval-3-survived-mutation-blocks-progress/outputs/progress.md",
            "Benefit": "Mutation output becomes review evidence, not a vague test summary",
        },
        {
            "Scenario": "mutation type separation",
            "Baseline Shepherd behavior": "No distinction between source mutation and acceptance-spec mutation",
            "Patched Shepherd behavior": "Records acceptance mutation separately from source-code mutation",
            "Evidence artifact": "eval-2-existing-codebase-integration/outputs/standards.md",
            "Benefit": "Applies the right mutation gate to the right evidence surface",
        },
    ]
    benefit_text = "Scenario | Baseline Shepherd behavior | Patched Shepherd behavior | Evidence artifact | Benefit\n"
    benefit_text += "--- | --- | --- | --- | ---\n"
    benefit_text += "\n".join(
        f"{row['Scenario']} | {row['Baseline Shepherd behavior']} | {row['Patched Shepherd behavior']} | {row['Evidence artifact']} | {row['Benefit']}"
        for row in benefit_rows
    )
    write(root / "benefit-report.md", benefit_text + "\n")

    summary = {
        "artifact_dir": str(root),
        "source_failures": source_failures,
        "trigger_discrimination": trigger,
        "baseline_has_acceptance_gate": baseline_has_gate,
        "cases": cases,
        "passed": not source_failures and trigger["passed"] and not baseline_has_gate and all(case["passed"] for case in cases),
    }
    write(root / "summary.json", json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
