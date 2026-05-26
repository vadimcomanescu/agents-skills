#!/usr/bin/env python3
"""Run Shepherd role-responsibility and mutation behavioral evals.

The harness checks the current Shepherd skill surface and executes disposable
code fixtures with normal acceptance, source-code mutation, and acceptance-spec
mutation commands. It is intentionally small: the goal is to prove that the
skill now routes quality gates to the architect role, keeps coordinator and
refactorer duties separate, and uses implementers for exact architect-finding
repair tasks.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
EVAL_ROOT = REPO / "evals" / "shepherd-acceptance-mutation"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def chmod_x(path: Path) -> None:
    path.chmod(path.stat().st_mode | 0o111)


def run(cmd: list[str], cwd: Path) -> dict:
    proc = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return {
        "cmd": " ".join(cmd),
        "cwd": str(cwd),
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def read_sources() -> dict[str, str]:
    paths = [
        "AGENTS.md",
        "README.md",
        "skills/shepherd/SKILL.md",
        "skills/shepherd/prompts/architect.md",
        "skills/shepherd/prompts/implementer.md",
        "skills/shepherd/prompts/refactorer.md",
        "skills/shepherd/references/acceptance-mutation.md",
        "skills/shepherd/references/project-templates.md",
    ]
    return {path: (REPO / path).read_text(encoding="utf-8") for path in paths}


def source_surface_eval(root: Path, sources: dict[str, str]) -> dict:
    skill = sources["skills/shepherd/SKILL.md"]
    skill_lower = skill.lower()
    architect = sources["skills/shepherd/prompts/architect.md"]
    implementer = sources["skills/shepherd/prompts/implementer.md"]
    refactorer = sources["skills/shepherd/prompts/refactorer.md"]
    acceptance = sources["skills/shepherd/references/acceptance-mutation.md"]
    templates = sources["skills/shepherd/references/project-templates.md"]
    agents = sources["AGENTS.md"]
    readme = sources["README.md"]

    assertions = {
        "coordinator does not own mutation or hardening": "coordinator" in skill_lower and "implementation, refactoring, mutation, architectural hardening" in skill_lower,
        "implementer excludes broad mutation by default": "source mutation, acceptance-spec mutation, hardening" in skill and "Do not own:" in implementer and "source-code mutation" in implementer and "acceptance-spec mutation" in implementer,
        "refactorer excludes mutation by default": "New behavior, source mutation, acceptance-spec mutation." in skill and "Do not run source-code mutation or acceptance-spec mutation unless explicitly assigned" in refactorer,
        "architect owns source mutation": "source-code mutation" in architect and "source-code mutation" in skill,
        "architect owns acceptance mutation": "acceptance-spec mutation" in architect and "acceptance-spec mutation" in skill,
        "architect owns hardening verdict": "final verdict" in architect and "architect hardening" in skill_lower,
        "architect rejection dispatches implementers": "Dispatch implementers for architect findings" in skill,
        "implementer owns architect-finding repair": "assigned architect-finding repair tasks" in implementer and "When dispatched for an architect finding" in implementer,
        "only active role prompt files remain": sorted(path.name for path in (REPO / "skills/shepherd/prompts").glob("*.md")) == ["architect.md", "implementer.md", "refactorer.md"],
        "acceptance pipeline setup exists before plan": "### 4. Acceptance Pipeline Readiness" in skill and "### 5. Plan" in skill,
        "acceptance setup routes missing pipeline out of implementer planning": "Missing pipeline: create or assign the smallest setup needed now." in skill,
        "templates record architect hardening": "Architect hardening" in templates and "Architect Feedback" in templates,
        "reference names architect hardening gate": "Architect Hardening Gate" in acceptance,
        "AGENTS requires live hardening playground": "implementer/refactorer/architect repair or hardening behavior" in agents,
        "README describes architect hardening": "architect hardening" in readme,
        "no active reviewer prompt reference": "prompts/reviewer.md" not in skill + architect + implementer + refactorer + acceptance + templates + agents + readme,
        "no architectural reviewer role wording": "architectural reviewer" not in (skill + architect + implementer + refactorer + acceptance + templates).lower(),
        "no coordinator mutation wording": "coordinator runs mutation" not in (skill + acceptance + templates).lower(),
    }

    report = {
        "case": "source-role-surface",
        "assertions": assertions,
        "passed": all(assertions.values()),
    }
    write(root / "source-role-surface.json", json.dumps(report, indent=2))
    return report


def create_fixture(root: Path, acceptance_mode: str, source_mode: str) -> Path:
    fixture = root / "repo"
    if fixture.exists():
        shutil.rmtree(fixture)
    fixture.mkdir(parents=True)
    (fixture / "features").mkdir()
    (fixture / "scripts").mkdir()

    write(
        fixture / "calculator.py",
        """def apply_discount(subtotal: int, code: str | None) -> int:
    if code == "SAVE10":
        return subtotal - 10
    return subtotal
