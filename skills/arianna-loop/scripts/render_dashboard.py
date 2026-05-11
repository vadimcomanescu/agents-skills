#!/usr/bin/env python3
"""Render the arianna-loop dashboard from `.agent/` state.

Reads markdown state files, `tasks.json`, and optional evidence reports
from a `.agent/` directory; substitutes the `{{ var }}` placeholders in
the Birchline `dashboard.html` template; emits a self-contained HTML
file. Hand-codes the task DAG as inline SVG from the `depends_on` edges.

Python 3 stdlib only. No Jinja2, no markdown library, no external deps.
Missing placeholders resolve to empty string (never error). Idempotent
except for the `generated_at` timestamp.

Usage:
  render_dashboard.py [--agent-dir PATH] [--out PATH] [--template PATH]

Defaults:
  --agent-dir   ./.agent
  --out         <agent-dir>/dashboard.html
  --template    skills/arianna-loop/references/templates/dashboard.html
                (located relative to this script's parent)
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Markdown -> HTML (minimal stdlib-only pass)
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(r"^```(\w*)\s*$")


def markdown_to_html(text: str) -> str:
    """Convert a small markdown subset to escaped HTML.

    Handles: ATX headings (#..######), fenced code blocks (```...```),
    unordered list groups (- or *), ordered list groups (1.), blockquotes,
    horizontal rules (---), inline `code`, **bold**, *italic*, [text](url),
    and paragraph wrapping with linebreaks preserved.
    """
    if not text:
        return ""
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    in_code = False
    code_buf: list[str] = []
    code_lang = ""
    while i < len(lines):
        line = lines[i]
        fence = _FENCE_RE.match(line)
        if fence:
            if not in_code:
                in_code = True
                code_lang = fence.group(1) or ""
                code_buf = []
            else:
                lang_attr = f' class="lang-{html.escape(code_lang)}"' if code_lang else ""
                out.append(
                    f"<pre><code{lang_attr}>" + html.escape("\n".join(code_buf)) + "</code></pre>"
                )
                in_code = False
                code_buf = []
                code_lang = ""
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        # Horizontal rule
        if re.match(r"^\s*---\s*$", line):
            out.append("<hr>")
            i += 1
            continue
        # Heading
        h = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if h:
            level = len(h.group(1))
            content = _inline(h.group(2))
            out.append(f"<h{level}>{content}</h{level}>")
            i += 1
            continue
        # Unordered list
        if re.match(r"^\s*[-*+]\s+", line):
            items: list[str] = []
            while i < len(lines) and re.match(r"^\s*[-*+]\s+", lines[i]):
                items.append(_inline(re.sub(r"^\s*[-*+]\s+", "", lines[i])))
                i += 1
            out.append("<ul>" + "".join(f"<li>{it}</li>" for it in items) + "</ul>")
            continue
        # Ordered list
        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                items.append(_inline(re.sub(r"^\s*\d+\.\s+", "", lines[i])))
                i += 1
            out.append("<ol>" + "".join(f"<li>{it}</li>" for it in items) + "</ol>")
            continue
        # Blockquote
        if re.match(r"^\s*>\s?", line):
            quote_lines: list[str] = []
            while i < len(lines) and re.match(r"^\s*>\s?", lines[i]):
                quote_lines.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            inner = _inline(" ".join(quote_lines))
            out.append(f"<blockquote>{inner}</blockquote>")
            continue
        # Blank line — paragraph separator
        if line.strip() == "":
            i += 1
            continue
        # Paragraph: gather until blank / block start
        para: list[str] = [line]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if nxt.strip() == "":
                break
            if _FENCE_RE.match(nxt):
                break
            if re.match(r"^(#{1,6})\s+", nxt):
                break
            if re.match(r"^\s*[-*+]\s+", nxt):
                break
            if re.match(r"^\s*\d+\.\s+", nxt):
                break
            if re.match(r"^\s*>\s?", nxt):
                break
            if re.match(r"^\s*---\s*$", nxt):
                break
            para.append(nxt)
            i += 1
        joined = "<br>".join(_inline(p) for p in para)
        out.append(f"<p>{joined}</p>")
    if in_code:
        # Unterminated fence — flush anyway.
        out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
    return "\n".join(out)


_INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
_BOLD_RE = re.compile(r"\*\*([^*\n]+)\*\*")
_ITALIC_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
_LINK_RE = re.compile(r"\[([^\]\n]+)\]\(([^)\s]+)\)")


def _inline(text: str) -> str:
    """Escape and apply inline markdown to a single line."""
    placeholders: list[str] = []

    def _stash_code(m: "re.Match[str]") -> str:
        placeholders.append(m.group(1))
        return f"\x00CODE{len(placeholders) - 1}\x00"

    def _stash_link(m: "re.Match[str]") -> str:
        placeholders.append((m.group(1), m.group(2)))  # type: ignore[arg-type]
        return f"\x00LINK{len(placeholders) - 1}\x00"

    work = _INLINE_CODE_RE.sub(_stash_code, text)
    work = _LINK_RE.sub(_stash_link, work)
    work = html.escape(work, quote=False)
    work = _BOLD_RE.sub(r"<strong>\1</strong>", work)
    work = _ITALIC_RE.sub(r"<em>\1</em>", work)

    def _restore(m: "re.Match[str]") -> str:
        kind = m.group(1)
        idx = int(m.group(2))
        val = placeholders[idx]
        if kind == "CODE":
            return f"<code>{html.escape(val)}</code>"  # type: ignore[arg-type]
        text_, url_ = val  # type: ignore[misc]
        return f'<a href="{html.escape(url_)}">{html.escape(text_)}</a>'

    work = re.sub(r"\x00(CODE|LINK)(\d+)\x00", _restore, work)
    return work


# ---------------------------------------------------------------------------
# DAG SVG generation
# ---------------------------------------------------------------------------

STATUS_CLASS = {
    "done": "ok",
    "passed": "ok",
    "in_progress": "active",
    "in-progress": "active",
    "blocked": "bad",
    "failed": "bad",
    "pending": "",
}


def _topo_levels(tasks: list[dict]) -> dict[str, int]:
    """Assign each task a depth (longest path from a root via depends_on)."""
    by_id = {t["id"]: t for t in tasks}
    depth: dict[str, int] = {}

    def _depth_of(tid: str, stack: set) -> int:
        if tid in depth:
            return depth[tid]
        if tid in stack:
            # Cycle — break it by treating as root.
            return 0
        t = by_id.get(tid)
        deps = [d for d in (t.get("depends_on") or []) if d in by_id] if t else []
        if not deps:
            d = 0
        else:
            d = 1 + max(_depth_of(p, stack | {tid}) for p in deps)
        depth[tid] = d
        return d

    for t in tasks:
        _depth_of(t["id"], set())
    return depth


def render_dag_svg(tasks_data: dict | None) -> str:
    """Hand-code an inline SVG for the task DAG from tasks.json content."""
    if not tasks_data:
        return _empty_dag()
    tasks = tasks_data.get("tasks") or []
    if not tasks:
        return _empty_dag()

    depth = _topo_levels(tasks)
    # Group by depth level for left-to-right layout.
    levels: dict[int, list[dict]] = {}
    for t in tasks:
        levels.setdefault(depth[t["id"]], []).append(t)

    # Layout constants.
    col_w = 220
    row_h = 90
    margin_x = 40
    margin_y = 40
    node_w = 168
    node_h = 56
    max_rows = max((len(v) for v in levels.values()), default=1)
    width = margin_x * 2 + col_w * (max(levels.keys(), default=0) + 1)
    height = margin_y * 2 + row_h * max(max_rows, 1)

    # Compute each node centre.
    positions: dict[str, tuple[float, float]] = {}
    for lvl, items in levels.items():
        # Centre items vertically inside the column.
        slack = (max_rows - len(items)) / 2.0
        for row, t in enumerate(items):
            cx = margin_x + lvl * col_w + node_w / 2
            cy = margin_y + (row + slack) * row_h + node_h / 2
            positions[t["id"]] = (cx, cy)

    # Render edges first (under nodes).
    edge_svg: list[str] = []
    for t in tasks:
        for dep in (t.get("depends_on") or []):
            if dep not in positions:
                continue
            src = positions[dep]
            dst = positions[t["id"]]
            edge_cls = _edge_class(t.get("status"))
            x1 = src[0] + node_w / 2
            y1 = src[1]
            x2 = dst[0] - node_w / 2
            y2 = dst[1]
            # Cubic bezier for a calm curve.
            mid = (x1 + x2) / 2
            path = f"M{x1:.1f},{y1:.1f} C{mid:.1f},{y1:.1f} {mid:.1f},{y2:.1f} {x2:.1f},{y2:.1f}"
            edge_svg.append(f'<path class="edge{edge_cls}" d="{path}"/>')

    # Render nodes.
    node_svg: list[str] = []
    for t in tasks:
        cx, cy = positions[t["id"]]
        x = cx - node_w / 2
        y = cy - node_h / 2
        status_cls = STATUS_CLASS.get(str(t.get("status", "")).lower(), "")
        is_gate = str(t.get("category", "")).lower() == "gate"
        node_cls = "node"
        if is_gate:
            node_cls += " gate"
        if status_cls:
            node_cls += " " + status_cls
        tid = html.escape(str(t.get("id", "")))
        title = html.escape(str(t.get("title", t.get("id", ""))))
        # Truncate long titles for the box.
        title_disp = title if len(title) <= 28 else title[:25] + "..."
        meta_bits: list[str] = []
        if t.get("built_by"):
            meta_bits.append(str(t["built_by"]))
        if t.get("status"):
            meta_bits.append(str(t["status"]))
        meta = html.escape(" · ".join(meta_bits)) if meta_bits else ""
        if is_gate:
            # Diamond: same centre, points at compass directions.
            half_w = node_w / 2
            half_h = node_h / 2 + 6
            pts = (
                f"M{cx:.1f},{cy - half_h:.1f} "
                f"L{cx + half_w:.1f},{cy:.1f} "
                f"L{cx:.1f},{cy + half_h:.1f} "
                f"L{cx - half_w:.1f},{cy:.1f} Z"
            )
            node_svg.append(
                f'<g class="{node_cls}" data-task="{tid}">'
                f'<path d="{pts}"/>'
                f'<text x="{cx:.1f}" y="{cy - 4:.1f}" text-anchor="middle">{title_disp}</text>'
                f'<text class="sub" x="{cx:.1f}" y="{cy + 12:.1f}" text-anchor="middle">{meta}</text>'
                f"</g>"
            )
        else:
            node_svg.append(
                f'<g class="{node_cls}" data-task="{tid}">'
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{node_w}" height="{node_h}"/>'
                f'<text x="{cx:.1f}" y="{cy - 4:.1f}" text-anchor="middle">{title_disp}</text>'
                f'<text class="sub" x="{cx:.1f}" y="{cy + 14:.1f}" text-anchor="middle">{meta}</text>'
                f"</g>"
            )

    defs = (
        '<defs>'
        '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        '<path d="M0,0 L10,5 L0,10 z" fill="#87867F"/>'
        '</marker>'
        '<marker id="arrow-olive" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        '<path d="M0,0 L10,5 L0,10 z" fill="#788C5D"/>'
        '</marker>'
        '<marker id="arrow-rust" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        '<path d="M0,0 L10,5 L0,10 z" fill="#B04A4A"/>'
        '</marker>'
        '</defs>'
    )
    return (
        f'<svg class="flow" viewBox="0 0 {width:.0f} {height:.0f}" '
        f'preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        f"{defs}"
        + "".join(edge_svg)
        + "".join(node_svg)
        + "</svg>"
    )


def _edge_class(status: object) -> str:
    s = str(status or "").lower()
    if s in {"done", "passed"}:
        return " yes"
    if s in {"blocked", "failed"}:
        return " no"
    return ""


def _empty_dag() -> str:
    return (
        '<svg class="flow" viewBox="0 0 600 120" preserveAspectRatio="xMidYMid meet" '
        'xmlns="http://www.w3.org/2000/svg">'
        '<text x="300" y="68" text-anchor="middle" class="lbl">(no tasks yet)</text>'
        '</svg>'
    )


# ---------------------------------------------------------------------------
# Phase status and gate HTML
# ---------------------------------------------------------------------------

PHASE_FILES = {
    "0": "research.md",
    "1": "goal.md",
    "2": "spec.md",
    "3": "design/screens.html",
    "4": "tasks.json",
}


def _phase_status(agent_dir: Path, phase_key: str, current_phase_idx: int) -> tuple[str, str]:
    """Return (status_class, metric_text) for a phase.

    status_class is one of: done, current, blocked, pending. metric_text
    is a short serif-44 string ("OK", "—", "5", etc.).
    """
    phase_idx = 56 if phase_key == "56" else int(phase_key)
    rel = PHASE_FILES.get(phase_key)
    exists = bool(rel) and (agent_dir / rel).exists()
    if phase_key == "56":
        tasks_path = agent_dir / "tasks.json"
        if tasks_path.exists():
            try:
                data = json.loads(tasks_path.read_text())
                tasks = data.get("tasks") or []
                done = sum(1 for t in tasks if str(t.get("status", "")).lower() == "done")
                if tasks and done == len(tasks):
                    return "done", f"{done}/{len(tasks)}"
                if tasks:
                    return "current" if phase_idx == current_phase_idx else "pending", f"{done}/{len(tasks)}"
            except (ValueError, OSError):
                pass
        return "pending", "—"
    if exists:
        return ("current", "OK") if phase_idx == current_phase_idx else ("done", "OK")
    if phase_idx == current_phase_idx:
        return "current", "…"
    return "pending", "—"


def _phase_delta(status_class: str) -> tuple[str, str]:
    """Return (delta_class, delta_text)."""
    if status_class == "done":
        return "up", "complete"
    if status_class == "current":
        return "flat", "in progress"
    if status_class == "blocked":
        return "bad", "blocked"
    return "flat", "pending"


def _gate_html(phase_label: str, status_class: str) -> str:
    """Render the decision-button row for a gate phase."""
    if status_class in {"done"}:
        return (
            '<div class="decision-row">'
            f'<span class="risk-pill pass"><span class="dot"></span>{html.escape(phase_label)} approved</span>'
            '</div>'
        )
    if status_class == "current":
        return (
            '<div class="decision-row">'
            f'<button class="decision approve" onclick="saveDecision(\'{phase_label}\',\'approve\',this)">Approve</button>'
            f'<button class="decision revise" onclick="saveDecision(\'{phase_label}\',\'revise\',this)">Revise</button>'
            '</div>'
            '<div class="decision-hint">Saves <code>'
            f'{html.escape(phase_label)}.decision.json</code>; move to <code>.agent/gates/</code>.</div>'
        )
    return (
        '<div class="decision-hint">Gate not yet reachable. Earlier phases must complete first.</div>'
    )


# ---------------------------------------------------------------------------
# State loading and full context assembly
# ---------------------------------------------------------------------------


def _read_md(agent_dir: Path, name: str, phase_label: str) -> str:
    p = agent_dir / name
    if not p.exists():
        return f'<p class="empty muted">No {html.escape(phase_label)} yet.</p>'
    try:
        text = p.read_text(encoding="utf-8")
    except OSError as e:
        return f'<p class="empty muted">Could not read {html.escape(name)}: {html.escape(str(e))}</p>'
    return markdown_to_html(text)


def _load_tasks(agent_dir: Path) -> dict | None:
    p = agent_dir / "tasks.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None


def _detect_current_phase(agent_dir: Path) -> tuple[str, int]:
    """Heuristic: the lowest-numbered phase whose state file is missing.

    Returns ('research'|'goal'|'spec'|'design'|'plan'|'build', idx).
    """
    order = [
        ("research", 0, "research.md"),
        ("goal", 1, "goal.md"),
        ("spec", 2, "spec.md"),
        ("design", 3, "design/screens.html"),
        ("plan", 4, "tasks.json"),
    ]
    for name, idx, rel in order:
        if not (agent_dir / rel).exists():
            return name, idx
    # All five exist — we're in autonomous build/review.
    return "build", 56


def _project_meta(agent_dir: Path) -> tuple[str, str, str]:
    """Pull (title, intent_class, lead) from goal.md if present."""
    title = agent_dir.parent.name or "project"
    intent = "—"
    lead = "Long-running build pipeline state."
    goal = agent_dir / "goal.md"
    if goal.exists():
        try:
            text = goal.read_text(encoding="utf-8")
        except OSError:
            text = ""
        m = re.search(r"^#\s+(.+?)\s*$", text, re.MULTILINE)
        if m:
            title_line = m.group(1).strip()
            # Strip "Project Goal:" prefix if present.
            title_line = re.sub(r"^(?:project\s+goal\s*:\s*)", "", title_line, flags=re.IGNORECASE)
            title = title_line or title
        # First paragraph after "Problem Statement" or first non-empty para as lead.
        ps = re.search(r"(?ims)^##\s+problem statement\s*\n+(.+?)(?:\n##|\Z)", text)
        if ps:
            first_para = ps.group(1).strip().split("\n\n", 1)[0]
            # Strip markdown formatting for the lead.
            first_para = re.sub(r"[*_`]", "", first_para)
            lead = first_para.strip()[:320]
    classify_path = agent_dir / "intent.json"
    if classify_path.exists():
        try:
            intent = json.loads(classify_path.read_text(encoding="utf-8")).get("class") or intent
        except (ValueError, OSError):
            pass
    return title, intent, lead


def _evidence_wall(agent_dir: Path) -> str:
    """Collect evidence reports as .mock cards."""
    ev = agent_dir / "evidence"
    if not ev.is_dir():
        return '<p class="empty muted">No evidence yet.</p>'
    cards: list[str] = []
    for sub in sorted(p for p in ev.iterdir() if p.is_dir()):
        report = sub / "report.md"
        if not report.exists():
            continue
        try:
            body = report.read_text(encoding="utf-8")
        except OSError:
            continue
        body_html = markdown_to_html(body)
        cards.append(
            '<div class="mock">'
            f'<div class="mock-label">{html.escape(sub.name)} · evidence</div>'
            f'<div class="mock-body">{body_html}</div>'
            '</div>'
        )
    if not cards:
        return '<p class="empty muted">No evidence yet.</p>'
    return "".join(cards)


def _review_reports(agent_dir: Path) -> str:
    """Collect review-log entries into .review-card sections."""
    ev = agent_dir / "evidence"
    if not ev.is_dir():
        return '<p class="empty muted">No review reports yet.</p>'
    cards: list[str] = []
    n = 0
    for sub in sorted(p for p in ev.iterdir() if p.is_dir()):
        log = sub / "review-log.json"
        if not log.exists():
            continue
        try:
            entries = json.loads(log.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(entries, list):
            entries = [entries]
        for entry in entries:
            n += 1
            status = str(entry.get("status", "")).lower()
            pill_cls = (
                "pass" if status == "pass" else "fail" if status == "fail" else "warn"
            )
            verdict = html.escape(str(entry.get("verdict", "")))
            reasoning = html.escape(str(entry.get("verdict_reasoning", "")))
            stage = html.escape(str(entry.get("stage", "")))
            cards.append(
                '<div class="review-card">'
                f'<span class="num">{n:02d}</span>'
                f'<h3>{html.escape(sub.name)} — {stage}</h3>'
                f'<p class="review-lead">{reasoning}</p>'
                f'<span class="risk-pill {pill_cls}"><span class="dot"></span>{verdict or status}</span>'
                "</div>"
            )
    if not cards:
        return '<p class="empty muted">No review reports yet.</p>'
    return "".join(cards)


def _current_task(tasks_data: dict | None) -> tuple[str, str, str]:
    """Pick a task to highlight in the sticky aside."""
    if not tasks_data:
        return "No active task", "tasks.json missing", "Plan phase has not produced tasks yet."
    tasks = tasks_data.get("tasks") or []
    in_progress = [t for t in tasks if str(t.get("status", "")).lower() in {"in_progress", "in-progress"}]
    blocked = [t for t in tasks if str(t.get("status", "")).lower() == "blocked"]
    pending = [t for t in tasks if str(t.get("status", "")).lower() == "pending"]
    pick = (in_progress or blocked or pending or tasks)[0] if tasks else None
    if not pick:
        return "No active task", "all complete", "Every task in tasks.json has status=done."
    title = str(pick.get("title", pick.get("id", "task")))
    meta_bits = [
        str(pick.get("id", "")),
        str(pick.get("status", "")),
        str(pick.get("built_by", "")),
    ]
    meta = " · ".join(b for b in meta_bits if b)
    body = str(pick.get("acceptance") or pick.get("description") or "")
    return title, meta, body


# ---------------------------------------------------------------------------
# Template interpolation
# ---------------------------------------------------------------------------

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def interpolate(template: str, context: dict) -> str:
    """Replace `{{ var }}` with `context[var]`; missing keys become ''."""

    def _sub(m: "re.Match[str]") -> str:
        key = m.group(1)
        val = context.get(key, "")
        return "" if val is None else str(val)

    return _PLACEHOLDER_RE.sub(_sub, template)


def build_context(agent_dir: Path) -> dict:
    title, intent, lead = _project_meta(agent_dir)
    current_phase, current_idx = _detect_current_phase(agent_dir)
    tasks_data = _load_tasks(agent_dir)

    ctx: dict[str, str] = {
        "project_title": html.escape(title),
        "intent_class": html.escape(intent),
        "project_lead": html.escape(lead),
        "current_phase": html.escape(current_phase),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "research_html": _read_md(agent_dir, "research.md", "research"),
        "goal_html": _read_md(agent_dir, "goal.md", "goal"),
        "spec_html": _read_md(agent_dir, "spec.md", "spec"),
        "plan_html": _read_md(agent_dir, "plans.md", "plan"),
        "build_summary_html": _read_md(agent_dir, "progress.md", "build progress"),
        "design_summary_html": _read_md(agent_dir, "design.md", "design"),
        "design_stage_html": '<div class="muted" style="padding:24px">Design prototype renders into screens.html when Phase 3 runs.</div>',
        "design_dialkit_html": '<div class="muted">Controls appear once design tokens are emitted.</div>',
        "design_prototype_html": '<div class="muted" style="padding:24px">Open <code>design/screens.html</code> for the full prototype.</div>',
        "design_prototype_dialkit_html": '<div class="muted">DialKit appears once <code>design/tokens.css</code> exists.</div>',
        "task_dag_svg": render_dag_svg(tasks_data),
        "evidence_wall_html": _evidence_wall(agent_dir),
        "review_reports_html": _review_reports(agent_dir),
    }

    cur_title, cur_meta, cur_body = _current_task(tasks_data)
    ctx["current_task_title"] = html.escape(cur_title)
    ctx["current_task_meta"] = html.escape(cur_meta)
    ctx["current_task_body"] = html.escape(cur_body)

    # Phase strip status/metric/delta/gate.
    phase_labels = {
        "0": "phase0",
        "1": "phase1",
        "2": "phase2",
        "3": "phase3",
        "4": "phase4",
        "56": "phase56",
    }
    for key, prefix in phase_labels.items():
        status_cls, metric = _phase_status(agent_dir, key, current_idx)
        delta_cls, delta_text = _phase_delta(status_cls)
        ctx[f"{prefix}_status"] = status_cls
        ctx[f"{prefix}_metric"] = html.escape(metric)
        ctx[f"{prefix}_delta_class"] = delta_cls
        ctx[f"{prefix}_delta"] = html.escape(delta_text)
        if key != "56":
            ctx[f"{prefix}_gate_html"] = _gate_html(prefix, status_cls)

    return ctx


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _default_template(script_path: Path) -> Path:
    """Locate the template relative to this script."""
    # scripts/render_dashboard.py -> ../references/templates/dashboard.html
    return script_path.resolve().parent.parent / "references" / "templates" / "dashboard.html"


def render(agent_dir: Path, template_path: Path) -> str:
    """Read the template, build context from agent_dir, return the HTML."""
    template = template_path.read_text(encoding="utf-8")
    context = build_context(agent_dir)
    return interpolate(template, context)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="render_dashboard.py",
        description="Render the arianna-loop Birchline dashboard from .agent/ state.",
    )
    parser.add_argument(
        "--agent-dir",
        type=Path,
        default=Path(".agent"),
        help="Directory holding the state files (default: ./.agent)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output HTML path (default: <agent-dir>/dashboard.html)",
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=None,
        help="Template path (default: located relative to this script)",
    )
    args = parser.parse_args(argv)

    agent_dir = args.agent_dir
    if not agent_dir.is_dir():
        print(f"render_dashboard: {agent_dir} is not a directory", file=sys.stderr)
        return 1
    template_path = args.template or _default_template(Path(__file__))
    if not template_path.exists():
        print(f"render_dashboard: template not found: {template_path}", file=sys.stderr)
        return 1
    out_path = args.out or (agent_dir / "dashboard.html")

    html_text = render(agent_dir, template_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html_text, encoding="utf-8")
    print(str(out_path))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
