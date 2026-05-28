#!/usr/bin/env python3
"""Run Shepherd verification gate scripts against deterministic fixtures."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


CHECKS = [
    {
        "id": "positive-complete.verification",
        "cmd": ["validate_verification.py", "positive-complete/verification.md"],
        "expect": 0,
    },
    {
        "id": "positive-complete.evidence",
        "cmd": ["validate_evidence.py", "positive-complete/verification.md"],
        "expect": 0,
    },
    {
        "id": "positive-complete.final-report",
        "cmd": ["validate_final_report.py", "positive-complete/verification.md", "positive-complete/final-report.md"],
        "expect": 0,
    },
    {
        "id": "missing-browser-screenshot.evidence",
        "cmd": ["validate_evidence.py", "missing-browser-screenshot/verification.md"],
        "expect": 1,
    },
    {
        "id": "auth-redirect-wrong-page.evidence",
        "cmd": ["validate_evidence.py", "auth-redirect-wrong-page/verification.md"],
        "expect": 1,
    },
    {
        "id": "multi-step-browser-proof.evidence",
        "cmd": ["validate_evidence.py", "multi-step-browser-proof/verification.md"],
        "expect": 1,
    },
    {
        "id": "state-api-ui-only-proof.evidence",
        "cmd": ["validate_evidence.py", "state-api-ui-only-proof/verification.md"],
        "expect": 1,
    },
    {
        "id": "stale-evidence.verification",
        "cmd": ["validate_verification.py", "stale-evidence/verification.md"],
        "expect": 1,
    },
    {
        "id": "stale-evidence.freshness",
        "cmd": ["validate_freshness.py", "stale-evidence/verification.md"],
        "expect": 1,
    },
    {
        "id": "missing-final-ac-evidence.final-report",
        "cmd": [
            "validate_final_report.py",
            "missing-final-ac-evidence/verification.md",
            "missing-final-ac-evidence/evidence/final-report.md",
        ],
        "expect": 1,
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deterministic Shepherd verification fixture evals.")
    parser.add_argument("--fixtures", type=Path, required=True, help="Fixture root directory")
    parser.add_argument("--out", type=Path, required=True, help="JSON report output path")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    fixture_root = args.fixtures.resolve()
    results = []
    failed = False

    for check in CHECKS:
      command = [sys.executable, str(script_dir / check["cmd"][0]), *[str(fixture_root / arg) for arg in check["cmd"][1:]]]
      result = subprocess.run(command, cwd=fixture_root, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
      passed = result.returncode == check["expect"]
      failed = failed or not passed
      results.append(
          {
              "id": check["id"],
              "command": command,
              "expected_exit": check["expect"],
              "actual_exit": result.returncode,
              "passed": passed,
              "stdout": result.stdout.strip(),
              "stderr": result.stderr.strip(),
          }
      )

    report = {
        "fixture_root": str(fixture_root),
        "checks": results,
        "passed": not failed,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"wrote {args.out}")
    print(f"PASS: {sum(1 for result in results if result['passed'])}/{len(results)} fixture checks matched expected outcomes")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
