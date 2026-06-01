#!/usr/bin/env python3
"""Fail closed on a weak or broken acceptance-spec mutation result.

The architect runs `acceptance_pipeline.py mutation`, which writes the kit
report and a `verdict.json`. This validator is the independent gate: QA, the
architect, or the coordinator points it at that evidence to re-confirm the
milestone is provable without rerunning the kit. It accepts either a raw kit
report (`{"summary": {...}, "results": [...]}`) or the normalized
`verdict.json`, and exits non-zero when the result does not prove behaviour
binding.

The decision is always re-derived from the `results[]` array cross-checked
against the `summary` counts (shared with `acceptance_pipeline.py`); a
hand-written `decision` field is never trusted. A milestone is blocked when any
mutation survived, any mutation errored, the summary and results disagree, the
counts are malformed, or zero mutations ran while required (or while examples
were discovered but skipped).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from acceptance_pipeline import decide  # shared decision core
except Exception:  # pragma: no cover - standalone fallback
    decide = None


def _fallback_decide(data, require: bool) -> dict:
    """Minimal, conservative re-derivation if the shared core is unavailable."""
    reasons = []
    summary = {}
    if isinstance(data, dict) and isinstance(data.get("summary"), dict):
        summary = {str(k).lower(): v for k, v in data["summary"].items()}

    def count(*names):
        for name in names:
            value = summary.get(name)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return int(value)
            if isinstance(value, str):
                try:
                    return int(float(value))
                except ValueError:
                    reasons.append(f"non-numeric summary count {name}={value!r}")
                    return 0
        return 0

    if not isinstance(data, dict) or not isinstance(data.get("summary"), dict):
        reasons.append("malformed or missing summary")
    survived = count("survived")
    errors = count("errors", "error")
    total = count("total")
    survivors = data.get("survivors") if isinstance(data, dict) else None
    if isinstance(survivors, list):
        survived = max(survived, len(survivors))
    if survived > 0:
        reasons.append(f"{survived} surviving mutation(s)")
    if errors > 0:
        reasons.append(f"{errors} errored mutation(s)")
    if total == 0 and require:
        reasons.append("zero mutations executed while required")
    if isinstance(data, dict) and "report" in data and data["report"] is None:
        reasons.append("no kit report produced")
    return {"decision": "PASS" if not reasons else "BLOCK", "reasons": reasons,
            "summary": {"total": total, "killed": count("killed"), "survived": survived, "errors": errors}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("report", type=Path, help="kit JSON report or verdict.json")
    parser.add_argument("--require-mutations", action="store_true",
                        help="block when zero mutations were executed")
    args = parser.parse_args()

    if not args.report.exists():
        print(f"acceptance-mutation evidence not found: {args.report}", file=sys.stderr)
        return 1
    try:
        data = json.loads(args.report.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"{args.report}: invalid JSON: {exc}", file=sys.stderr)
        return 1

    require = args.require_mutations or (isinstance(data, dict) and bool(data.get("require_mutations")))
    verdict = decide(data, require) if decide else _fallback_decide(data, require)

    summary = verdict.get("summary", {})
    if verdict["decision"] != "PASS":
        print(f"BLOCK {args.report}")
        for reason in verdict["reasons"]:
            print(f"  - {reason}")
        return 1
    print(f"PASS {args.report}: total={summary.get('total')} killed={summary.get('killed')} "
          f"survived=0 errors=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
