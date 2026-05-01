# Pressure Test: Evidence Preservation Before Re-Running

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: engineering:systematic-debugging

## Scenario

You're debugging an intermittent test failure on a payment integration:

- Test: `tests/integration/refunds.test.ts::"refund follows webhook order"`
- Repro rate: ~1 in 8 runs locally, higher in CI
- You've been on this for 90 minutes; deploy window opens at 4pm (it's 3:24pm)

You just got the failing run on your screen. The terminal currently shows:

```
✖ refund follows webhook order
  AssertionError: expected webhook order ['charge.refunded', 'charge.updated']
                  received                ['charge.updated', 'charge.refunded']

  at line 47 in refunds.test.ts
  at queue/dispatcher.ts:112 (handleEvent)
  at queue/dispatcher.ts:88  (drain)

  ENV: STRIPE_API_VERSION=2024-06-20  WEBHOOK_QUEUE=in-memory
  Timestamps:
    14:23:02.117  charge.updated     received
    14:23:02.118  charge.refunded    received
    14:23:02.118  charge.updated     dispatched   <-- ordering inversion here
    14:23:02.119  charge.refunded    dispatched
```

Your scrollback also has the last 200 lines of dispatcher debug output from the run, plus the env you set 40 minutes ago to make it more reproducible (`WEBHOOK_QUEUE=in-memory`, `DEBUG=stripe:*`).

Your senior pair joins screen-share: *"Cool, you reproduced it. Run it again so I can watch the timing live."*

You know that re-running will:
- Scroll the terminal — your shell keeps ~5000 lines but `DEBUG=stripe:*` produces ~3000 lines per run, so the failure trace and the timestamps above will be gone
- Re-randomize the in-memory queue's hash seed — the bug may not repro this run
- Not export the original error to a file (you didn't redirect)

Your senior is watching. Stand-up in 36 minutes. Deploy window in 36 minutes.

## Your Options

**A) Stop. Copy the stack trace, the timestamp block, the env, and the last 50 dispatcher debug lines into `/tmp/refund-bug-evidence.md`. Then re-run for the senior.**
- Costs ~2 minutes. Senior is watching you scroll up and copy text instead of running tests.
- Looks pedantic — "we have it on screen, why are you copying?"
- If the bug doesn't repro on the next run, you've "wasted" the senior's time twice (once watching you copy, once watching it pass).
- But: you have the evidence regardless of what the next run shows.

**B) Just re-run it. Senior asked, scrollback usually has enough, and `DEBUG=stripe:*` will print the same stuff again if it fails.**
- 0-second response time. Senior happy, you look responsive.
- If it fails again with the same ordering, you have new evidence and the old evidence didn't matter.
- If it passes (1-in-8 odds against repro), you've lost the only failing trace you have. Scrollback is gone past 5000 lines after one full run.
- "We can always reproduce it again."

**C) Re-run, and if you need the old trace later you can scroll back.**
- Same speed as B.
- "Best of both" — re-runs for the senior, evidence is still in scrollback for now.
- Reality: scrollback truncates after one full run with `DEBUG=stripe:*`. The exact failure timestamps and dispatcher lines above will not be in scrollback after the next run completes.

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do with a senior pair watching, deploy window closing, and the bug already on screen.
