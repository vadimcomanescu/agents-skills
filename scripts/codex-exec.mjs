#!/usr/bin/env node
/**
 * codex-exec.mjs — thin, bulletproof wrapper around `codex exec`.
 *
 * Delegate ONE task to OpenAI Codex non-interactively and print Codex's final
 * answer on stdout. Self-contained: Node builtins + the `codex` CLI on PATH.
 * Part of agents-skills (MIT).
 *
 * Why a wrapper at all (vs calling `codex exec` directly)? Three things codex
 * exec does not give cleanly, each load-bearing when embedding Codex as a
 * sub-agent in a Claude Code workflow:
 *   1. --color never  — the calling agent never ingests ANSI escape noise.
 *   2. --timeout       — codex exec has NO native timeout; an unbounded run
 *                        would hang a workflow step (and its task slot) forever.
 *   3. a hard exit-code + empty-output contract + signal forwarding — so a
 *                        workflow consumer can trust $? and stdout, and Codex
 *                        is never orphaned.
 * Everything else is a faithful pass-through; codex values are never validated
 * or mutated (so OpenAI's own errors surface unchanged).
 *
 * Usage:
 *   codex-exec [--model <m>] [--effort <level>] [--cwd <dir>] [--write] [--timeout <secs>] [--] <prompt...>
 *   printf '%s' "<prompt>" | codex-exec [flags]
 *
 *   --model <name>    codex -m (verbatim; the caller expands any alias such as "spark")
 *   --effort <level>  codex -c model_reasoning_effort="<level>"  (e.g. low|medium|high)
 *   --cwd <dir>       codex -C   (working root; default: current directory)
 *   --write           sandbox workspace-write (default: read-only)
 *   --timeout <secs>  SIGTERM the run after <secs> (default 600; 0 disables), SIGKILL 5s later
 *
 * Exit: 0 success; 2 usage error; 3 if codex exited 0 but produced no output;
 *       124 on timeout; 126 if codex could not be spawned (e.g. EACCES);
 *       127 if `codex` is not on PATH; 128+signal if codex was signal-killed;
 *       otherwise codex's own non-zero exit code.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const DEFAULT_TIMEOUT_S = 600;

const HELP = `codex-exec — delegate one task to \`codex exec\`, print Codex's answer.

  codex-exec [--model <m>] [--effort <level>] [--cwd <dir>] [--write] [--timeout <secs>] [--] <prompt...>
  printf '%s' "<prompt>" | codex-exec [flags]

Faithful pass-through to codex: --model (-m, verbatim), --effort (model_reasoning_effort),
--cwd (-C), --write (workspace-write; default read-only), --timeout (default ${DEFAULT_TIMEOUT_S}s; 0 disables).
`;

function fail(msg, code = 2) { process.stderr.write(`codex-exec: ${msg}\n`); process.exit(code); }
function need(v, flag) { if (v === undefined || v === "--" || v.startsWith("--")) fail(`${flag} needs a value`); return v; }

const argv = process.argv.slice(2);
let model = null, effort = null, cwd = process.cwd(), write = false, timeoutS = DEFAULT_TIMEOUT_S;
const parts = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--") { parts.push(...argv.slice(i + 1)); break; }
  else if (a === "--write") write = true;
  else if (a === "--model") model = need(argv[++i], "--model");
  else if (a === "--effort") effort = need(argv[++i], "--effort");
  else if (a === "--cwd") cwd = need(argv[++i], "--cwd");
  else if (a === "--timeout") {
    timeoutS = Number(need(argv[++i], "--timeout"));
    if (!Number.isFinite(timeoutS) || timeoutS < 0) fail("--timeout needs a non-negative number of seconds");
  }
  else if (a === "-h" || a === "--help") { process.stdout.write(HELP); process.exit(0); }
  else if (a.startsWith("-") && a !== "-") fail(`unknown option: ${a}`);
  else parts.push(a);
}

let prompt = parts.join(" ").trim();
if (!prompt && !process.stdin.isTTY) { try { prompt = readFileSync(0, "utf8").trim(); } catch { /* no stdin */ } }
if (!prompt) fail("no prompt (pass as arguments or pipe via stdin)");

const tmpDir = mkdtempSync(join(os.tmpdir(), "codex-exec-"));
const outFile = join(tmpDir, "last.txt");
let cleaned = false;
const cleanup = () => { if (cleaned) return; cleaned = true; try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ } };
process.on("exit", cleanup); // guarantees temp removal on every exit path, signals included

const args = ["exec", "--color", "never", "--skip-git-repo-check", "-s", write ? "workspace-write" : "read-only", "-C", cwd];
if (model) args.push("-m", model); // verbatim — alias expansion is the caller's job (one canonical place)
// -c parses its value as TOML; the embedded double-quotes make model_reasoning_effort a TOML string.
if (effort) args.push("-c", `model_reasoning_effort="${effort}"`);
args.push("-o", outFile, prompt);

// codex stdout + stderr -> our stderr (progress AND errors); our stdout (fd 1) carries only the final answer.
const child = spawn("codex", args, { stdio: ["ignore", 2, 2] });

// Hard timeout (codex exec has none): SIGTERM, then SIGKILL after a 5s grace.
let timedOut = false, killTimer, graceTimer;
if (timeoutS > 0) {
  killTimer = setTimeout(() => {
    timedOut = true;
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      graceTimer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 5000);
    }
  }, timeoutS * 1000);
}
const clearTimers = () => { if (killTimer) clearTimeout(killTimer); if (graceTimer) clearTimeout(graceTimer); };

// Never orphan codex: forward terminating signals (SIGHUP covers SSH/CI disconnects).
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { if (child.exitCode === null && !child.killed) child.kill(sig); });

child.on("error", (err) => {
  clearTimers();
  if (err.code === "ENOENT")
    fail("`codex` not found on PATH. Install with `npm install -g @openai/codex`, then run `codex login`.", 127);
  fail(`could not spawn codex: ${err.message}`, 126); // e.g. EACCES — distinct from "not installed"
});

child.on("close", (code, signal) => {
  clearTimers();
  if (timedOut) fail(`codex timed out after ${timeoutS}s`, 124);
  if (signal) fail(`codex terminated by signal ${signal}`, 128 + (os.constants.signals[signal] ?? 0));
  if (code === 0) {
    let answer = "";
    try { answer = readFileSync(outFile, "utf8"); } catch { /* none captured */ }
    // Silent blank success is the worst pipeline failure — treat exit-0-with-no-output as a hard error.
    if (!answer.trim()) fail("codex exited 0 but produced no output", 3);
    process.stdout.write(answer.endsWith("\n") ? answer : answer + "\n");
    process.exit(0);
  }
  // Non-zero codex exit: leave stdout empty; the error is already on stderr.
  process.exit(code ?? 1);
});
