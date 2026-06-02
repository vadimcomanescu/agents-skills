#!/usr/bin/env python3
"""Behavioral evals for the Shepherd acceptance-pipeline-kit integration.

Two independent layers, mirroring the creating-skills eval-type split:

  source-surface (always runs, no kit needed)
    Text assertions over the Shepherd skill files proving the workflow is wired
    to use the kit DIRECTLY: role ownership, the per-language kit scripts the
    workflow calls, the install/record-in-standards step, completion gates, and
    blockers. No Shepherd-side wrapper script should be referenced.

  live-pipeline (runs only with --live and an acceptance-pipeline-kit checkout)
    Calls the kit's own `acceptance.sh` / `acceptance-mutation.sh` against
    fixtures derived from the kit's calculator example and checks the exit code
    and the kit's JSON report classify killed / survived / error / no-mutations
    as the skill tells the architect to read them.

Usage:
  run_behavioral_evals.py                          # source-surface only
  run_behavioral_evals.py --live --kit-dir <path>  # also run the real kit
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
SHEPHERD = REPO / "skills" / "shepherd"


def read(path: str) -> str:
    target = REPO / path
    return target.read_text(encoding="utf-8") if target.exists() else ""


# --- layer 1: source-surface assertions --------------------------------------


def source_surface() -> dict:
    skill = read("skills/shepherd/SKILL.md")
    implementer = read("skills/shepherd/prompts/implementer.md")
    architect = read("skills/shepherd/prompts/architect.md")
    refactorer = read("skills/shepherd/prompts/refactorer.md")
    reference = read("skills/shepherd/references/acceptance-mutation.md")
    templates = read("skills/shepherd/references/project-templates.md")
    all_text = skill + implementer + architect + refactorer + reference + templates

    assertions = {
        "reference documents the kit and its scripts": (
            "acceptance-pipeline-kit" in reference and "acceptance-mutation.sh" in reference
        ),
        "reference keeps APS result terms": all(t in reference for t in ("killed", "survived", "error")),
        "reference names normal vs acceptance-spec mutation layers": (
            "normal acceptance" in reference.lower() and "acceptance-spec mutation" in reference.lower()
        ),
        "reference has a per-language invocation table": all(
            t in reference for t in ("pytest", "vitest", "cargo test", "go test")
        ),
        "no Shepherd-side wrapper script is referenced": (
            "acceptance_pipeline.py" not in all_text and "validate_acceptance_mutation.py" not in all_text
        ),
        "skill calls the kit scripts directly": "acceptance-mutation.sh" in skill,
        "skill references the mechanics doc": "references/acceptance-mutation.md" in skill,
        "skill records kit commands in standards.md": ".shepherd/standards.md" in skill,
        "implementer owns normal acceptance via kit script": (
            "acceptance.sh" in implementer and "normal acceptance" in implementer.lower()
        ),
        "implementer does not own acceptance-spec mutation": (
            "acceptance-spec mutation" in implementer.lower() and "Do not own" in implementer
        ),
        "architect runs acceptance-spec mutation via kit script": (
            "acceptance-mutation.sh" in architect and "acceptance-spec mutation" in architect.lower()
        ),
        "architect judges by exit code and report": (
            "exit code" in architect.lower() and "report" in architect.lower()
        ),
        "architect blocks on survivors or errors": (
            "surviv" in architect.lower() and "error" in architect.lower()
        ),
        "architect routes findings to implementer repair": (
            "implementer" in architect.lower() and "repair" in architect.lower()
        ),
        "refactorer excludes acceptance-spec mutation": "acceptance-spec mutation" in refactorer.lower(),
        "milestone loop invokes acceptance-spec mutation": "acceptance-spec mutation" in skill.lower(),
        "blockers gate on surviving or errored mutations": (
            "surviv" in skill.lower() and "acceptance-spec mutation" in skill.lower()
        ),
        "templates record acceptance + mutation commands": (
            "acceptance.sh" in templates and "acceptance-mutation.sh" in templates
        ),
        "skill stays within 500 lines": len(skill.splitlines()) < 500,
    }
    return {"case": "source-surface", "assertions": assertions, "passed": all(assertions.values())}


# --- layer 2: live pipeline against the real kit (called directly) -----------


def _venv_env(venv: Path) -> dict:
    env = os.environ.copy()
    bin_dir = venv / ("Scripts" if os.name == "nt" else "bin")
    local_bin = str(Path.home() / ".local" / "bin")
    env["PATH"] = f"{bin_dir}{os.pathsep}{local_bin}{os.pathsep}{env.get('PATH', '')}"
    env["VIRTUAL_ENV"] = str(venv)
    return env


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


def _summary(stdout: str) -> dict:
    """The kit writes its JSON report to stdout (progress goes to stderr)."""
    data = json.loads(stdout.strip())
    raw = data.get("summary", {})
    return {str(k).lower(): v for k, v in raw.items()}


def live_pipeline(kit_dir: Path, workspace: Path) -> dict:
    venv = workspace / "venv"
    subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    env = _venv_env(venv)
    pip = str(venv / ("Scripts" if os.name == "nt" else "bin") / "pip")
    setup = subprocess.run([pip, "install", "-q", "-e", str(kit_dir / "python"), "pytest"],
                           text=True, capture_output=True, check=False)
    if setup.returncode != 0:
        return {"case": "live-pipeline", "passed": False,
                "error": "could not install kit python env", "detail": setup.stderr[-2000:]}
    if shutil.which("gherkin-mutator", path=env["PATH"]) is None:
        subprocess.run(["bash", str(kit_dir / "install.sh")], env=env, check=False)
    if shutil.which("gherkin-mutator", path=env["PATH"]) is None:
        return {"case": "live-pipeline", "passed": False, "error": "APS binaries unavailable"}

    acc = str(kit_dir / "python" / "scripts" / "acceptance.sh")
    mut = str(kit_dir / "python" / "scripts" / "acceptance-mutation.sh")
    calc = kit_dir / "python" / "examples" / "calculator"
    checks: list[dict] = []

    def run(script: str, fixture: Path, *extra: str) -> subprocess.CompletedProcess:
        return subprocess.run(["bash", script, *extra], cwd=str(fixture), env=env,
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def mutation_check(name: str, fixture: Path, want_exit: int, predicate, prep=None) -> None:
        if prep:
            prep(fixture)
        proc = run(mut, fixture, "--json", "--level", "full")
        summary = {}
        try:
            summary = _summary(proc.stdout)
        except Exception:
            pass
        ok = proc.returncode == want_exit and predicate(summary)
        checks.append({"id": name, "expected_exit": want_exit, "actual_exit": proc.returncode,
                       "summary": summary, "passed": ok})

    # normal acceptance on the unmodified example -> exit 0
    killed = _make_fixture(calc, workspace / "fx-killed")
    _strip_feature_stamp(killed / "features" / "calculator.feature")
    a = run(acc, killed)
    checks.append({"id": "normal-acceptance-passes", "expected_exit": 0,
                   "actual_exit": a.returncode, "passed": a.returncode == 0})

    # killed: every mutation killed -> exit 0, survived=0 errors=0 total>0
    mutation_check("killed", killed, 0,
                   lambda s: s.get("survived") == 0 and s.get("errors") == 0 and s.get("total", 0) > 0)

    # survivor: handler ignores the example value -> exit 1, survived>0
    def weaken(fx: Path) -> None:
        h = fx / "handlers" / "calculator_handlers.py"
        h.write_text(h.read_text().replace(
            'assert world["calc"].value == int(ex["sum"]), (\n        f"expected {ex[\'sum\']}, got {world[\'calc\'].value}"\n    )',
            'assert isinstance(world["calc"].value, int)  # WEAK: ignores ex["sum"]'),
            encoding="utf-8")
        _strip_feature_stamp(fx / "features" / "calculator.feature")
    mutation_check("survivor", _make_fixture(calc, workspace / "fx-survivor"), 1,
                   lambda s: s.get("survived", 0) > 0, prep=weaken)

    # error: broken handler import -> exit 1, errors>0
    def break_import(fx: Path) -> None:
        c = fx / "conftest.py"
        c.write_text(c.read_text() + "\nimport does_not_exist_xyz  # force error\n", encoding="utf-8")
        _strip_feature_stamp(fx / "features" / "calculator.feature")
    mutation_check("error", _make_fixture(calc, workspace / "fx-error"), 1,
                   lambda s: s.get("errors", 0) > 0, prep=break_import)

    # no-mutations: no examples -> kit exits 0 with total=0 (the false-green the
    # architect must catch per references/acceptance-mutation.md). Assert total==0.
    def no_examples(fx: Path) -> None:
        (fx / "features" / "calculator.feature").write_text(
            "Feature: Calculator\n  Scenario: addition has no examples\n"
            "    Given a fresh calculator\n    When I add 1 and 2\n    Then the result is 3\n",
            encoding="utf-8")
    mutation_check("no-mutations-total-zero", _make_fixture(calc, workspace / "fx-none"), 0,
                   lambda s: s.get("total", -1) == 0, prep=no_examples)

    return {"case": "live-pipeline", "checks": checks, "passed": all(c["passed"] for c in checks)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--kit-dir", type=Path, default=Path(os.environ.get("APS_KIT_DIR", "")))
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "last-run.json")
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

    report = {"ran_at": datetime.now(timezone.utc).isoformat(), "live": args.live,
              "live_skipped": live_skipped, "cases": cases,
              "passed": all(c["passed"] for c in cases)}
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    for case in cases:
        print(f"[{case['case']}] passed={case['passed']}")
        for key, value in (case.get("assertions") or {}).items():
            if not value:
                print(f"    FAIL assertion: {key}")
        for check in (case.get("checks") or []):
            mark = "ok" if check["passed"] else "FAIL"
            print(f"    {mark} {check['id']} exit={check['actual_exit']}/{check['expected_exit']} "
                  f"summary={check.get('summary')}")
        if case.get("error"):
            print(f"    ERROR: {case['error']}")
    if live_skipped:
        print(f"[live-pipeline] SKIPPED: {live_skipped}")
    print(f"wrote {args.out}")
    print("RESULT:", "PASS" if report["passed"] else "FAIL")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
