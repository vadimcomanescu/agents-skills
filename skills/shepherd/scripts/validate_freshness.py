#!/usr/bin/env python3
"""Validate Shepherd verification evidence freshness against git state."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shepherd_verification import (
    PASS_VERDICTS,
    VerificationError,
    current_commit,
    resolve_path,
    parse_verification_table,
    worktree_fingerprint,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fail closed when accepted Shepherd evidence is stale or not tied to current git state."
    )
    parser.add_argument("report", type=Path, help="Path to .shepherd/verification.md")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="Repository root used for git freshness checks.",
    )
    parser.add_argument(
        "--allow-worktree-fingerprint",
        action="store_true",
        help="Accept the current dirty-worktree fingerprint as a verified state.",
    )
    args = parser.parse_args()

    try:
        _, rows = parse_verification_table(args.report)
        repo_root = args.repo_root.resolve()
        base_dir = args.report.resolve().parent
        head = current_commit(repo_root)
        fingerprint = worktree_fingerprint(repo_root)
        failures: list[str] = []

        for row in rows:
            if row.qa_result not in PASS_VERDICTS:
                continue

            ac = row.ac_id
            if row.evidence_state not in {"fresh", "current"}:
                failures.append(
                    f"{ac}: evidence state is {row.values.get('Evidence state', '')!r}, expected fresh/current"
                )

            verified = row.verified_revision
            if verified.startswith("state-file:"):
                state_path = resolve_path(verified.removeprefix("state-file:").strip(), base_dir, repo_root)
                if not state_path.exists():
                    failures.append(f"{ac}: verified state file does not exist: {state_path}")
                continue
            if verified == head or verified == head[:12]:
                continue
            if args.allow_worktree_fingerprint and verified == fingerprint:
                continue
            failures.append(
                f"{ac}: verified state {verified!r} does not match HEAD {head[:12]}"
                + (f" or worktree fingerprint {fingerprint!r}" if args.allow_worktree_fingerprint else "")
            )

        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1

        print(f"PASS: accepted evidence is fresh for {args.report}")
        return 0
    except VerificationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
