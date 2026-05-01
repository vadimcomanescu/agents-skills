# Uncle Bob's Three Laws of TDD

The canonical statement, from Robert C. Martin (cleanCoder.com).

## The Three Laws

> 1. You may not write production code until you have written a failing unit test.
> 2. You may not write more of a unit test than is sufficient to fail — and not compiling counts as failing.
> 3. You may not write more production code than is sufficient to pass the currently failing test.

Source: <http://butunclebob.com/ArticleS.UncleBob.TheThreeRulesOfTdd>

## Why this granularity

The laws are not about ceremony. They are about **rhythm**. The cycle they enforce is roughly 30 seconds long:

1. Write one assertion of a test that does not compile (~10s).
2. Write the production code that makes it compile and fail (~10s).
3. Write enough production code to make it pass (~10s).
4. Repeat.

Uncle Bob learned this granularity from Kent Beck around 1999. Beck would type one line of test, then one line of production code, then back. The Three Laws codify that rhythm so beginners can practice it deliberately. *Shu-Ha-Ri:* follow the form until you have the rhythm; only then take liberties.

## What the laws are not

- **Not a coverage target.** Coverage is a side effect, not a goal. See `crap-score.md` and `mutation-testing.md` for what to do once you have coverage.
- **Not "write more tests".** They constrain the *order*, not the volume. Two laws are about *not writing more than necessary*.
- **Not aspirational.** They are operational. You either follow them or you do not.
- **Not a substitute for thinking.** Before any RED, you still need to know what behavior you want. See `vertical-slicing.md` (planning step).

## The "spirit not letter" rationalization

A common attempt to weasel: *"TDD is about the spirit, not the letter — tests after achieve the same goals."*

They do not. Tests-after answer the question **"what does this code do?"** Tests-first answer **"what *should* this code do?"** The first is descriptive, biased by your implementation. The second is prescriptive, forced to discover edge cases before you know how the code will look.

Tests-after are not TDD. They are coverage. They are useful. They are not the same thing.

## How LLMs cheat the laws (and how to catch yourself)

| Cheat | What it looks like | Fix |
|---|---|---|
| Writing impl first, then a test that "documents" it | The test passes on the first run | Delete the impl, start over from RED |
| Writing five tests at once before any impl | Horizontal slicing — see `vertical-slicing.md` | One test, one impl, one cycle |
| Writing more impl than the test demands | Functions full of branches none of the current tests force | Comment out the speculative branches; if a test fails, write the test that demands them |
| "Adapting" pre-written code into post-test impl | You are reading the old code while writing the new one | Close the old file. Implement fresh from the tests |

## Practical consequence in agent contexts

Agents have additive bias. When the laws are loose, agents will write more code than the test forces. Treat Law 3 as a hard gate: every line of production code must trace to a currently failing test it is required to satisfy.

When in doubt: **delete and start over**. The bytes are cheap; the discipline is what makes the test suite trustworthy.
