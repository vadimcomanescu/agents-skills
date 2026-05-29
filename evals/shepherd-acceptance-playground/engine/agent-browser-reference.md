---
name: agent-browser
description: "agent-browser CLI reference for Ulisse inspect and QA loops."
---

# agent-browser Reference

Use this when `ulisse-config.json` sets `"browserAgent": "agent-browser"`.
The CLI controls Chrome/Chromium through CDP and keeps the session alive across
commands.

## Start

```bash
agent-browser open <url>
```

Ulisse scripts export `AGENT_BROWSER_PROFILE="${ULISSE_CHROME_PROFILE:-Default}"`
and `AGENT_BROWSER_HEADED=1` before opening the browser. To run manually with a
specific Chrome profile, use:

```bash
agent-browser --profile Default open <url>
```

List available Chrome profiles with:

```bash
agent-browser profiles
```

## Core Loop

```bash
agent-browser snapshot -i
agent-browser click @eN
agent-browser fill @eN "text"
agent-browser wait --load networkidle
agent-browser snapshot -i
```

Always run a fresh `agent-browser snapshot -i` before interacting. After
navigation, reloads, modal changes, form submissions, or any DOM-changing action,
old `@eN` refs can be stale.

## Common Commands

```bash
agent-browser open <url>
agent-browser snapshot -i
agent-browser click @eN
agent-browser fill @eN "text"
agent-browser wait --load networkidle
agent-browser wait --text "text"
agent-browser screenshot <path>
agent-browser close
```

## Notes

- Use refs exactly as shown by `agent-browser snapshot -i`, for example `@e4`.
- Use `agent-browser fill @eN "text"` for normal inputs.
- Use `agent-browser press Enter` for keyboard submission.
- Use `agent-browser screenshot <path>` for visual proof artifacts.
- Use `agent-browser close` when the run is finished.
