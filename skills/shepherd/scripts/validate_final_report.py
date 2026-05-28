#!/usr/bin/env python3
"""Validate that a Shepherd final report or dossier covers every AC in the verification report."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from shepherd_verification import VerificationError, parse_verification_table


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fail closed when a Shepherd final report omits AC IDs or required evidence fields."
    )
    parser.add_argument("report_map", type=Path, help="Path to .shepherd/verification.md")
    parser.add_argument("report", type=Path, help="Path to final report or evidence dossier")
    args = parser.parse_args()

    try:
        _, rows = parse_verification_table(args.report_map)
        report_text = args.report.read_text(encoding="utf-8")
        failures: list[str] = []

        for row in rows:
            if not re.search(rf"\b{re.escape(row.ac_id)}\b", report_text):
                failures.append(f"{row.ac_id}: missing from final report")

        required_terms = [
            "proof modality",
            "required artifact",
            "evidence",
            "verified",
            "evidence state",
            "waiver",
            "qa result",
        ]
        lowered = report_text.lower()
        for term in required_terms:
            if term not in lowered:
                failures.append(f"final report missing required field label: {term}")

        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1

        print(f"PASS: {args.report} covers all {len(rows)} AC IDs")
        return 0
    except (VerificationError, OSError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
