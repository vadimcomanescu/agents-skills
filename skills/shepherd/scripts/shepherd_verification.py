#!/usr/bin/env python3
"""Shared parsing helpers for Shepherd verification gate scripts."""

from __future__ import annotations

import hashlib
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REQUIRED_COLUMNS = [
    "AC",
    "Proof modality",
    "Required artifacts",
    "Milestone",
    "QA result",
    "Evidence",
    "Verified revision",
    "Evidence state",
    "Waiver",
]

FINAL_VERDICTS = {"pass", "passed", "fail", "failed", "waived"}
PASS_VERDICTS = {"pass", "passed"}
WAIVED_VERDICTS = {"waived"}
PENDING_VALUES = {"", "pending", "todo", "tbd", "none", "n/a"}


@dataclass(frozen=True)
class VerificationRow:
    row_number: int
    values: dict[str, str]

    @property
    def ac_id(self) -> str:
        return self.values.get("AC", "").strip()

    @property
    def qa_result(self) -> str:
        return self.values.get("QA result", "").strip().lower()

    @property
    def modality(self) -> str:
        return self.values.get("Proof modality", "").strip().lower()

    @property
    def required_artifacts(self) -> str:
        return self.values.get("Required artifacts", "").strip().lower()

    @property
    def evidence(self) -> str:
        return self.values.get("Evidence", "").strip()

    @property
    def verified_revision(self) -> str:
        return self.values.get("Verified revision", "").strip()

    @property
    def evidence_state(self) -> str:
        return self.values.get("Evidence state", "").strip().lower()

    @property
    def waiver(self) -> str:
        return self.values.get("Waiver", "").strip()


class VerificationError(Exception):
    pass


def parse_verification_table(path: Path) -> tuple[list[str], list[VerificationRow]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    header_index = None
    headers: list[str] = []
    for index, line in enumerate(lines):
        if line.strip().startswith("|") and "AC" in line and "QA result" in line:
            cells = split_markdown_row(line)
            if "AC" in cells and "QA result" in cells:
                header_index = index
                headers = cells
                break
    if header_index is None:
        raise VerificationError(f"{path}: no verification table with AC and QA result columns found")

    rows: list[VerificationRow] = []
    for index in range(header_index + 2, len(lines)):
        line = lines[index]
        if not line.strip().startswith("|"):
            break
        cells = split_markdown_row(line)
        if len(cells) != len(headers):
            raise VerificationError(
                f"{path}:{index + 1}: table row has {len(cells)} cells, expected {len(headers)}"
            )
        rows.append(VerificationRow(index + 1, dict(zip(headers, cells))))

    if not rows:
        raise VerificationError(f"{path}: verification table has no rows")
    return headers, rows


def split_markdown_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def is_pending(value: str) -> bool:
    return value.strip().lower() in PENDING_VALUES


def extract_paths(value: str) -> list[str]:
    candidates: list[str] = []
    for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", value):
        candidates.append(target.strip("<>"))
    for token in re.split(r"[\s,;]+", value):
        cleaned = token.strip().strip(",;:()[]`'\"<>").rstrip(".")
        if not cleaned:
            continue
        if "/" in cleaned or cleaned.startswith("."):
            candidates.append(cleaned)
    deduped: list[str] = []
    for candidate in candidates:
        if candidate not in deduped:
            deduped.append(candidate)
    return deduped


def resolve_path(path_text: str, base_dir: Path, repo_root: Path) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    from_base = (base_dir / path).resolve()
    if from_base.exists():
        return from_base
    return (repo_root / path).resolve()


def git_output(repo_root: Path, args: Iterable[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise VerificationError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def current_commit(repo_root: Path) -> str:
    return git_output(repo_root, ["rev-parse", "HEAD"])


def worktree_fingerprint(repo_root: Path) -> str:
    status = git_output(repo_root, ["status", "--porcelain=v1"])
    diff = git_output(repo_root, ["diff", "--binary"])
    payload = status + "\n---diff---\n" + diff
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    commit = current_commit(repo_root)[:12]
    return f"worktree:{commit}:{digest}"
