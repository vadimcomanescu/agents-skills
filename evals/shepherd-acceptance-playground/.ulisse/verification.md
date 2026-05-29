# Discovery Verification

## `make check`
- Exit: 0
```text
npm test

> shepherd-acceptance-playground@0.1.0 test
> vitest run


 RUN  v4.0.15 /home/vadim/Code/agents-skills/evals/shepherd-acceptance-playground

 ✓ lib/workflow-mode.test.ts (1 test) 3ms
 ✓ lib/quote-store.test.ts (4 tests) 5ms
 ✓ lib/evidence-dossier.test.ts (9 tests) 11ms
 ✓ lib/evidence-verification.test.ts (6 tests) 6ms
 ✓ lib/evidence-review.test.ts (16 tests) 15ms
 ✓ lib/evidence-import-history.test.ts (7 tests) 8ms
 ✓ lib/evidence-explorer.test.ts (9 tests) 11ms
 ✓ lib/evidence-handoff-pack.test.ts (6 tests) 22ms
 ✓ lib/evidence-import.test.ts (15 tests) 17ms

 Test Files  9 passed (9)
      Tests  73 passed (73)
   Start at  16:47:21
   Duration  395ms (transform 888ms, setup 0ms, import 1.44s, tests 98ms, environment 2ms)
```

## `make test`
- Exit: 0
```text
npm test

> shepherd-acceptance-playground@0.1.0 test
> vitest run


 RUN  v4.0.15 /home/vadim/Code/agents-skills/evals/shepherd-acceptance-playground

 ✓ lib/evidence-verification.test.ts (6 tests) 7ms
 ✓ lib/workflow-mode.test.ts (1 test) 3ms
 ✓ lib/quote-store.test.ts (4 tests) 5ms
 ✓ lib/evidence-dossier.test.ts (9 tests) 11ms
 ✓ lib/evidence-review.test.ts (16 tests) 13ms
 ✓ lib/evidence-explorer.test.ts (9 tests) 11ms
 ✓ lib/evidence-import-history.test.ts (7 tests) 10ms
 ✓ lib/evidence-import.test.ts (15 tests) 14ms
 ✓ lib/evidence-handoff-pack.test.ts (6 tests) 20ms

 Test Files  9 passed (9)
      Tests  73 passed (73)
   Start at  16:47:22
   Duration  367ms (transform 833ms, setup 0ms, import 1.27s, tests 95ms, environment 2ms)
```
