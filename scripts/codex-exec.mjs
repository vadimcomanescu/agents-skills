#!/usr/bin/env node
/**
 * codex-exec.mjs — self-contained wrapper around the OpenAI Codex CLI's `codex exec`.
 *
 * Part of agents-skills (MIT). Depends ONLY on Node builtins and the `codex` CLI on
 * PATH. It does NOT depend on the openai-codex Claude Code plugin or its runtime.
 *
 * Delegates a single task to Codex non-interactively and prints Codex's final
 * message on stdout ONLY on success. Codex progress / reasoning is streamed to
 * stderr, so stdout stays clean and machine-parseable. On any failure (nonzero
 * exit, signal, or timeout) stdout is left empty and the error is on stderr.
 *
 * Usage:
 *   node codex-exec.mjs [options] [--] <prompt...>
 *   printf '%s' "<prompt>" | node codex-exec.mjs [options]
 *
 * Options:
 *   --write            Allow Codex to modify files (sandbox: workspace-write). Default: read-only.
 *   --full-access      Sandbox: danger-full-access (no sandbox; for --write tasks needing
 *                      local network/installs). Use deliberately.
 *   --model <name>     Model for Codex (passes `-m`). Alias: "spark" -> "gpt-5.3-codex-spark".
 *                      Omit to use the codex CLI's configured default.
 *   --effort <level>   Reasoning effort: none|minimal|low|medium|high|xhigh
 *                      (passes `-c model_reasoning_effort="<level>"`).
 *                      NOTE: the API rejects `none`/`minimal` when hosted tools
 *                      (web_search, image_gen) are enabled — see the warning it prints.
 *   --cwd <dir>        Working root for Codex (passes `-C`). Default: current directory.
 *   --timeout <secs>   Hard cap: SIGTERM the run after <secs>, SIGKILL 5s later (exit 124).
 *   --print-cmd        Print the `codex exec` command that WOULD run, then exit (no execution).
 *                      (alias: --dry-run)
 *   --read-only        Force read-only (default; the inverse of --write).
 *   -h, --help         Show this help.
 *
 * Not exposed (use the `codex` CLI directly if needed): session --resume, --json,
 * --output-schema, --image, --add-dir.
 *
 * Exit codes: 0 success; codex's nonzero code on failure; 128+signal if Codex was
 *   signal-killed; 124 on --timeout; 2 usage error; 127 if `codex` is not found.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const MODEL_ALIASES = { spark: "gpt-5.3-codex-spark" }; // NOTE: alias target is version-sensitive.
const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"];
// The API rejects these efforts when hosted tools (web_search/image_gen) are enabled.
const TOOL_HOSTILE_EFFORTS = new Set(["none", "minimal"]);

const HELP = `codex-exec.mjs — delegate one task to OpenAI Codex (\`codex exec\`).

Usage:
  node codex-exec.mjs [options] [--] <prompt...>
  printf '%s' "<prompt>" | node codex-exec.mjs [options]

Options:
  --write           Allow file edits (sandbox: workspace-write). Default: read-only.
  --read-only       Force read-only (default).
  --full-access     Sandbox: danger-full-access (no sandbox). Use deliberately.
  --model <name>    Codex model (-m). Alias "spark" -> gpt-5.3-codex-spark. Omit for default.
  --effort <level>  Reasoning effort: ${EFFORT_LEVELS.join("|")}.
                    (none/minimal 400 when hosted tools are enabled — a warning is printed.)
  --cwd <dir>       Working root (-C). Default: current directory.
  --timeout <secs>  SIGTERM after <secs>, SIGKILL 5s later (exit 124).
  --print-cmd       Print the codex command that would run, then exit (alias: --dry-run).
  -h, --help        Show this help.

Exit: 0 ok; codex code on failure; 128+signal if killed; 124 timeout; 2 usage; 127 no codex.
`;

function fail(msg, code = 2) { process.stderr.write(`codex-exec: ${msg}\n`); process.exit(code); }
function warn(msg) { process.stderr.write(`codex-exec: warning: ${msg}\n`); }

function needValue(argv, i, flag) {
  const v = argv[i + 1];
  if (v === undefined || v === "--" || v.startsWith("--"))
    fail(`${flag} requires a value (got ${v === undefined ? "nothing" : `'${v}'`})`);
  return v;
}

function parseArgs(argv) {
  const opts = { write: false, fullAccess: false, model: null, effort: null, cwd: process.cwd(), timeout: 0, printCmd: false };
  const promptParts = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { promptParts.push(...argv.slice(i + 1)); break; }
    else if (a === "--write") opts.write = true;
    else if (a === "--read-only") opts.write = false;
    else if (a === "--full-access") opts.fullAccess = true;
    else if (a === "--print-cmd" || a === "--dry-run") opts.printCmd = true;
    else if (a === "-h" || a === "--help") { process.stdout.write(HELP); process.exit(0); }
    else if (a === "--model") { opts.model = needValue(argv, i, a); i++; }
    else if (a === "--effort") { opts.effort = needValue(argv, i, a); i++; }
    else if (a === "--cwd") { opts.cwd = needValue(argv, i, a); i++; }
    else if (a === "--timeout") {
      opts.timeout = Number(needValue(argv, i, a)); i++;
      if (!Number.isFinite(opts.timeout) || opts.timeout < 0) fail("--timeout requires a non-negative number of seconds");
    }
    else if (a.startsWith("-") && a !== "-") fail(`unknown option: ${a}`);
    else promptParts.push(a);
  }
  return { opts, prompt: promptParts.join(" ").trim() };
}

function buildCodexArgs(opts, lastMsgFile) {
  const sandbox = opts.fullAccess ? "danger-full-access" : opts.write ? "workspace-write" : "read-only";
  const args = ["exec", "--color", "never", "--skip-git-repo-check", "-s", sandbox, "-C", opts.cwd];
  if (opts.model) args.push("-m", MODEL_ALIASES[opts.model.toLowerCase()] ?? opts.model);
  if (opts.effort) args.push("-c", `model_reasoning_effort="${opts.effort}"`);
  if (lastMsgFile) args.push("-o", lastMsgFile);
  return args;
}

const { opts, prompt: argPrompt } = parseArgs(process.argv.slice(2));

if (opts.effort && !EFFORT_LEVELS.includes(opts.effort))
  fail(`invalid --effort '${opts.effort}' (expected one of: ${EFFORT_LEVELS.join("|")})`);
if (opts.effort && TOOL_HOSTILE_EFFORTS.has(opts.effort))
  warn(`--effort ${opts.effort} is rejected by the API when hosted tools (web_search, image_gen) are enabled; ` +
       `if you get an HTTP 400 "tools cannot be used with reasoning.effort", disable those tools in ~/.codex/config.toml or use --effort low.`);

// Prompt resolution: CLI args win; otherwise read piped stdin (e.g. a heredoc).
let prompt = argPrompt;
if (!prompt && !process.stdin.isTTY) {
  try { prompt = readFileSync(0, "utf8").trim(); } catch { /* no stdin */ }
}

