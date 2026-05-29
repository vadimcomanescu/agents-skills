# Discovery Verification

## `make check`
- Exit: 0
```text
npm test

> shepherd-acceptance-playground@0.1.0 test
> vitest run


 RUN  v4.0.15 /home/vadim/Code/agents-skills/evals/shepherd-acceptance-playground

 ✓ lib/evidence-import-history.test.ts (7 tests) 10ms
 ✓ lib/evidence-verification.test.ts (6 tests) 5ms
 ✓ lib/quote-store.test.ts (4 tests) 5ms
 ✓ lib/workflow-mode.test.ts (1 test) 3ms
 ✓ lib/evidence-dossier.test.ts (9 tests) 14ms
 ✓ lib/evidence-review.test.ts (16 tests) 15ms
 ✓ lib/evidence-explorer.test.ts (9 tests) 10ms
 ✓ lib/evidence-handoff-pack.test.ts (6 tests) 20ms
 ✓ lib/evidence-import.test.ts (15 tests) 17ms

 Test Files  9 passed (9)
      Tests  73 passed (73)
   Start at  17:31:37
   Duration  377ms (transform 894ms, setup 0ms, import 1.29s, tests 99ms, environment 2ms)
```

## `make test`
- Exit: 0
```text
npm test

> shepherd-acceptance-playground@0.1.0 test
> vitest run


 RUN  v4.0.15 /home/vadim/Code/agents-skills/evals/shepherd-acceptance-playground

 ✓ lib/workflow-mode.test.ts (1 test) 4ms
 ✓ lib/evidence-verification.test.ts (6 tests) 8ms
 ✓ lib/quote-store.test.ts (4 tests) 7ms
 ✓ lib/evidence-review.test.ts (16 tests) 13ms
 ✓ lib/evidence-import-history.test.ts (7 tests) 8ms
 ✓ lib/evidence-dossier.test.ts (9 tests) 10ms
 ✓ lib/evidence-import.test.ts (15 tests) 15ms
 ✓ lib/evidence-explorer.test.ts (9 tests) 12ms
 ✓ lib/evidence-handoff-pack.test.ts (6 tests) 21ms

 Test Files  9 passed (9)
      Tests  73 passed (73)
   Start at  17:31:38
   Duration  391ms (transform 1.16s, setup 0ms, import 1.37s, tests 98ms, environment 2ms)
```
