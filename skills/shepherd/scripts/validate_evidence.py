#!/usr/bin/env python3
"""Validate Shepherd verification evidence artifacts and proof modalities."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from shepherd_verification import (
    PASS_VERDICTS,
    VerificationError,
    extract_paths,
    is_pending,
    parse_verification_table,
    resolve_path,
)


SCREENSHOT_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
REPLAY_SUFFIXES = {".zip", ".webm", ".mp4", ".har", ".trace"}
STATE_SUFFIXES = {".json", ".ndjson", ".txt", ".log", ".out", ".sqlite", ".db"}
BROWSER_MANIFEST_TYPE = "browser-evidence"


def validate_browser_manifest(path: Path, ac_id: str) -> list[str]:
    failures: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"{ac_id}: browser evidence manifest {path} is not readable JSON: {error}"]

    if data.get("type") != BROWSER_MANIFEST_TYPE:
        return [f"{ac_id}: {path} is JSON but not a browser evidence manifest"]

    required = ["ac_id", "expected_route_or_state", "captured_url", "page_title", "assertions", "verdict"]
    for field in required:
        value = data.get(field)
        if field not in data or value is None or value == "" or value == []:
            failures.append(f"{ac_id}: browser evidence manifest {path} missing {field}")

    if data.get("ac_id") != ac_id:
        failures.append(f"{ac_id}: browser evidence manifest {path} has ac_id {data.get('ac_id')!r}")

    assertions = data.get("assertions")
    if not isinstance(assertions, list) or not assertions:
        failures.append(f"{ac_id}: browser evidence manifest {path} requires non-empty assertions")
    elif any(not isinstance(item, str) or not item.strip() for item in assertions):
        failures.append(f"{ac_id}: browser evidence manifest {path} has empty assertion text")

    if str(data.get("verdict", "")).upper() != "PASS":
        failures.append(f"{ac_id}: browser evidence manifest {path} verdict is not PASS")

    captured_url = str(data.get("captured_url", ""))
    expected = str(data.get("expected_route_or_state", ""))
    auth_expected = bool(data.get("auth_redirect_expected", False))
    if "/login" in captured_url and not auth_expected:
        failures.append(
            f"{ac_id}: browser evidence captured auth/login page {captured_url!r}, not expected state {expected!r}"
        )

    if data.get("wrong_page") is True:
        failures.append(f"{ac_id}: browser evidence manifest {path} marks the capture as wrong_page")

    return failures


def browser_manifest_artifacts(path: Path) -> list[str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    artifacts = data.get("artifacts", [])
    if not isinstance(artifacts, list):
        return []
    return [str(item) for item in artifacts]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fail closed when Shepherd verification evidence paths are missing or too weak."
    )
    parser.add_argument("report", type=Path, help="Path to .shepherd/verification.md")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="Repository root used to resolve relative artifact paths.",
    )
    args = parser.parse_args()

    try:
        _, rows = parse_verification_table(args.report)
        failures: list[str] = []
        base_dir = args.report.resolve().parent
        repo_root = args.repo_root.resolve()

        for row in rows:
            if row.qa_result not in PASS_VERDICTS:
                continue

            ac = row.ac_id
            paths = extract_paths(row.evidence)
            if not paths:
                failures.append(f"{ac}: PASS requires at least one artifact path")
                continue

            resolved = [resolve_path(path, base_dir, repo_root) for path in paths]
            missing = [str(path) for path in resolved if not path.exists()]
            if missing:
                failures.append(f"{ac}: evidence path(s) do not exist: {', '.join(missing)}")

            suffixes = {path.suffix.lower() for path in resolved}
            modality = " ".join([row.modality, row.required_artifacts])
            if "browser" in modality or "screenshot" in modality:
                if not suffixes & SCREENSHOT_SUFFIXES:
                    failures.append(f"{ac}: browser-visible proof requires a saved screenshot artifact")
                if len(resolved) < 2 and "execution" in modality:
                    failures.append(f"{ac}: browser proof also requires execution evidence, not only a screenshot")
                manifests = [
                    path for path in resolved
                    if path.suffix.lower() == ".json"
                    and path.exists()
                    and BROWSER_MANIFEST_TYPE in path.read_text(encoding="utf-8", errors="ignore")
                ]
                if not manifests:
                    failures.append(
                        f"{ac}: browser proof requires a browser evidence manifest with captured URL, page title, and observed assertions"
                    )
                for manifest in manifests:
                    failures.extend(validate_browser_manifest(manifest, ac))

            if "multi-step" in modality or "replay" in modality or "trace" in modality or "video" in modality:
                if not suffixes & REPLAY_SUFFIXES:
                    failures.append(f"{ac}: multi-step browser proof requires replayable trace/video/recording evidence")
                replay_names = {path.name for path in resolved if path.suffix.lower() in REPLAY_SUFFIXES}
                if replay_names:
                    manifest_artifacts = {
                        artifact
                        for path in resolved
                        if path.suffix.lower() == ".json"
                        and path.exists()
                        and BROWSER_MANIFEST_TYPE in path.read_text(encoding="utf-8", errors="ignore")
                        for artifact in browser_manifest_artifacts(path)
                    }
                    missing_from_manifest = sorted(replay_names - manifest_artifacts)
                    if missing_from_manifest:
                        failures.append(
                            f"{ac}: replay artifact(s) missing from browser manifest artifacts: {', '.join(missing_from_manifest)}"
                        )

            if "state" in modality or "api" in modality or "database" in modality or "persisted" in modality:
                if not suffixes & STATE_SUFFIXES:
                    failures.append(f"{ac}: state/API proof requires API, database, persisted-state, or backend assertion output")
                if "screenshot" in row.evidence.lower() and len(resolved) == 1:
                    failures.append(f"{ac}: UI-only screenshot proof is insufficient for state/API verification")

            if is_pending(row.evidence):
                failures.append(f"{ac}: PASS cannot use pending evidence")

        if failures:
            for failure in failures:
                print(f"FAIL: {failure}", file=sys.stderr)
            return 1

        print(f"PASS: evidence artifacts satisfy verification modalities in {args.report}")
        return 0
    except VerificationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
