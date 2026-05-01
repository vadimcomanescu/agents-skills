# Rationalizations — the full table

Every excuse you have ever heard for skipping TDD, with the actual answer.

The single best signal that you are about to skip TDD is the appearance of any of these phrases in your own thinking. When you catch yourself using one, **stop**. The phrase exists because the rationalization is common; you are not the first person to think it, and you are not the exception.

## The full table

| Rationalization | Reality |
|---|---|
| **"Too simple to test."** | Simple code breaks too. The test costs 30 seconds. The bug costs hours. |
| **"I'll write tests after."** | You won't, fully. And tests written after the implementation pass on the first run, which proves nothing. They test what the code *does*, not what the code *should do*. |
| **"I already manually tested it."** | Manual testing is ad-hoc. There is no record of what you tested. You cannot re-run it after the next change. "It worked when I tried it" is not a guarantee. |
| **"This is a prototype / spike — I'll add tests later."** | Prototypes become production code. Adding tests later is the "test debt" crisis. Either commit to deleting the spike, or write the test now. |
| **"Deleting these N hours of work is wasteful."** | Sunk cost. The time is gone either way. Your choice now is: delete and rewrite with TDD (more hours, high confidence), or keep the code and add tests after (less time, low confidence, likely bugs). The real waste is keeping code you cannot trust. |
| **"Let me keep this code as a reference while I write tests."** | You will adapt to it as you write. That is testing-after with extra steps. Delete means delete. Close the file. |
| **"TDD is dogmatic. I'm being pragmatic."** | TDD *is* pragmatic. It finds bugs before commit (cheaper than after). It prevents regressions. It documents behavior. It enables fearless refactoring. "Pragmatic" shortcuts that lead to debugging in production are slower, not faster. |
| **"That's TDD theater / ceremony / ritual. The verification I already did is what matters."** | "Theater" is the word people reach for when discipline feels like overhead. It catches a class of bugs your manual REPL doesn't — the one that bites the next change, not this one. The discipline is the deliverable; "I verified it manually" is sand. (Surfaced by pressure testing 2026-05-01: an unaided agent dismissed the Iron Law as "TDD theater" and chose tests-after.)
| **"Tests-after achieve the same goals — it's spirit not ritual."** | They do not. Tests-after answer "what does this code do?". Tests-first answer "what *should* this code do?". The first is biased by your implementation; the second forces edge case discovery before you commit to a shape. |
| **"The test is harder to write than the code."** | The test is harder because the code is hard to use. Listen to the test — your design has a problem. See `testability-via-design.md`. |
| **"I have to mock everything to test this."** | The unit talks to too much. Find the deep module. Inject the seam. See `mocking-and-fakes.md` and `testability-via-design.md`. |
| **"I need to explore the design first."** | Fine. Spike. Then **throw the spike away** and start from RED. Spikes are not production code. |
| **"This is just configuration."** | If it has a behavior — if a wrong value would produce a wrong outcome — it is testable. If it is truly inert (a string the framework reads), no test needed. |
| **"This is a one-off script."** | One-off scripts become utilities become services. If it might run twice, it should have at least one test. |
| **"The deadline is too close."** | TDD is faster than debugging. The deadline is the reason to use TDD, not the reason to skip it. |
| **"Existing code in this area has no tests."** | You're improving it. Add tests for the existing code as you touch it (the boy-scout rule). New code follows TDD; legacy code gets characterization tests. |
| **"This bug is too small to write a test for."** | Tests for small bugs prevent the regression. The test is shorter than the bug report. Write it. |
| **"I'll write the test after I see the bug fix work."** | This is testing-after. The test will be biased toward your fix, not toward the bug. See `bug-fix-pattern.md` — test-first means *test before fix*. |
| **"I tested this in a REPL."** | A REPL session is not a test. It is not committed, not re-runnable, not a regression guard. |
| **"The frontend will catch this."** | The frontend tests the integration. The unit test guards the unit. They are different gates; you need both. |
| **"It's just a refactor — no behavior change."** | A real refactor preserves behavior. Run the existing tests. They are your safety net. If there are no tests, the "refactor" is risky and needs characterization tests first. |
| **"This is library code — the user can write their own tests."** | Library code is more important to test, not less. Your tests are the spec; users rely on the contract. |
| **"I'll come back to it tomorrow."** | You won't. "Later" is a synonym for "never" in software. The cycle now or it does not happen. |
| **"This is different because..."** | It isn't. The "different because" framing is the universal rationalization. If you find yourself starting a sentence with it, stop and ask: *what would Uncle Bob say to me right now?* |

## How to handle each one

When you notice yourself thinking any of these, the response is the same:

1. **Stop.** Do not write more production code.
2. **Name the rationalization out loud.** "I am about to skip TDD because [reason]."
3. **Find the entry in this table.** Read the reality.
4. **Decide deliberately.** Either:
   - Accept the discipline and start the cycle (RED first).
   - Or get explicit human approval to skip — captured in writing, with the reason.

The point is not to be a robot. The point is that *unconscious* skipping is what produces untested code. Conscious deliberate skipping, with human consent, is rare and acceptable.

## When you have already skipped

You wrote 200 lines of production code without a test. You're reviewing this list and you recognize what happened. Now what?

The honest answer: **delete the code and start over with TDD**. The Iron Law is the Iron Law.

The pragmatic compromise: if deletion is genuinely too expensive (the code took days, the deadline is now), capture the rationalization in the commit message ("written without TDD due to [reason]; see follow-up to add characterization tests") and immediately write characterization tests for the existing behavior before any further change. The tests will be implementation-coupled — that is the cost of having skipped — but they at least lock down the current behavior.

Either way: the next change starts with RED.

## The meta-rationalization

The most insidious rationalization is the one that says *the rationalizations don't apply to me right now, this case is different*.

That is the one to watch hardest for. Every rationalization in the table looks legitimate from the inside. The reason this table exists is that they all looked legitimate to the people who wrote them. Read it again, slowly, and you will recognize a couple of them in your own recent work.