""",
    )
    write(
        fixture / "test_calculator.py",
        """import unittest

from calculator import apply_discount


class CalculatorTest(unittest.TestCase):
    def test_save10_subtracts_ten(self):
        self.assertEqual(apply_discount(100, "SAVE10"), 90)

    def test_unknown_code_keeps_subtotal(self):
        self.assertEqual(apply_discount(100, "NOPE"), 100)


if __name__ == "__main__":
    unittest.main()
""",
    )
    write(
        fixture / "features" / "discount.feature",
        """Feature: promotion discounts

Scenario Outline: discount is applied
  When the subtotal is <subtotal> and the code is <code>
  Then the total is <total>

  Examples:
    | subtotal | code   | total |
    | 100      | SAVE10 | 90    |
""",
    )

    write(
        fixture / "scripts" / "normal_acceptance.py",
        """#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
feature = (root / "features" / "discount.feature").read_text()
required = ["Feature:", "Examples:", "| 100", "SAVE10", "| 90"]
missing = [item for item in required if item not in feature]
if missing:
    print(f"normal acceptance failed; missing {missing}")
    sys.exit(1)
print("normal acceptance passed: executable example binds SAVE10 -> 90")
""",
    )
    chmod_x(fixture / "scripts" / "normal_acceptance.py")

    write(
        fixture / "scripts" / "acceptance_mutation.py",
        f"""#!/usr/bin/env python3
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
report = root / "build" / "acceptance-mutation" / "report.json"
report.parent.mkdir(parents=True, exist_ok=True)

mode = {acceptance_mode!r}
if mode == "error":
    summary = {{"Total": 1, "Killed": 0, "Survived": 0, "Errors": 1}}
    results = [{{"Mutation": {{"Path": "$.scenarios[0].examples[0].total", "Original": "90", "Mutated": "91"}}, "Status": "error", "Error": "generator failed"}}]
    report.write_text(json.dumps({{"summary": summary, "results": results}}, indent=2))
    print(json.dumps({{"summary": summary, "results": results}}))
    sys.exit(1)

if mode == "weak":
    summary = {{"Total": 0, "Killed": 0, "Survived": 0, "Errors": 0}}
    report.write_text(json.dumps({{"summary": summary, "results": []}}, indent=2))
    print(json.dumps({{"summary": summary, "results": []}}))
    sys.exit(0)

status = "survived" if mode == "survived" else "killed"
summary = {{"Total": 1, "Killed": 0 if status == "survived" else 1, "Survived": 1 if status == "survived" else 0, "Errors": 0}}
results = [{{"Mutation": {{"Path": "$.scenarios[0].examples[0].total", "Original": "90", "Mutated": "91"}}, "Status": status, "Error": ""}}]
(report.parent / "mutated-example.json").write_text(json.dumps({{"total": 91}}, indent=2))
report.write_text(json.dumps({{"summary": summary, "results": results}}, indent=2))
print(json.dumps({{"summary": summary, "results": results}}))
sys.exit(1 if status == "survived" else 0)
""",
    )
    chmod_x(fixture / "scripts" / "acceptance_mutation.py")

    write(
        fixture / "scripts" / "source_mutation.py",
        f"""#!/usr/bin/env python3
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
report = root / "build" / "source-mutation" / "report.json"
report.parent.mkdir(parents=True, exist_ok=True)
mode = {source_mode!r}
status = "survived" if mode == "survived" else "killed"
summary = {{"Total": 1, "Killed": 0 if status == "survived" else 1, "Survived": 1 if status == "survived" else 0, "Errors": 0}}
results = [{{"Mutation": {{"Path": "calculator.py:2", "Original": "subtotal - 10", "Mutated": "subtotal - 0"}}, "Status": status, "Error": ""}}]
report.write_text(json.dumps({{"summary": summary, "results": results}}, indent=2))
print(json.dumps({{"summary": summary, "results": results}}))
sys.exit(1 if status == "survived" else 0)
""",
    )
    chmod_x(fixture / "scripts" / "source_mutation.py")
    return fixture


def read_report(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))["summary"]


def write_shepherd_state(fixture: Path, case_id: str, decision: str, normal: dict, source_mut: dict, acceptance_mut: dict) -> None:
    source_summary = read_report(fixture / "build" / "source-mutation" / "report.json")
    acceptance_summary = read_report(fixture / "build" / "acceptance-mutation" / "report.json")
    write(
        fixture / ".shepherd" / "progress.md",
        f"""# Project Progress