if (opts.printCmd) {
  // Faithful no-shell preview: every argv element is a discrete, quoted token.
  const args = buildCodexArgs(opts, "<last-message-file>");
  process.stdout.write(["codex", ...args, prompt || "<prompt>"].map((a) => JSON.stringify(a)).join(" ") + "\n");
  process.exit(0);
}

if (!prompt) fail("no prompt provided (pass as arguments or pipe via stdin)");

const tmpDir = mkdtempSync(join(os.tmpdir(), "codex-exec-"));
const lastMsgFile = join(tmpDir, "last-message.txt");
let cleanedUp = false;
const cleanup = () => { if (cleanedUp) return; cleanedUp = true; try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ } };
process.on("exit", cleanup); // guarantees temp removal on every exit path, including signals.

// codex stdout + stderr -> our stderr (progress); our stdout (fd 1) reserved for the final message.
const child = spawn("codex", [...buildCodexArgs(opts, lastMsgFile), prompt], { stdio: ["ignore", 2, 2] });

let timedOut = false;
let killTimer, graceTimer;
const clearTimers = () => { if (killTimer) clearTimeout(killTimer); if (graceTimer) clearTimeout(graceTimer); };

if (opts.timeout > 0) {
  killTimer = setTimeout(() => {
    timedOut = true;
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      graceTimer = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 5000);
    }
  }, opts.timeout * 1000);
}

// Forward termination signals to the child so Codex is never orphaned; its close fires our exit.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (child.exitCode === null && !child.killed) child.kill(sig);
    else process.exit(128 + (os.constants.signals[sig] ?? 0));
  });
}

child.on("error", (err) => {
  clearTimers();
  if (err.code === "ENOENT")
    fail("`codex` CLI not found on PATH. Install with `npm install -g @openai/codex`, then run `codex login`.", 127);
  fail(err.message, 127);
});

child.on("close", (code, signal) => {
  clearTimers();
  // Success ONLY on a clean exit: print Codex's final message to stdout.
  if (code === 0 && !signal && !timedOut) {
    let finalMessage = "";
    try { finalMessage = readFileSync(lastMsgFile, "utf8"); } catch { /* none captured */ }
    if (finalMessage) process.stdout.write(finalMessage.endsWith("\n") ? finalMessage : finalMessage + "\n");
    process.exit(0);
  }
  // Failure: keep stdout empty; the error detail was streamed to stderr by Codex.
  if (timedOut) fail(`codex timed out after ${opts.timeout}s`, 124);
  if (signal) { warn(`codex terminated by signal ${signal}`); process.exit(128 + (os.constants.signals[signal] ?? 0)); }
  process.exit(code ?? 1);
});
