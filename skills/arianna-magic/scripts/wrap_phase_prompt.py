#!/usr/bin/env python3
"""Wrap a phase dispatch prompt for a subagent.

Takes a phase name and a list of state-file paths, emits the prompt text
the orchestrator hands to the role-skill subagent. Inline subset of
trycycle's run_phase.py template-rendering logic (no external deps).

The orchestrator uses this to standardize how each phase invokes its
role skill: the subagent always receives the same shape — phase, role
skill path, state files to load, return schema reminder.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PHASE_ROLES = {
    "research": ("arianna-research", "Phase 0 — Research"),
    "discover": ("arianna-magic",    "Phase 1 — Discover (orchestrator self-runs)"),
    "spec":     ("arianna-spec",     "Phase 2 — Spec"),
    "critique": ("arianna-critique", "Auto-critic round"),
    "grill":    ("arianna-grill",    "Interactive grill"),
    "design":   ("arianna-design",   "Phase 3 — Design"),
    "plan":     ("arianna-plan",     "Phase 4 — Plan"),
    "implement":("arianna-implement","Phase 5 — Implement (one task)"),
    "review":   ("arianna-review",   "Phase 6 — Review (one task, two stages)"),
}

TEMPLATE = """\
# Subagent dispatch — {label}

You are running as a fresh subagent. Read your role skill, do the work,
return the structured JSON at the end.

## Your role skill

skills/{role_skill}/SKILL.md  (read this first)

## State files for this phase

{state_files_block}

## What to produce

Per your role skill's "what to produce" section. Stay within the file
scope your role skill specifies. Do not modify unrelated files.

## Return schema

Return a single JSON object as the last block of your reply, matching
the schema your role skill defines. The orchestrator parses your final
JSON; do not interleave it with prose.

{extra_block}"""


def state_files_block(paths: list[str]) -> str:
    if not paths:
        return "(none — this phase reads no prior state)"
    return "\n".join(f"- {p}" for p in paths)


def build_prompt(phase: str, state: list[str], extra: str = "") -> str:
    if phase not in PHASE_ROLES:
        raise SystemExit(f"unknown phase: {phase!r} (known: {sorted(PHASE_ROLES)})")
    role_skill, label = PHASE_ROLES[phase]
    return TEMPLATE.format(
        label=label,
        role_skill=role_skill,
        state_files_block=state_files_block(state),
        extra_block=extra.strip() + "\n" if extra.strip() else "",
    )


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("phase", help=f"one of {sorted(PHASE_ROLES)}")
    ap.add_argument("--state", action="append", default=[],
                    help="state file path; repeatable")
    ap.add_argument("--extra", default="", help="optional extra block appended at the end")
    ap.add_argument("--json", action="store_true",
                    help="emit JSON {phase,role_skill,prompt} instead of the prompt text")
    args = ap.parse_args(argv[1:])
    prompt = build_prompt(args.phase, args.state, args.extra)
    if args.json:
        print(json.dumps({
            "phase": args.phase,
            "role_skill": PHASE_ROLES[args.phase][0],
            "prompt": prompt,
        }, indent=2))
    else:
        sys.stdout.write(prompt)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