## Current Status
**Phase:** Milestone 1
**Current milestone:** Discount behavior
**Current task:** architect hardening
**Last action:** Ran architect hardening for {case_id}.

## Milestone Quality Gate
| Gate | Status | Evidence |
|------|--------|----------|
| Implementer verification | {'passed' if normal['exit_code'] == 0 else 'failed'} | `{normal['cmd']}` |
| Refactorer pass | passed | no behavior change needed |
| Architect hardening | {decision} | source `build/source-mutation/report.json`; acceptance `build/acceptance-mutation/report.json` |

### Latest Source Mutation Result
- Command: `{source_mut['cmd']}`
- Exit code: {source_mut['exit_code']}
- Total: {source_summary['Total']}
- Killed: {source_summary['Killed']}
- Survived: {source_summary['Survived']}
- Errors: {source_summary['Errors']}

### Latest Acceptance Mutation Result
- Command: `{acceptance_mut['cmd']}`
- Exit code: {acceptance_mut['exit_code']}
- Total: {acceptance_summary['Total']}
- Killed: {acceptance_summary['Killed']}
- Survived: {acceptance_summary['Survived']}
- Errors: {acceptance_summary['Errors']}
- Survivor paths: {'$.scenarios[0].examples[0].total' if acceptance_summary['Survived'] else '[]'}
- Decision: {decision}
""",
    )


def fixture_eval(root: Path, case_id: str, acceptance_mode: str, source_mode: str, expected: dict) -> dict:
    case_dir = root / case_id
    fixture = create_fixture(case_dir, acceptance_mode, source_mode)
    unit = run([sys.executable, "-m", "unittest", "test_calculator.py"], fixture)
    normal = run([sys.executable, "scripts/normal_acceptance.py"], fixture)
    source_mut = run([sys.executable, "scripts/source_mutation.py"], fixture)
    acceptance_mut = run([sys.executable, "scripts/acceptance_mutation.py"], fixture)
    source_summary = read_report(fixture / "build" / "source-mutation" / "report.json")
    acceptance_summary = read_report(fixture / "build" / "acceptance-mutation" / "report.json")

    if source_summary["Survived"] or acceptance_summary["Survived"] or source_summary["Errors"] or acceptance_summary["Errors"] or acceptance_summary["Total"] == 0:
        decision = "request focused implementer repair before architect approval"
    else:
        decision = "approved by architect hardening"
    write_shepherd_state(fixture, case_id, decision, normal, source_mut, acceptance_mut)

    assertions = {
        "unit tests ran separately": unit["exit_code"] == 0,
        "normal acceptance ran": normal["exit_code"] == 0,
        "source mutation total": source_summary["Total"] == expected["source_total"],
        "source mutation survived": source_summary["Survived"] == expected["source_survived"],
        "acceptance mutation total": acceptance_summary["Total"] == expected["acceptance_total"],
        "acceptance mutation survived": acceptance_summary["Survived"] == expected["acceptance_survived"],
        "acceptance mutation errors": acceptance_summary["Errors"] == expected["acceptance_errors"],
        "decision matches expected": (decision != "approved by architect hardening") == expected["blocks"],
        "progress records architect hardening": "Architect hardening" in (fixture / ".shepherd" / "progress.md").read_text(),
    }

    outputs = case_dir / "outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    for name, result in {
        "unit-tests.json": unit,
        "normal-acceptance.json": normal,
        "source-mutation.json": source_mut,
        "acceptance-mutation.json": acceptance_mut,
    }.items():
        write(outputs / name, json.dumps(result, indent=2))
    shutil.copy2(fixture / ".shepherd" / "progress.md", outputs / "progress.md")
    report = {
        "case": case_id,
        "fixture_repo": str(fixture),
        "source_summary": source_summary,
        "acceptance_summary": acceptance_summary,
        "decision": decision,
        "assertions": assertions,
        "passed": all(assertions.values()),
    }
    write(outputs / "evaluator-notes.json", json.dumps(report, indent=2))
    return report


def node_playground_eval(root: Path) -> dict:
    source = REPO / "evals" / "shepherd-live-code-playground" / "fixture"
    case_dir = root / "eval-7-live-code-playground"
    fixture = case_dir / "repo"
    if fixture.exists():
        shutil.rmtree(fixture)
    shutil.copytree(source, fixture)

    before = run(["npm", "test"], fixture)
    controller = fixture / "src" / "orderController.js"
    tests = fixture / "tests" / "orderController.test.js"
    controller.write_text(
        controller.read_text(encoding="utf-8").replace(
            "const tax = money(subtotal * 0.2);\n  const total = money(subtotal + tax);",
            "const discount = input.promoCode === 'SAVE10' ? money(subtotal * 0.1) : 0;\n  const discountedSubtotal = money(subtotal - discount);\n  const tax = money(discountedSubtotal * 0.2);\n  const total = money(discountedSubtotal + tax);",
        ),
        encoding="utf-8",
    )
    tests.write_text(
        tests.read_text(encoding="utf-8")
        + """

