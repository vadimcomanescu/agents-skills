#!/usr/bin/env python3
"""Behavioral evals for the Shepherd acceptance-pipeline-kit integration.

Two independent layers, mirroring the creating-skills eval-type split:

  source-surface (always runs, no kit needed)
    Text assertions over the Shepherd skill files proving the workflow is wired:
    role ownership, the scripts the workflow invokes, completion gates, and
    blockers. This is the "does the workflow enter the right phase" check.

  live-pipeline (runs only with --live and an acceptance-pipeline-kit checkout)
    Drives the real kit through `acceptance_pipeline.py` against fixtures
    derived from the kit's own calculator example, proving the scripts classify
    killed / survived / error / no-mutations correctly. This is the "the tool
    the skill references actually runs and produces the claimed artifact" check.

Usage:
  run_behavioral_evals.py                          # source-surface only
  run_behavioral_evals.py --live --kit-dir <path>  # also run the real pipeline
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "skills" / "shepherd" / "scripts"


def read(path: str) -> str:
    target = REPO / path
    if not target.exists():
        return ""
    return target.read_text(encoding="utf-8")


# --- layer 1: source-surface assertions --------------------------------------


def source_surface() -> dict:
    skill = read("skills/shepherd/SKILL.md")
    implementer = read("skills/shepherd/prompts/implementer.md")
    architect = read("skills/shepherd/prompts/architect.md")
    refactorer = read("skills/shepherd/prompts/refactorer.md")
    reference = read("skills/shepherd/references/acceptance-mutation.md")
    templates = read("skills/shepherd/references/project-templates.md")

    assertions = {
        "reference exists with kit mechanics": (
            "acceptance-pipeline-kit" in reference
            and "acceptance_pipeline.py" in reference
        ),
        "reference keeps APS result terms": all(
            term in reference for term in ("killed", "survived", "error")
        ),
        "reference names normal vs acceptance-spec mutation layers": (
            "normal acceptance" in reference.lower()
            and "acceptance-spec mutation" in reference.lower()
        ),
        "skill points at the orchestrator script": "acceptance_pipeline.py" in skill,
        "skill points at the gate validator": "validate_acceptance_mutation.py" in skill,
        "skill references the mechanics doc": "references/acceptance-mutation.md" in skill,
        "implementer owns normal acceptance pipeline components": (
            "normal acceptance" in implementer.lower()
            and "acceptance_pipeline.py acceptance" in implementer
        ),
        "implementer does not own acceptance-spec mutation": (
            "acceptance-spec mutation" in implementer.lower()
            and "Do not own" in implementer
        ),
        "architect owns acceptance-spec mutation hardening": (
            "acceptance_pipeline.py" in architect
            and "acceptance-spec mutation" in architect.lower()
        ),
        "architect blocks on survivors or errors": (
            "surviv" in architect.lower() and "error" in architect.lower()
        ),
        "architect routes findings to implementer repair": (
            "implementer" in architect.lower() and "repair" in architect.lower()
        ),
        "refactorer excludes acceptance-spec mutation": (
            "acceptance-spec mutation" in refactorer.lower()
        ),
        "coordinator does not own mutation hardening": (
            "hardening" in skill.lower()
            and "Architect" in skill
        ),
        "milestone loop invokes acceptance-spec mutation in hardening": (
            "acceptance-spec mutation" in skill.lower()
        ),
        "blockers gate on surviving or errored mutations": (
            "surviv" in skill.lower()
            and "acceptance-spec mutation" in skill.lower()
        ),
        "standards step records kit commands": (
            "acceptance" in skill.lower() and ".shepherd/acceptance.json" in skill
        ),
        "templates record acceptance + mutation hardening": (
            "Acceptance" in templates and "mutation" in templates.lower()
        ),
        "skill stays within 500 lines": len(skill.splitlines()) < 500,
    }
    return {
        "case": "source-surface",
        "assertions": assertions,
        "passed": all(assertions.values()),
    }


# --- layer 2: live pipeline against the real kit ------------------------------


def _venv_env(venv: Path) -> dict:
    env = os.environ.copy()
    bin_dir = venv / ("Scripts" if os.name == "nt" else "bin")
    local_bin = str(Path.home() / ".local" / "bin")
    env["PATH"] = f"{bin_dir}{os.pathsep}{local_bin}{os.pathsep}{env.get('PATH', '')}"
    env["VIRTUAL_ENV"] = str(venv)
    return env


def _run(cmd: list[str], cwd: Path, env: dict) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(cwd), env=env, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)


def _make_fixture(src: Path, dest: Path) -> Path:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)
    for stale in ("build", "acceptance"):
        shutil.rmtree(dest / stale, ignore_errors=True)
    return dest


def _strip_feature_stamp(feature: Path) -> None:
    lines = [ln for ln in feature.read_text().splitlines() if not ln.startswith("#")]
    feature.write_text("\n".join(lines) + "\n", encoding="utf-8")


def live_pipeline(kit_dir: Path, workspace: Path) -> dict:
    pipeline = str(SCRIPTS / "acceptance_pipeline.py")
    venv = workspace / "venv"
    subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    env = _venv_env(venv)
    pip = str(venv / ("Scripts" if os.name == "nt" else "bin") / "pip")
    setup = subprocess.run(
        [pip, "install", "-q", "-e", str(kit_dir / "python"), "pytest"],
        text=True, capture_output=True, check=False,
    )
    if setup.returncode != 0:
        return {"case": "live-pipeline", "passed": False,
                "error": "could not install kit python env", "detail": setup.stderr[-2000:]}

    # ensure binaries are on PATH (install only if missing)
    ensure = _run([sys.executable, pipeline, "--kit-dir", str(kit_dir), "ensure-tools"], workspace, env)
    if shutil.which("gherkin-mutator", path=env["PATH"]) is None:
        return {"case": "live-pipeline", "passed": False,
                "error": "APS tools unavailable after ensure-tools", "detail": ensure.stdout[-2000:]}

    calc = kit_dir / "python" / "examples" / "calculator"
    checks = []

    def mutation_check(name: str, fixture: Path, expect_rc: int, require: bool, prep=None) -> None:
        if prep:
            prep(fixture)
        ev = workspace / f"ev-{name}"
        cmd = [sys.executable, pipeline, "--kit-dir", str(kit_dir), "--language", "python",
               "--project-dir", str(fixture), "--evidence-dir", str(ev), "--level", "full"]
        if require:
            cmd.append("--require-mutations")
        cmd.append("mutation")
        proc = _run(cmd, workspace, env)
        verdict_path = ev / "verdict.json"
        verdict = json.loads(verdict_path.read_text()) if verdict_path.exists() else {}
        checks.append({
            "id": name,
            "expected_exit": expect_rc,
            "actual_exit": proc.returncode,
            "decision": verdict.get("decision"),
            "summary": verdict.get("summary"),
            "passed": proc.returncode == expect_rc,
            "tail": proc.stdout[-600:],
        })

    # killed: the kit's own calculator example -> PASS
    killed = _make_fixture(calc, workspace / "fx-killed")
    _strip_feature_stamp(killed / "features" / "calculator.feature")
    acc = _run([sys.executable, pipeline, "--kit-dir", str(kit_dir), "--language", "python",
                "--project-dir", str(killed), "--evidence-dir", str(workspace / "ev-acc"),
                "acceptance"], workspace, env)
    checks.append({"id": "normal-acceptance-passes", "expected_exit": 0,
                   "actual_exit": acc.returncode, "passed": acc.returncode == 0,
                   "tail": acc.stdout[-400:]})
    mutation_check("killed", killed, expect_rc=0, require=True)

    # survivor: weaken the sum assertion so it never reads the example value
    def weaken(fx: Path) -> None:
        h = fx / "handlers" / "calculator_handlers.py"
        text = h.read_text()
        text = text.replace(
            'assert world["calc"].value == int(ex["sum"]), (\n        f"expected {ex[\'sum\']}, got {world[\'calc\'].value}"\n    )',
            'assert isinstance(world["calc"].value, int)  # WEAK: ignores ex["sum"]',
        )
        h.write_text(text, encoding="utf-8")
        _strip_feature_stamp(fx / "features" / "calculator.feature")
    mutation_check("survivor", _make_fixture(calc, workspace / "fx-survivor"),
                   expect_rc=1, require=True, prep=weaken)

    # no-mutations: a plain scenario with no examples
    def no_examples(fx: Path) -> None:
        (fx / "features" / "calculator.feature").write_text(
            "Feature: Calculator\n  Scenario: addition has no examples\n"
            "    Given a fresh calculator\n    When I add 1 and 2\n    Then the result is 3\n",
            encoding="utf-8",
        )
    mutation_check("no-mutations", _make_fixture(calc, workspace / "fx-none"),
                   expect_rc=1, require=True, prep=no_examples)

    # error: break the handler import so the pipeline itself fails
    def break_import(fx: Path) -> None:
        conftest = fx / "conftest.py"
        conftest.write_text(conftest.read_text() + "\nimport does_not_exist_xyz  # force error\n",
                            encoding="utf-8")
        _strip_feature_stamp(fx / "features" / "calculator.feature")
    mutation_check("error", _make_fixture(calc, workspace / "fx-error"),
                   expect_rc=1, require=False, prep=break_import)

    return {"case": "live-pipeline", "checks": checks,
            "passed": all(c["passed"] for c in checks)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--live", action="store_true", help="also run the real kit pipeline")
    parser.add_argument("--kit-dir", type=Path, default=Path(os.environ.get("APS_KIT_DIR", "")),
                        help="acceptance-pipeline-kit checkout (or APS_KIT_DIR)")
    parser.add_argument("--out", type=Path,
                        default=Path(__file__).resolve().parent / "last-run.json")
    parser.add_argument("--keep-workspace", action="store_true")
    args = parser.parse_args()

    cases = [source_surface()]
    live_skipped = None
    if args.live:
        if not args.kit_dir or not args.kit_dir.exists():
            live_skipped = "live requested but --kit-dir / APS_KIT_DIR not set to a checkout"
        else:
            workspace = Path(tempfile.mkdtemp(prefix="shepherd-acc-eval-"))
            try:
                cases.append(live_pipeline(args.kit_dir.resolve(), workspace))
            finally:
                if not args.keep_workspace:
                    shutil.rmtree(workspace, ignore_errors=True)

    report = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "live": args.live,
        "live_skipped": live_skipped,
        "cases": cases,
        "passed": all(case["passed"] for case in cases),
    }
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    for case in cases:
        print(f"[{case['case']}] passed={case['passed']}")
        for key, value in (case.get("assertions") or {}).items():
            if not value:
                print(f"    FAIL assertion: {key}")
        for check in (case.get("checks") or []):
            mark = "ok" if check["passed"] else "FAIL"
            print(f"    {mark} {check['id']} exit={check['actual_exit']}/{check['expected_exit']} "
                  f"decision={check.get('decision')}")
        if case.get("error"):
            print(f"    ERROR: {case['error']}")
    if live_skipped:
        print(f"[live-pipeline] SKIPPED: {live_skipped}")
    print(f"wrote {args.out}")
    print("RESULT:", "PASS" if report["passed"] else "FAIL")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
