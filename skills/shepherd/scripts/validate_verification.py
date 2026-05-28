#!/usr/bin/env python3
"""Validate Shepherd verification report structure and final verdict completeness."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shepherd_verification import (
    FINAL_VERDICTS,
    PASS_VERDICTS,
    REQUIRED_COLUMNS,
    WAIVED_VERDICTS,
    VerificationError,
    is_pending,
    parse_verification_table,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fail closed when a Shepherd verification report is incomplete or unauditable."
    )
    parser.add_argument("report", type=Path, help="Path to .shepherd/verification.md")
    parser.add_argument(
        "--allow-pending",
        action="store_true",
        help="Allow pending QA results during setup or in-progress milestones.",
    )
    args = parser.parse_args()

    try:
        headers, rows = parse_verification_table(args.report)
        failures: list[str] = []

        missing_headers = [column for column in REQUIRED_COLUMNS if column not in headers]
        if missing_headers:
            failures.append(f"missing required columns: {', '.join(missing_headers)}")

        seen: set[str] = set()
        for row in rows:
            ac = row.ac_id or f"row {row.row_number}"
            if not row.ac_id:
                failures.append(f"row {row.row_number}: missing AC ID")
            elif row.ac_id in seen:
                failures.append(f"{row.ac_id}: duplicate AC ID")
            seen.add(row.ac_id)

            required_fields = [
                "Proof modality",
                "Required artifacts",
                "Milestone",
                "QA result",
                "Evidence",
                "Verified revision",
                "Evidence state",
                "Waiver",
            ]
            for field in required_fields:
                value = row.values.get(field, "")
                if field == "Waiver" and value.strip().lower() in {"none", "n/a"}:
                    continue
                if is_pending(value) and not (
                    args.allow_pending and field in {"QA result", "Evidence", "Verified revision", "Evidence state"}
                ):
                    failures.append(f"{ac}: missing {field}")

            if row.qa_result not in FINAL_VERDICTS:
                if not (args.allow_pending and is_pending(row.qa_result)):
                    failures.append(
                        f"{ac}: QA result must be PASS, FAIL, or WAIVED, got {row.values.get('QA result', '')!r}"
                    )

            if row.qa_result in PASS_VERDICTS:
                if is_pending(row.evidence):
                    failures.append(f"{ac}: PASS requires evidence path")
                if is_pending(row.verified_revision):
                    failures.append(f"{ac}: PASS requires verified revision or worktree fingerprint")
                if row.evidence_state not in {"fresh", "current"}:
                    failures.append(f"{ac}: PASS requires evidence state fresh/current")
                if row.waiver.strip().lower() not in {"none", "n/a"}:
                    failures.append(f"{ac}: PASS cannot also carry a waiver")

            if row.qa_result in WAIVED_VERDICTS and row.waiver.strip().lower() in {"", "none", "n/a", "pending"}:
                failures.append(f"{ac}: WAIVED requires explicit waiver text")

        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1

        print(f"PASS: {args.report} contains {len(rows)} auditable verification rows")
        return 0
    except VerificationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