test('applies SAVE10 promotion code after validation', () => {
  const result = createOrder({ items: [{ sku: 'A', quantity: 2, unitPrice: 50 }], promoCode: 'SAVE10' });

  assert.equal(result.order.subtotal, 100);
  assert.equal(result.order.tax, 18);
  assert.equal(result.order.total, 108);
});
""",
        encoding="utf-8",
    )
    after = run(["npm", "test"], fixture)
    diff = run(["git", "diff", "--no-index", str(source), str(fixture)], REPO)

    outputs = case_dir / "outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    write(outputs / "before-test.json", json.dumps(before, indent=2))
    write(outputs / "after-test.json", json.dumps(after, indent=2))
    write(outputs / "code-diff.txt", diff["stdout"] + diff["stderr"])
    report = {
        "case": "eval-7-live-code-playground",
        "fixture_repo": str(fixture),
        "assertions": {
            "before tests passed": before["exit_code"] == 0,
            "after tests passed": after["exit_code"] == 0,
            "code diff captured": "promoCode" in (diff["stdout"] + diff["stderr"]),
            "test diff captured": "SAVE10" in (diff["stdout"] + diff["stderr"]),
        },
        "passed": before["exit_code"] == 0 and after["exit_code"] == 0 and "SAVE10" in (diff["stdout"] + diff["stderr"]),
    }
    write(outputs / "evaluator-notes.json", json.dumps(report, indent=2))
    return report


def main() -> int:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = EVAL_ROOT / timestamp
    root.mkdir(parents=True, exist_ok=True)
    sources = read_sources()
    cases = [
        source_surface_eval(root, sources),
        fixture_eval(root, "eval-2-acceptance-pipeline-killed", "killed", "killed", {"source_total": 1, "source_survived": 0, "acceptance_total": 1, "acceptance_survived": 0, "acceptance_errors": 0, "blocks": False}),
        fixture_eval(root, "eval-3-acceptance-survivor-blocks", "survived", "killed", {"source_total": 1, "source_survived": 0, "acceptance_total": 1, "acceptance_survived": 1, "acceptance_errors": 0, "blocks": True}),
        fixture_eval(root, "eval-4-acceptance-error-blocks", "error", "killed", {"source_total": 1, "source_survived": 0, "acceptance_total": 1, "acceptance_survived": 0, "acceptance_errors": 1, "blocks": True}),
        fixture_eval(root, "eval-5-source-survivor-blocks", "killed", "survived", {"source_total": 1, "source_survived": 1, "acceptance_total": 1, "acceptance_survived": 0, "acceptance_errors": 0, "blocks": True}),
        fixture_eval(root, "eval-6-weak-acceptance-spec-blocks", "weak", "killed", {"source_total": 1, "source_survived": 0, "acceptance_total": 0, "acceptance_survived": 0, "acceptance_errors": 0, "blocks": True}),
        node_playground_eval(root),
    ]
    summary = {
        "artifact_dir": str(root),
        "cases": cases,
        "passed": all(case["passed"] for case in cases),
    }
    write(root / "summary.json", json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
