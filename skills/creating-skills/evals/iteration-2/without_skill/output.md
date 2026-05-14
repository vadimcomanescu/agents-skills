# Without-skill (baseline) responses — iteration 2

Baseline subagent answered from general engineering common sense, with explicit instruction not to read any skill or memory file.

## Eval 4
Not done. A passing trigger eval proves the description routes the right prompts to the skill; it does not prove the skill's workflow produces the right behavior once triggered. Run the workflow at least once end-to-end and check observable outputs before claiming done.

## Eval 5
Missing — pin/vendor the upstream, don't outsource correctness. README claims and runnable behavior are different things. At minimum verify the upstream's HEAD installs cleanly and produces something testable; otherwise the skill silently depends on a moving target.

## Eval 6
Don't ship. Subagent self-reports describe intent, not output. Sample at least one file per subagent and check it against the brief before trusting the aggregate "all per spec" claim.

## Eval 7
Optional. Prose can suffice for simple loops if it states the round counter, the cap, and the exit branches clearly. A diagram is often still helpful for at-a-glance comprehension but isn't strictly required for a three-sentence-clear description.

## Eval 8
Don't ship. Multiple unverified surfaces: the references weren't spot-checked, the upstream wasn't tested, and trigger eval alone isn't sufficient for an orchestrator. Each is independently blocking.

## Eval 9
Don't close. Five unresolved audit items outweigh green tests — tests cover code-level correctness, not the design-level items the audit is asking about. Resolve each N before closing.

## Eval 10
Cut the meta-commentary — let the diagram speak. Keep rationale prose only if it adds load-bearing information the diagram itself doesn't already encode.
