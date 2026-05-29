#!/usr/bin/env python3
"""Deterministic engine hooks used only by Ulisse fixture verification."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path.cwd()


def read_prd() -> list[dict]:
    with (ROOT / "prd.json").open() as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise SystemExit("prd.json must be a list")
    return data


def write_prd(items: list[dict]) -> None:
    (ROOT / "prd.json").write_text(json.dumps(items, indent=2) + "\n")


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def next_item(items: list[dict], key: str) -> dict | None:
    for item in items:
        if not item.get(key, False):
            return item
    return None


def architecture() -> None:
    path = ROOT / "engine" / "architecture-decisions.json"
    decisions = [
        {
            "id": "brownfield-fit",
            "title": "Extend the existing repository",
            "decision": "Use the target repo's existing Python package and Makefile contract.",
            "evidence": ["target-docs/INDEX.md", "BUILD_GUIDE.md", "prd.json"],
            "impact": "The sample feature is added as a small module plus tests.",
        }
    ]
    path.write_text(json.dumps(decisions, indent=2) + "\n")
    print("Fixture architecture decisions written")


def build() -> None:
    items = read_prd()
    item = next_item(items, "build_pass")
    if item is None:
        print("<promise>COMPLETE</promise>")
        return

    package_dir = ROOT / "src" / "sample_app"
    tests_dir = ROOT / "tests"
    package_dir.mkdir(parents=True, exist_ok=True)
    tests_dir.mkdir(parents=True, exist_ok=True)
    init_path = package_dir / "__init__.py"
    existing_init = init_path.read_text() if init_path.exists() else ""
    if "from .counter import increment" not in existing_init:
        init_path.write_text(existing_init.rstrip() + "\n\nfrom .counter import increment\n")
    (package_dir / "counter.py").write_text(
        'def increment(value: int) -> int:\n'
        '    """Return the next counter value."""\n'
        '    return value + 1\n'
    )
    (tests_dir / "test_counter.py").write_text(
        "from sample_app import increment\n\n\n"
        "def test_counter_should_increment_value():\n"
        "    assert increment(1) == 2\n"
    )

    run(["make", "check"])
    run(["make", "test"])

    item["build_pass"] = True
    write_prd(items)

    progress = ROOT / "build-progress.txt"
    with progress.open("a") as fh:
        fh.write(f"- Built {item['id']} with fixture engine; make check and make test passed.\n")

    print("<promise>NEXT</promise>")


def qa() -> None:
    items = read_prd()
    item = next_item(items, "qa_pass")
    if item is None:
        print("<promise>NEXT</promise>")
        return

    run(["make", "check"])
    run(["make", "test"])
    if (ROOT / "Makefile").read_text().find("test-e2e:") >= 0:
        run(["make", "test-e2e"])

    item["qa_pass"] = True
    write_prd(items)

    report_path = ROOT / "qa-report.json"
    try:
        report = json.loads(report_path.read_text())
    except Exception:
        report = []
    report.append(
        {
            "feature_id": item["id"],
            "attempt": 1,
            "status": "pass",
            "tested_steps": item.get("steps", []),
            "bugs_found": [],
            "fix_description": "Fixture QA verified make check, make test, and make test-e2e.",
        }
    )
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("<promise>NEXT</promise>")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"architecture", "build", "qa"}:
        print("usage: fixture-engine.py architecture|build|qa", file=sys.stderr)
        return 2
    {"architecture": architecture, "build": build, "qa": qa}[sys.argv[1]]()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
