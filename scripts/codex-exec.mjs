#!/usr/bin/env node
/**
 * codex-exec.mjs — thin wrapper around `codex exec`.
 *
 * Delegate ONE task to OpenAI Codex non-interactively and print Codex's final
 * answer on stdout (Codex progress streams to stderr). Self-contained: Node
 * builtins + the `codex` CLI on PATH. Part of agents-skills (MIT).
 *
 * Flags are a faithful pass-through to `codex exec` — nothing is validated or
 * second-guessed. If Codex rejects a value, Codex's own error is surfaced.
 *
 * Usage:
 *   node codex-exec.mjs [--model <m>] [--effort <level>] [--cwd <dir>] [--write] [--] <prompt...>
 *   printf '%s' "<prompt>" | node codex-exec.mjs [flags]
 *
 *   --model <name>    codex -m   (alias: "spark" -> "gpt-5.3-codex-spark"; else verbatim)
 *   --effort <level>  codex -c model_reasoning_effort="<level>"  (e.g. low|medium|high)
 *   --cwd <dir>       codex -C   (working root; default: current directory)
 *   --write           sandbox workspace-write (default: read-only)
 *
 * Exit: Codex's exit code on completion; 128+signal if Codex was killed;
 *       2 on a usage error; 127 if `codex` is not on PATH.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const HELP = `codex-exec.mjs — delegate one task to \`codex exec\`, print Codex's answer.

  node codex-exec.mjs [--model <m>] [--effort <level>] [--cwd <dir>] [--write] [--] <prompt...>
  printf '%s' "<prompt>" | node codex-exec.mjs [flags]

Flags pass straight through to codex: --model (-m, "spark" aliases gpt-5.3-codex-spark),
--effort (model_reasoning_effort), --cwd (-C), --write (workspace-write; default read-only).
`;

function fail(msg, code = 2) { process.stderr.write(`codex-exec: ${msg}\n`); process.exit(code); }
function need(v, flag) { if (v === undefined || v === "--" || v.startsWith("--")) fail(`${flag} needs a value`); return v; }

const argv = process.argv.slice(2);
let model = null, effort = null, cwd = process.cwd(), write = false;
const parts = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--") { parts.push(...argv.slice(i + 1)); break; }
  else if (a === "--write") write = true;
  else if (a === "--model") model = need(argv[++i], "--model");
  else if (a === "--effort") effort = need(argv[++i], "--effort");
  else if (a === "--cwd") cwd = need(argv[++i], "--cwd");
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
process.on("exit", cleanup);

const args = ["exec", "--color", "never", "--skip-git-repo-check", "-s", write ? "workspace-write" : "read-only", "-C", cwd];
if (model) args.push("-m", model.toLowerCase() === "spark" ? "gpt-5.3-codex-spark" : model);
if (effort) args.push("-c", `model_reasoning_effort="${effort}"`);
args.push("-o", outFile, prompt);

// codex stdout + stderr -> our stderr (progress); our stdout (fd 1) carries only the final answer.
const child = spawn("codex", args, { stdio: ["ignore", 2, 2] });

// Forward Ctrl-C / termination to Codex so it is never orphaned; its close fires our exit.
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (child.exitCode === null && !child.killed) child.kill(sig); });

child.on("error", (err) =>
  fail(err.code === "ENOENT"
    ? "`codex` not found on PATH. Install with `npm install -g @openai/codex`, then run `codex login`."
    : err.message, 127));

child.on("close", (code, signal) => {
  if (code === 0 && !signal) {
    let answer = "";
    try { answer = readFileSync(outFile, "utf8"); } catch { /* none */ }
    if (answer) process.stdout.write(answer.endsWith("\n") ? answer : answer + "\n");
    process.exit(0);
  }
  // Failure: leave stdout empty; Codex's error is already on stderr.
  process.exit(signal ? 128 + (os.constants.signals[signal] ?? 0) : code ?? 1);
});
