Invoke the `interview-me` skill (SKILL.md:28). It enforces hypothesis-first intent discovery: state a confidence number, ask one question at a time with an attached guess, run the "what would you actually want if you didn't have to justify it?" probe, and end with a 6-line restate covering Outcome / User / Why now / Success / Constraint / Out of scope (SKILL.md:28).

Gate before advancing: explicit "yes" from the user on the restate. Vague answers ("whatever you think", "sounds good", silence) do not count; re-engage per the skill's Step 5 (SKILL.md:30-31).

Artifact on disk: `.arianna/spec.md` is created with `## Confirmed Intent` as its first section, which becomes the locked input for everything downstream (SKILL.md:32).
