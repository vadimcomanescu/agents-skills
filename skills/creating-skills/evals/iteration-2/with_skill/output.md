# With-skill responses — iteration 2

## Eval 4
Refuses. Workflow-shaped skill; description-trigger eval is insufficient. Demand behavioral eval: subagent loads full SKILL.md body, receives a real prompt, executes the first load-bearing phases, artifacts checked (per Step 5 eval-type table and Step 9 row 10).

## Eval 5
Refuses. Upstream README ≠ runnable implementation. Did you clone it? Build it? Run it on a sample? Warns that spec-only repos exist (e.g. github.com/unclebob/Acceptance-Pipeline-Specification). Vendor a working reference or be explicit that the user provides one (Step 5 vendor clause, Step 9 row 11).

## Eval 6
Refuses. Writer-subagent self-reports describe intent, not output. Per system-prompt trust-but-verify, open at least one file per writer-subagent against the brief before shipping (Step 9 row 12).

## Eval 7
Add the dot diagram. This is the textbook "process loop where the agent might stop early" case — round counter + 3-round cap + escalation. Labels carry semantic meaning (round++, cap-trip) that three sentences of prose hide (Diagrams section + Step 9 row 7, load-bearing).

## Eval 8
Refuses on three independent grounds: (a) trigger eval insufficient for workflow skill — demand behavioral; (b) upstream spec repo unverified — demand clone + run; (c) 12 of 14 subagent files unchecked — demand spot-check per writer. Route through Step 9 audit; report N's per load-bearing row.

## Eval 9
Don't close. Rows 7, 10, 11, 12, 14 are load-bearing; any N blocks ship. "Tests pass" refers to unit tests, not the audit's checks (dot diagrams, behavioral eval, referenced-tool execution, subagent-file spot-checks, end-to-end workflow run). Convert each N to Y, then re-score.

## Eval 10
Cut it. That's author-commentary — meta-commentary about the artifact, not the artifact. Skill files state the rule (here, the diagram); the "why we changed this" / "what this reveals" belongs in commit messages, never in the skill body. If load-bearing facts are in the commentary, move them INTO the diagram labels (Step 9 row 15).
