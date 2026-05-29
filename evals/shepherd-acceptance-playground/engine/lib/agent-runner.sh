#!/bin/bash
# agent-runner.sh — shared helper so each loop phase (inspect / build / qa /
# architecture) can be backed by either codex or claude.
#
# Call `load_agent_config <phase>` to populate ULISSE_AGENT, ULISSE_MODEL, and
# ULISSE_REASONING_EFFORT from ulisse-config.json, then call
# `agent_invoke <timeout_seconds> <prompt>` to actually run the agent.
#
# Per-phase keys in ulisse-config.json:
#   inspectAgent, buildAgent, qaAgent, architectureAgent       (enum: codex | claude)
#   inspectModel, buildModel, qaModel, architectureModel        (string)
#   inspectReasoningEffort, buildReasoningEffort, qaReasoningEffort,
#   architectureReasoningEffort, reasoningEffort               (enum: minimal | low | medium | high)
#
# Defaults: codex, gpt-5.5, reasoningEffort=medium.

# Resolve Python the same way the loop scripts do.
if command -v uv &>/dev/null; then
  _AGENT_PY="uv run python3"
else
  _AGENT_PY="python3"
fi

# Read a single key from ulisse-config.json. Falls back to $2 if missing.
_agent_cfg_get() {
  local key="$1" default="$2"
  $_AGENT_PY -c "
import json
try:
    cfg = json.load(open('ulisse-config.json'))
    val = cfg.get('$key')
    print(val if val else '$default')
except Exception:
    print('$default')
" 2>/dev/null || echo "$default"
}

# load_agent_config <phase>
# Sets:
#   ULISSE_AGENT             — codex | claude
#   ULISSE_MODEL             — configured model string for the selected agent
#   ULISSE_REASONING_EFFORT  — minimal | low | medium | high (codex-only)
load_agent_config() {
  local phase="$1"
  local key model_key effort_key
  case "$phase" in
    inspect)      key="inspectAgent"; model_key="inspectModel"; effort_key="inspectReasoningEffort" ;;
    build)        key="buildAgent"; model_key="buildModel"; effort_key="buildReasoningEffort" ;;
    qa)           key="qaAgent"; model_key="qaModel"; effort_key="qaReasoningEffort" ;;
    architecture) key="architectureAgent"; model_key="architectureModel"; effort_key="architectureReasoningEffort" ;;
    *)            key=""; model_key=""; effort_key="" ;;
  esac

  local agent="codex"
  if [ -n "$key" ]; then
    agent=$(_agent_cfg_get "$key" "codex")
  fi
  case "$agent" in
    codex|claude) ;;
    *) agent="codex" ;;
  esac

  local default_model
  if [ "$agent" = "codex" ]; then
    default_model=$(_agent_cfg_get "codexModel" "gpt-5.5")
  else
    default_model=$(_agent_cfg_get "claudeModel" "claude-opus-4.8")
  fi

  local model="$default_model"
  if [ -n "$model_key" ]; then
    model=$(_agent_cfg_get "$model_key" "$default_model")
  fi

  local effort
  effort=$(_agent_cfg_get "reasoningEffort" "medium")
  if [ -n "$effort_key" ]; then
    effort=$(_agent_cfg_get "$effort_key" "$effort")
  fi
  case "$effort" in
    minimal|low|medium|high) ;;
    *) effort="low" ;;
  esac

  export ULISSE_AGENT="$agent"
  export ULISSE_MODEL="$model"
  export ULISSE_REASONING_EFFORT="$effort"
}

# agent_invoke <timeout_seconds> <prompt>
# Runs the configured agent with the given prompt and prints its stdout.
agent_invoke() {
  local timeout_s="$1"
  local prompt="$2"
  local agent="${ULISSE_AGENT:-codex}"
  local model="${ULISSE_MODEL:-}"
  local effort="${ULISSE_REASONING_EFFORT:-low}"

  if [ "$agent" = "codex" ]; then
    if [ -n "$model" ]; then
      timeout "$timeout_s" codex exec --dangerously-bypass-approvals-and-sandbox \
        -m "$model" \
        -c model_reasoning_effort="$effort" \
        "$prompt"
    else
      timeout "$timeout_s" codex exec --dangerously-bypass-approvals-and-sandbox \
        -c model_reasoning_effort="$effort" \
        "$prompt"
    fi
  else
    timeout "$timeout_s" claude -p --dangerously-skip-permissions --model "${model:-claude-opus-4.8}" \
      "$prompt"
  fi
}

# agent_label — short human-readable label like "codex (low)" or "claude".
agent_label() {
  local agent="${ULISSE_AGENT:-codex}"
  local model="${ULISSE_MODEL:-default}"
  if [ "$agent" = "codex" ]; then
    echo "codex model=$model (reasoning_effort=${ULISSE_REASONING_EFFORT:-low})"
  else
    echo "claude model=$model"
  fi
}
