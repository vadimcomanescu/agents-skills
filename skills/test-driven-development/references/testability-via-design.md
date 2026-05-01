# Testability comes from design, not from cleverness

## Contents
- Listen to the test
- Deep modules (Ousterhout)
- POEEA seams — testability hooks worth knowing by name
- Dependency injection — manual is enough
- Hexagonal seams — ports and adapters
- When the design fights you
- Anti-patterns to avoid here
- Quick self-check

Hard-to-test code is hard-to-use code. When a test reveals that the unit is painful to set up, the test is telling you about a design problem, not a testing problem. Listen to the test.

## Listen to the test

The classic pattern (Beck, Freeman & Pryce):

```
A test that is hard to write
  ⇒ a unit that is hard to use
    ⇒ a design that needs to change.
```

Specific cues and what they are saying:

| The test feels... | The design probably has... | Try... |
|---|---|---|
| Hard to set up | Too many collaborators in the constructor | Extract a deep module that hides several of them |
| Slow | I/O baked into the unit | Inject a fake clock, fake DB, fake HTTP client |
| Brittle (breaks on rename) | Tests coupled to internals | Move assertions to public outputs (`state-vs-interaction.md`) |
| Forced to mock everything | The unit talks to too many things | Find the seam — split the unit, or invert dependencies |
| Needs reflection or `@private` access | A behavior you want to assert on isn't exposed | Promote the observation to the public interface |

## Deep modules (Ousterhout)

From John Ousterhout's *A Philosophy of Software Design*: a **deep module** has a small interface and a deep implementation. The opposite — a wide, shallow module — is many small public methods that each do little.

Deep modules are easier to test because:

- The test surface is small (few public methods to exercise).
- The asserts are state-based (the module produces outcomes, not exposes plumbing).
- Refactors stay inside the module without breaking tests.

When a TDD cycle pushes you to expose a private collaborator just to test it, the module is too shallow. Pull more of the implementation behind the existing interface, or change the interface to expose the right level of behavior.

Source: Ousterhout, *A Philosophy of Software Design* (2018).

## POEEA seams — testability hooks worth knowing by name

From Martin Fowler's *Patterns of Enterprise Application Architecture* (POEEA, 2002). These are the places in a typical app architecture where the seams are natural and tests are pleasant. Use them when they apply; do not invent them when they don't.

- **Domain Model** — business logic in objects with state and behavior. Pure, testable in-process. The deepest tests live here.
- **Service Layer** — coordinates domain operations and transactions. Tested with the domain real and infrastructure faked.
- **Repository** — abstracts the persistence mechanism. Inject a fake repository (in-memory) for fast tests; real one for integration tests.
- **Gateway** — wraps an external system. The seam where you record-and-replay or fake.
- **Mapper** — translates between layers. Pure, testable in-process.
- **Unit of Work** — tracks changes and commits atomically. Tested with a real transactional test DB.

Catalog: <https://martinfowler.com/eaaCatalog/>.

## Dependency injection — manual is enough

You do not need a DI container for testability. You need *constructor parameters* and *function arguments*.

```typescript
// Hard to test — collaborators baked in
class TaskService {
  constructor() {
    this.db = new PostgresDB();
    this.clock = new SystemClock();
  }
}

// Easy to test — collaborators injected
class TaskService {
  constructor(private db: TaskRepository, private clock: Clock) {}
}
```

Production wires the real ones; tests wire fakes. No framework required.

> A DI container is rarely the right answer in a project that doesn't already have one. Three constructor parameters per class is fine. Five is a smell that the class is doing too much.

## Hexagonal seams — ports and adapters

A simpler statement of the same idea: identify your **ports** (the interfaces your domain expects) and your **adapters** (the implementations that talk to the world). Test the domain with adapters faked. Test the adapters in isolation, against the real external system if cheap.

Hexagonal/Clean Architecture is overkill for a small app, but the *concept* — domain core, faked at the edges — is the testability shape that scales.

## When the design fights you

If you have read this far and your test is still painful, the answer is one of:

1. **Move the unit boundary.** What you thought was the unit is too small or too large. Test at the level the behavior actually lives.
2. **Add the missing query.** Promote the thing you wanted to assert on into a public read.
3. **Split or merge.** Two coupled units that always change together should be one. One unit doing two unrelated things should be two.
4. **Replace inheritance with composition.** Hierarchies are hard to test in isolation; composed objects compose under test.

Refactor the production code, not the test. The test was the messenger.

## Anti-patterns to avoid here

- **Test-only public methods.** Adding `public destroy()` to a production class because tests need to reset state. Put cleanup in a test util that operates on the public interface, or ensure the production class doesn't need cleanup.
- **`@VisibleForTesting`.** A symptom — you wanted a private thing public for tests. Refactor the boundary instead.
- **Reflection in tests.** Brittle, breaks on rename, hides design smells. Almost always wrong.
- **Singletons.** Hard to inject fakes for. Convert to instance + factory.
- **Static helpers with hidden state.** Same problem as singletons. Make them instance methods or pass state explicitly.

## Quick self-check

Before merging a feature:

- [ ] Each unit's tests can be read without opening the implementation.
- [ ] Each unit's tests run in milliseconds (Small) unless they cross a real boundary deliberately.
- [ ] No production class has a public method whose only caller is a test.
- [ ] No test reaches into a private field via reflection or `// @ts-expect-error`.
- [ ] If you renamed three internal helpers, fewer than 10% of tests would break.

If any of these is false, the design has work to do — not the test.
