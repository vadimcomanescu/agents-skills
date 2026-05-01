# Python + pytest + uv — a full TDD cycle

Tooling: `pytest` for tests, `mutmut` for mutation testing, `uv` for environment management. Tests live in `tests/` per Vadim's conventions.

```bash
uv add --dev pytest mutmut
```

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
addopts = "-v"
```

Layout:

```
src/
  pricing/
    __init__.py
    discount.py
tests/
  test_discount.py
pyproject.toml
```

## Cycle 1 — feature add (tracer bullet)

**Goal:** apply a percent discount.

### RED — `tests/test_discount.py`

```python
from pricing.discount import discount

def test_reduces_100_by_10_percent_to_90():
    assert discount(100, 10) == 90
```

### Verify RED

```bash
uv run pytest tests/test_discount.py
# FAIL: ModuleNotFoundError: pricing.discount
```

Add a stub:

```python
# src/pricing/discount.py
def discount(amount: float, percent: float) -> float:
    return 0
```

```bash
uv run pytest tests/test_discount.py
# FAIL: assert 0 == 90  ← clean RED
```

### GREEN — minimum

```python
def discount(amount: float, percent: float) -> float:
    return amount - (amount * percent / 100)
```

```bash
uv run pytest
# PASS
```

### Commit (behavioral)

```
Add: discount(amount, percent) reduces by percent

Tracer bullet for pricing.discount: 100 - 10% = 90.
```

## Cycle 2 — error path

### RED

```python
import pytest
from pricing.discount import discount

def test_raises_when_percent_above_100():
    with pytest.raises(ValueError, match="percent must be 0..100"):
        discount(100, 150)
```

### Verify RED

```bash
uv run pytest -v tests/test_discount.py::test_raises_when_percent_above_100
# FAIL: DID NOT RAISE — clean RED
```

### GREEN

```python
def discount(amount: float, percent: float) -> float:
    if percent < 0 or percent > 100:
        raise ValueError("percent must be 0..100")
    return amount - (amount * percent / 100)
```

### Verify GREEN

```bash
uv run pytest
# All tests pass.
```

### Commit (behavioral)

```
Add: discount raises ValueError on percent outside 0..100
```

## Cycle 3 — bug fix (Prove-It Pattern)

**Bug:** "`discount(-100, 10)` returns `-90`; user expects a `ValueError`."

### RED

```python
def test_raises_on_negative_amount():
    with pytest.raises(ValueError, match="amount must be non-negative"):
        discount(-100, 10)
```

### Verify RED

```bash
uv run pytest -v tests/test_discount.py::test_raises_on_negative_amount
# FAIL: DID NOT RAISE  ← bug confirmed
```

### Fix

```python
def discount(amount: float, percent: float) -> float:
    if amount < 0:
        raise ValueError("amount must be non-negative")
    if percent < 0 or percent > 100:
        raise ValueError("percent must be 0..100")
    return amount - (amount * percent / 100)
```

### Verify GREEN

```bash
uv run pytest
# All tests pass.
```

### Commit (behavioral)

```
Fix: discount rejects negative amounts

Reproduces the bug with a test; fix adds the input guard.
```

## Refactor (Tidy First — separate commit)

```python
def _assert_non_negative(amount: float) -> None:
    if amount < 0:
        raise ValueError("amount must be non-negative")

def _assert_percent(percent: float) -> None:
    if percent < 0 or percent > 100:
        raise ValueError("percent must be 0..100")

def discount(amount: float, percent: float) -> float:
    _assert_non_negative(amount)
    _assert_percent(percent)
    return amount - (amount * percent / 100)
```

```bash
uv run pytest
# Green.
```

### Commit (structural)

```
Refactor: extract assertion helpers in discount
```

## Mutation testing

mutmut 3.x is configured via `pyproject.toml`, not CLI flags. Add this once:

```toml
# pyproject.toml
[tool.mutmut]
paths_to_mutate = ["src/pricing/"]
```

Then:

```bash
uv run mutmut run
uv run mutmut results
```

Output lists each surviving mutant by id (e.g. `pricing.discount.x_discount__mutmut_4`). Inspect with:

```bash
uv run mutmut show <id>
```

For every survivor:

- Identify which assertion would have caught the mutation.
- Add a test or strengthen an existing assertion.
- Re-run.

Common survivors:

- `-` → `+` in the formula: assertion `assert discount(100, 10) == 90` would catch it; weaker assertions (`> 0`) would not.
- `<` → `<=` in `amount < 0`: test that `discount(0, 10) == 0` does not raise.
- `>` → `>=` in `percent > 100`: pass `100` (must not raise) and `101` (must raise).
- String literal `"X"` → `"XXXXXX"`: see the gotcha below.

### Gotcha: `pytest.raises(match=...)` is regex, not equality

`pytest.raises(match="percent must be 0..100")` lets string-literal mutations survive — `match` runs `re.search`, so the dots are wildcards and `"XXpercent must be 0..100XX"` still matches.

Two fixes that kill string mutants:

```python
# Option 1 — assert exact equality on the message
with pytest.raises(ValueError) as exc_info:
    discount(100, 150)
assert str(exc_info.value) == "percent must be 0..100"

# Option 2 — anchor and escape the regex
with pytest.raises(ValueError, match=r"^percent must be 0\.\.100$"):
    discount(100, 150)
```

Option 1 is the easier default; option 2 is fine when you want the looseness of regex elsewhere.

## Property-based tests (optional, often valuable)

For numeric code, a property test in `hypothesis` complements example-based tests:

```python
from hypothesis import given, strategies as st
from pricing.discount import discount

@given(amount=st.floats(min_value=0, max_value=1e6, allow_nan=False),
       percent=st.floats(min_value=0, max_value=100, allow_nan=False))
def test_discount_never_exceeds_amount(amount, percent):
    assert discount(amount, percent) <= amount
```

These do not replace example tests; they catch the cases your imagination missed.

## Notes on Vadim's global rules

- `uv` and `pyproject.toml` only — no `pip` venvs, no Poetry, no `requirements.txt`.
- pytest only, never unittest.
- Tests under `tests/`, not colocated.
- Strong type hints throughout; Pydantic models for structured data.
- Run `uv sync && pytest -v` before claiming complete.
