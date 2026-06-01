#!/usr/bin/env python3
"""Drive the acceptance-pipeline-kit for Shepherd runs.

This is the single entry point a coordinator or a dispatched role uses to run
the executable-acceptance pipeline that ships in
https://github.com/vadimcomanescu/acceptance-pipeline-kit. It does not invent a
verification pipeline; it installs and invokes the kit's own per-language
scripts and turns their output into machine-checkable Shepherd evidence.

Two layers:

  normal acceptance      kit `<lang>/scripts/acceptance.sh`
    proves the current app satisfies executable behaviour examples.

  acceptance-spec mutation   kit `<lang>/scripts/acceptance-mutation.sh`
    mutates one example value at a time and reruns the generated tests to prove
    those examples are actually bound to behaviour. `killed` = the test caught
    the changed example, `survived` = the spec/binding/impl is too weak,
    `error` = the pipeline itself failed (unverifiable).

Subcommands:
  ensure-tools   put gherkin-parser / gherkin-mutator on PATH (runs the kit
                 install.sh only when they are missing).
  acceptance     run normal acceptance, capture log + exit code.
  mutation       run acceptance-spec mutation, write the kit JSON report and a
                 normalized verdict.json, and fail closed on survivors/errors.
  verdict        re-derive a verdict from an existing kit report or verdict.json.

The decision is derived from the kit `results[]` cross-checked against the
`summary` counts, never from a `summary` block or a hand-written `decision`
field alone. Config is resolved from CLI flags first, then a JSON config file
(default `.shepherd/acceptance.json`). No third-party dependencies.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REQUIRED_TOOLS = ("gherkin-parser", "gherkin-mutator")
SUPPORTED_LANGUAGES = ("python", "typescript", "go", "rust")
# Env vars that change WHAT gets proved; if config sets these we record them as
# provenance so a narrowed scope cannot pass silently.
SCOPE_ENV_KEYS = ("FEATURE", "FEATURES_DIR", "IR_DIR", "GENERATED_DIR", "WORK_DIR", "LEVEL")


class ConfigError(Exception):
    """Raised when the acceptance pipeline is misconfigured."""


# --- config ------------------------------------------------------------------


def load_config(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path}: invalid JSON config: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: config must be a JSON object")
    return data


def resolve(args: argparse.Namespace, config: dict, key: str, default=None):
    value = getattr(args, key, None)
    if value is not None:
        return value
    if key in config and config[key] is not None:
        return config[key]
    return default


def merged_env(config: dict, extra: dict | None = None) -> dict:
    env = os.environ.copy()
    for source in (config.get("env") or {}, extra or {}):
        if isinstance(source, dict):
            for name, value in source.items():
                env[str(name)] = str(value)
    return env


def kit_script(kit_dir: Path, language: str, name: str) -> Path:
    if language not in SUPPORTED_LANGUAGES:
        raise ConfigError(f"language {language!r} is not one of {', '.join(SUPPORTED_LANGUAGES)}")
    script = kit_dir / language / "scripts" / name
    if not script.exists():
        raise ConfigError(f"kit script not found: {script}")
    return script


# --- decision core (shared with validate_acceptance_mutation.py) -------------


def _coerce_int(value) -> tuple[int, bool]:
    """Return (int_value, ok). Non-numeric or lossy values are not ok."""
    if isinstance(value, bool):
        return int(value), True
    if isinstance(value, int):
        return value, True
    if isinstance(value, float):
        return int(value), value == int(value)
    if isinstance(value, str):
        try:
            parsed = float(value)
        except ValueError:
            return 0, False
        return int(parsed), parsed == int(parsed)
    return 0, False


def normalize_summary(report) -> dict:
    """Read the kit summary defensively. Bad shapes/values set malformed=True."""
    out = {"total": 0, "killed": 0, "survived": 0, "errors": 0,
           "skipped_scenarios": 0, "skipped_mutations": 0, "malformed": False}
    if not isinstance(report, dict):
        out["malformed"] = True
        return out
    raw = report.get("summary", report.get("Summary"))
    if not isinstance(raw, dict):
        out["malformed"] = True
        return out
    lowered = {str(k).lower(): v for k, v in raw.items()}
    fields = {
        "total": ("total",), "killed": ("killed",), "survived": ("survived",),
        "errors": ("errors", "error"),
        "skipped_scenarios": ("skippedscenarios", "skipped_scenarios"),
        "skipped_mutations": ("skippedmutations", "skipped_mutations"),
    }
    for field, names in fields.items():
        for name in names:
            if name in lowered and lowered[name] is not None:
                value, ok = _coerce_int(lowered[name])
                if not ok or value < 0:
                    out["malformed"] = True
                else:
                    out[field] = value
                break
    return out


def status_of(result: dict) -> str:
    return str(result.get("Status") or result.get("status") or "").lower()


def _mutation_item(result: dict) -> dict:
    mut = result.get("Mutation") or result.get("mutation") or {}
    if not isinstance(mut, dict):
        mut = {}
    return {
        "id": mut.get("ID") or mut.get("id"),
        "path": mut.get("Path") or mut.get("path"),
        "description": mut.get("Description") or mut.get("description"),
    }


def count_results(report) -> dict | None:
    """Tally killed/survived/error from results[]. None if no results array."""
    if not isinstance(report, dict):
        return None
    results = report.get("results")
    if not isinstance(results, list):
        results = report.get("Results")
    if not isinstance(results, list):
        return None
    killed = survived = errors = 0
    survivors: list[dict] = []
    errored: list[dict] = []
    for result in results:
        if not isinstance(result, dict):
            errors += 1
            errored.append({"id": None, "path": None, "error": "non-object result row"})
            continue
        status = status_of(result)
        if status == "survived":
            survived += 1
            survivors.append(_mutation_item(result))
        elif status == "error":
            errors += 1
            item = _mutation_item(result)
            item["error"] = (result.get("Error") or result.get("error") or "").strip().splitlines()[-1:] or [""]
            errored.append(item)
        elif status == "killed":
            killed += 1
    return {"killed": killed, "survived": survived, "errors": errors,
            "survivors": survivors, "errors_detail": errored}


def decide(data, require_mutations: bool) -> dict:
    """Fail-closed verdict from results[] cross-checked against summary counts.

    Accepts a raw kit report ({summary, results}) or a normalized verdict.json
    ({summary, survivors, errors, ...}). The embedded `decision` field, if any,
    is ignored and re-derived.
    """
    reasons: list[str] = []
    summary = normalize_summary(data)

    results = count_results(data)
    if results is not None:
        survivors = results["survivors"]
        errored = results["errors_detail"]
        results_survived = results["survived"]
        results_errors = results["errors"]
    else:
        # verdict.json carries survivors/errors as lists instead of raw results.
        slist = data.get("survivors") if isinstance(data, dict) else None
        elist = data.get("errors") if isinstance(data, dict) else None
        survivors = slist if isinstance(slist, list) else []
        errored = elist if isinstance(elist, list) else []
        results_survived = len(survivors)
        results_errors = len(errored)

    effective_survived = max(summary["survived"], results_survived)
    effective_errors = max(summary["errors"], results_errors)

    if summary["malformed"]:
        reasons.append("malformed or missing summary counts; treating as unverifiable")
    if results is not None and (results_survived != summary["survived"] or results_errors != summary["errors"]):
        reasons.append(
            f"summary/results mismatch: summary says survived={summary['survived']} "
            f"errors={summary['errors']} but results contain survived={results_survived} "
            f"errors={results_errors}"
        )
    if effective_survived > 0:
        reasons.append(
            f"{effective_survived} mutation(s) survived: examples are not bound to "
            "behaviour (weak spec, generated assertion, step binding, or implementation)."
        )
    if effective_errors > 0:
        reasons.append(
            f"{effective_errors} mutation(s) errored: the acceptance pipeline itself "
            "failed, so the evidence is unverifiable."
        )
    discovered_but_skipped = summary["total"] == 0 and (
        summary["skipped_mutations"] > 0 or summary["skipped_scenarios"] > 0
    )
    if summary["total"] == 0 and (require_mutations or discovered_but_skipped):
        reasons.append(
            "no acceptance-spec mutations were executed"
            + (" while examples were discovered (use --level full)" if discovered_but_skipped else " while mutations were required")
            + ": the executable examples cannot prove behaviour-relevant binding."
        )
    if isinstance(data, dict) and "report" in data and data["report"] is None:
        reasons.append("no kit report was produced; the acceptance pipeline did not complete")

    return {
        "decision": "PASS" if not reasons else "BLOCK",
        "summary": summary,
        "survivors": survivors,
        "errors": errored,
        "reasons": reasons,
        "require_mutations": require_mutations,
    }


# --- io helpers --------------------------------------------------------------


def tools_present() -> bool:
    return all(shutil.which(tool) for tool in REQUIRED_TOOLS)


def run_logged(cmd: list[str], cwd: Path, env: dict, log_path: Path) -> int:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(cmd, cwd=str(cwd), env=env, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    log_path.write_text(f"$ (cwd={cwd}) {' '.join(cmd)}\n{proc.stdout}", encoding="utf-8")
    if proc.stdout:
        sys.stdout.write(proc.stdout if proc.stdout.endswith("\n") else proc.stdout + "\n")
    return proc.returncode


def extract_last_json_object(text: str) -> dict | None:
    """Fallback parser for mixed stdout; only used when strict parsing fails."""
    depth = 0
    start = None
    candidate = None
    in_string = False
    escape = False
    for index, char in enumerate(text):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start : index + 1]
    if candidate is None:
        return None
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def print_verdict(verdict: dict) -> None:
    s = verdict["summary"]
    print(
        f"acceptance-spec mutation: total={s['total']} killed={s['killed']} "
        f"survived={s['survived']} errors={s['errors']} "
        f"skipped_scenarios={s['skipped_scenarios']} skipped_mutations={s['skipped_mutations']}"
    )
    print(f"verdict: {verdict['decision']}")
    for reason in verdict["reasons"]:
        print(f"  - {reason}")
    for survivor in verdict["survivors"]:
        print(f"  survived: {survivor.get('id')} {survivor.get('path')} :: {survivor.get('description')}")
    for err in verdict["errors"]:
        print(f"  error: {err.get('id')} {err.get('path')} :: {err.get('error')}")


# --- subcommands -------------------------------------------------------------


def cmd_ensure_tools(args: argparse.Namespace, config: dict) -> int:
    if tools_present():
        print(f"APS tools present: {', '.join(REQUIRED_TOOLS)}")
        return 0
    kit_dir = resolve(args, config, "kit_dir")
    if not kit_dir:
        print("APS tools missing and no kit_dir given. Set kit_dir (CLI --kit-dir or "
              "config) to an acceptance-pipeline-kit checkout.", file=sys.stderr)
        return 1
    installer = Path(kit_dir) / "install.sh"
    if not installer.exists():
        print(f"installer not found: {installer}", file=sys.stderr)
        return 1
    cmd = ["sh", str(installer)]
    if resolve(args, config, "bin_dir"):
        cmd += ["--bin-dir", str(resolve(args, config, "bin_dir"))]
    if resolve(args, config, "version"):
        cmd += ["--version", str(resolve(args, config, "version"))]
    print(f"installing APS tools via {installer}")
    rc = subprocess.run(cmd, env=merged_env(config), check=False).returncode
    if rc != 0:
        print("install.sh failed", file=sys.stderr)
        return rc
    if not tools_present():
        print("install.sh completed but tools are still not on PATH; check the install "
              "bin dir is on PATH.", file=sys.stderr)
        return 1
    print(f"APS tools installed: {', '.join(REQUIRED_TOOLS)}")
    return 0


def cmd_acceptance(args: argparse.Namespace, config: dict) -> int:
    kit_dir = Path(resolve(args, config, "kit_dir", ""))
    language = resolve(args, config, "language")
    project_dir = Path(resolve(args, config, "project_dir", ".")).resolve()
    evidence_dir = Path(resolve(args, config, "evidence_dir", ".shepherd/evidence/acceptance"))
    if not language:
        raise ConfigError("language is required (CLI --language or config)")
    script = kit_script(kit_dir, language, "acceptance.sh")
    log = (evidence_dir / "acceptance.log").resolve()
    rc = run_logged(["bash", str(script), *args.passthrough], project_dir, merged_env(config), log)
    print(f"normal acceptance exit={rc} log={log}")
    return rc


def cmd_mutation(args: argparse.Namespace, config: dict) -> int:
    kit_dir = Path(resolve(args, config, "kit_dir", ""))
    language = resolve(args, config, "language")
    project_dir = Path(resolve(args, config, "project_dir", ".")).resolve()
    evidence_dir = Path(resolve(args, config, "evidence_dir", ".shepherd/evidence/acceptance")).resolve()
    level = resolve(args, config, "level", "full")
    require_mutations = bool(resolve(args, config, "require_mutations", False))
    if not language:
        raise ConfigError("language is required (CLI --language or config)")
    script = kit_script(kit_dir, language, "acceptance-mutation.sh")
    env = merged_env(config)

    evidence_dir.mkdir(parents=True, exist_ok=True)
    raw_log = evidence_dir / "acceptance-mutation.log"
    proc = subprocess.run(
        ["bash", str(script), "--json", "--level", str(level), *args.passthrough],
        cwd=str(project_dir), env=env, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    raw_log.write_text(
        f"$ (cwd={project_dir}) {script} --json --level {level}\n"
        f"--- stdout ---\n{proc.stdout}\n--- stderr ---\n{proc.stderr}\n",
        encoding="utf-8",
    )

    # The kit writes the JSON report to stdout and progress to stderr, so the
    # report is the whole of stdout. Parse it strictly; only scavenge mixed
    # output as a flagged fallback so a trailing log blob cannot masquerade as
    # the report.
    report = None
    parsed_strictly = False
    try:
        report = json.loads(proc.stdout.strip())
        parsed_strictly = isinstance(report, dict)
    except json.JSONDecodeError:
        report = extract_last_json_object(proc.stdout)

    report_path = None
    if report is None or not isinstance(report, dict):
        verdict = decide({"report": None}, require_mutations)
    else:
        report_path = evidence_dir / "acceptance-mutation.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        verdict = decide(report, require_mutations)
        if not parsed_strictly:
            verdict["reasons"].append("kit stdout was not pure JSON; report recovered from mixed output")
            verdict["decision"] = "BLOCK"

    # The kit exit code is authoritative for "all killed, no errors" (0). A PASS
    # verdict alongside a non-zero kit exit means we missed something; fail closed.
    if proc.returncode != 0 and verdict["decision"] == "PASS":
        verdict["reasons"].append(f"kit exited non-zero ({proc.returncode}) but verdict was PASS")
        verdict["decision"] = "BLOCK"

    verdict["provenance"] = {
        "project_dir": str(project_dir),
        "level": str(level),
        "scope_env": {k: env[k] for k in SCOPE_ENV_KEYS if k in (config.get("env") or {})},
    }
    verdict["report"] = str(report_path) if report_path else None
    verdict["kit_exit"] = proc.returncode
    verdict["log"] = str(raw_log)
    verdict_path = evidence_dir / "verdict.json"
    verdict_path.write_text(json.dumps(verdict, indent=2), encoding="utf-8")

    if verdict["provenance"]["scope_env"]:
        print(f"provenance: config narrowed scope env -> {verdict['provenance']['scope_env']}")
    print_verdict(verdict)
    print(f"report={verdict['report']} verdict={verdict_path} kit_exit={proc.returncode}")
    return 0 if verdict["decision"] == "PASS" else 1


def cmd_verdict(args: argparse.Namespace, config: dict) -> int:
    report_path = Path(args.report)
    if not report_path.exists():
        print(f"report not found: {report_path}", file=sys.stderr)
        return 1
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"{report_path}: invalid JSON: {exc}", file=sys.stderr)
        return 1
    require = bool(resolve(args, config, "require_mutations", False))
    if isinstance(data, dict) and data.get("require_mutations"):
        require = True
    verdict = decide(data, require)  # always re-derive; never trust embedded decision
    print_verdict(verdict)
    return 0 if verdict["decision"] == "PASS" else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=Path, default=Path(".shepherd/acceptance.json"),
                        help="JSON config file (default .shepherd/acceptance.json)")
    parser.add_argument("--kit-dir", dest="kit_dir", help="acceptance-pipeline-kit checkout")
    parser.add_argument("--language", choices=SUPPORTED_LANGUAGES)
    parser.add_argument("--project-dir", dest="project_dir", help="dir to run the kit scripts from")
    parser.add_argument("--evidence-dir", dest="evidence_dir", help="where to write logs/reports/verdict")
    parser.add_argument("--level", choices=("full", "hard", "soft"))
    parser.add_argument("--require-mutations", dest="require_mutations", action="store_true", default=None,
                        help="treat zero executed mutations as a BLOCK")
    parser.add_argument("--bin-dir", dest="bin_dir", help="install dir for ensure-tools")
    parser.add_argument("--version", help="pin APS release tag for ensure-tools")

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("ensure-tools", help="ensure APS binaries are on PATH").set_defaults(func=cmd_ensure_tools)
    p_acc = sub.add_parser("acceptance", help="run normal acceptance")
    p_acc.add_argument("passthrough", nargs="*", help="extra args passed to acceptance.sh")
    p_acc.set_defaults(func=cmd_acceptance)
    p_mut = sub.add_parser("mutation", help="run acceptance-spec mutation and produce a verdict")
    p_mut.add_argument("passthrough", nargs="*", help="extra args passed to acceptance-mutation.sh")
    p_mut.set_defaults(func=cmd_mutation)
    p_ver = sub.add_parser("verdict", help="re-derive a verdict from an existing report")
    p_ver.add_argument("report", help="path to kit JSON report or a prior verdict.json")
    p_ver.set_defaults(func=cmd_verdict)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args, load_config(args.config))
    except ConfigError as exc:
        print(f"config error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
