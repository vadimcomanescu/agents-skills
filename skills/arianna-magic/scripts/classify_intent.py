#!/usr/bin/env python3
"""Classify a user goal into one of the arianna-magic intent classes.

Output: JSON to stdout with the intent class plus the heuristic signals
that contributed. The orchestrator reads this and decides which phase set
to run. If heuristics tie or score weakly, the JSON sets `confidence`
low and `needs_llm_override: true` — the orchestrator then makes the
final call.

Intent classes (per .agent/plans.md § Pipeline flow):
  TRIVIAL    -> phases 1, 5, 6
  REFACTOR   -> phases 0, 1, 2, 4, 5, 6
  MID_SIZED  -> phases 0, 1, 2, (3 if UI), 4, 5, 6
  GREENFIELD -> all 7
  BUG_FIX    -> phases 0, 1 (reproduce-first), 2, 4, 5, 6
"""
from __future__ import annotations

import json
import re
import sys

# Each class has weighted regex signals. Higher score wins.
# (pattern, weight). Patterns are case-insensitive.
SIGNALS: dict[str, list[tuple[str, int]]] = {
    "GREENFIELD": [
        (r"\bbuild (?:a|me a|an)\b", 3),
        (r"\bfrom scratch\b", 3),
        (r"\bgreenfield\b", 4),
        (r"\bnew (?:project|app|service|tool|cli)\b", 3),
        (r"\bend[- ]to[- ]end\b", 2),
        (r"\b(?:todo|chat|crud|saas|dashboard) app\b", 3),
        (r"\bwith (?:postgres|redis|auth|stripe|supabase)\b", 1),
        (r"\bmulti[- ]day\b", 2),
        (r"\bship\b.*\bwhole\b", 3),
    ],
    "BUG_FIX": [
        (r"\bbug\b", 3),
        (r"\bfix\b(?!ed|es)", 2),
        (r"\bbroken\b", 3),
        (r"\bcrash(?:es|ing)?\b", 3),
        (r"\b(?:throws|throwing) (?:an? )?error\b", 3),
        (r"\bregression\b", 3),
        (r"\bnot working\b", 2),
        (r"\bstack trace\b", 2),
        (r"\bdoes(?:n't| not) (?:work|return|render)\b", 2),
    ],
    "REFACTOR": [
        (r"\brefactor\b", 4),
        (r"\bextract\b.*\b(?:module|function|class|interface)\b", 2),
        (r"\brename\b.*\b(?:across|throughout|everywhere)\b", 2),
        (r"\bclean up\b", 2),
        (r"\bsimplify\b", 2),
        (r"\brestructure\b", 3),
        (r"\bsplit\b.*\bfile\b", 2),
        (r"\bconsolidat\w+\b", 2),
        (r"\bmigrate\b.*\bto\b", 2),
    ],
    "MID_SIZED": [
        (r"\badd (?:a |the )?(?:feature|page|endpoint|screen|flow)\b", 3),
        (r"\bimplement (?:the |a )?\b(?!entire|whole)", 2),
        (r"\bwire (?:up|in)\b", 2),
        (r"\bintegrat(?:e|ion)\b", 2),
        (r"\bsupport for\b", 2),
        (r"\bexpose\b.*\bendpoint\b", 2),
    ],
    "TRIVIAL": [
        (r"\b(?:rename|move|delete) (?:this |that |the )?file\b", 4),
        (r"\bone[- ]line(?:r)?\b", 4),
        (r"\b(?:bump|update) (?:the )?version\b", 3),
        (r"\btypo\b", 4),
        (r"\b(?:fix|change) (?:a |the )?(?:typo|comment|log)\b", 3),
        (r"\bsingle line\b", 3),
        (r"\b(?:add|remove) (?:a |the )?(?:log|print|comment)\b", 2),
    ],
}

# A short goal with no strong signals defaults to GREENFIELD only if it
# looks like a build directive ("build/make/create"); otherwise MID_SIZED.
DEFAULT_BUILD_VERBS = re.compile(r"\b(?:build|make|create|set up|spin up)\b", re.IGNORECASE)


def score(text: str) -> dict[str, int]:
    text_norm = text.strip()
    return {
        cls: sum(w for pat, w in pats if re.search(pat, text_norm, re.IGNORECASE))
        for cls, pats in SIGNALS.items()
    }


def matched(text: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for cls, pats in SIGNALS.items():
        hits = [pat for pat, _ in pats if re.search(pat, text, re.IGNORECASE)]
        if hits:
            out[cls] = hits
    return out


def classify(text: str) -> dict:
    """Classify text into one of {TRIVIAL,REFACTOR,MID_SIZED,GREENFIELD,BUG_FIX}.

    Returns a dict with `class`, `scores`, `signals`, `confidence`,
    `needs_llm_override`.
    """
    scores = score(text)
    top = max(scores, key=lambda k: scores[k])
    top_score = scores[top]
    second_score = sorted(scores.values(), reverse=True)[1]
    margin = top_score - second_score

    if top_score == 0:
        # No signal — fall back to default.
        chosen = "GREENFIELD" if DEFAULT_BUILD_VERBS.search(text) else "MID_SIZED"
        confidence = "low"
        needs_llm = True
    else:
        chosen = top
        confidence = "high" if margin >= 3 else "medium" if margin >= 1 else "low"
        needs_llm = confidence == "low"

    return {
        "class": chosen,
        "scores": scores,
        "signals": matched(text),
        "confidence": confidence,
        "needs_llm_override": needs_llm,
        "margin": margin,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] in {"-h", "--help"}:
        print(__doc__)
        print("\nUsage: classify_intent.py 'goal text here'")
        print("       echo 'goal text' | classify_intent.py -")
        return 0
    if argv[1] == "-":
        text = sys.stdin.read()
    else:
        text = " ".join(argv[1:])
    result = classify(text)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
