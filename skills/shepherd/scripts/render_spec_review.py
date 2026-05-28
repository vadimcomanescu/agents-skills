#!/usr/bin/env python3
"""Render a static Shepherd spec review workbench."""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

from shepherd_verification import parse_verification_table


CSS = """
:root {
  --canvas: #ffffff;
  --ink: #171717;
  --body: #4d4d4d;
  --muted: #888888;
  --hairline: #ebebeb;
  --green: #007a5e;
  --magenta: #ff0080;
  --warning: #f5a623;
  --error: #b80022;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--canvas); color: var(--ink); font-family: Inter, Geist, Arial, sans-serif; line-height: 1.5; }
main { max-width: 1392px; margin: 0 auto; padding: 32px 24px 64px; }
header { border-bottom: 1px solid var(--hairline); padding-bottom: 24px; margin-bottom: 24px; }
h1 { margin: 0 0 8px; font-size: clamp(30px, 4vw, 56px); line-height: 1; letter-spacing: 0; }
h2 { margin: 32px 0 12px; font-size: 22px; }
h3 { margin: 18px 0 8px; font-size: 16px; }
p, li { color: var(--body); }
.grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 24px; align-items: start; }
.panel { border: 1px solid var(--hairline); border-radius: 8px; padding: 18px; background: #fff; }
.spec { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; color: var(--body); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border-bottom: 1px solid var(--hairline); padding: 10px; vertical-align: top; text-align: left; }
th { color: var(--ink); font-weight: 700; }
.pill { display: inline-block; border: 1px solid var(--hairline); border-radius: 999px; padding: 2px 8px; font-size: 12px; color: var(--body); }
.pending { color: var(--warning); }
.pass { color: var(--green); }
.fail { color: var(--error); }
.review { border-left: 3px solid var(--magenta); padding-left: 10px; }
.control { display: grid; gap: 8px; margin: 12px 0; }
textarea, select, input { width: 100%; border: 1px solid var(--hairline); border-radius: 8px; padding: 10px; font: inherit; }
button { border: 1px solid var(--ink); background: var(--ink); color: #fff; border-radius: 8px; padding: 10px 14px; font: inherit; cursor: pointer; }
button.secondary { background: #fff; color: var(--ink); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.feedback { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; border: 1px solid var(--hairline); border-radius: 8px; padding: 12px; min-height: 120px; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } main { padding: 20px 14px 48px; } }
"""


def render_markdown_summary(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"^# (.*)$", r"<h1>\1</h1>", escaped, flags=re.MULTILINE)
    escaped = re.sub(r"^## (.*)$", r"<h2>\1</h2>", escaped, flags=re.MULTILINE)
    escaped = re.sub(r"^### (.*)$", r"<h3>\1</h3>", escaped, flags=re.MULTILINE)
    return escaped


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a static full-spec Shepherd review workbench.")
    parser.add_argument("--spec", type=Path, required=True, help="Path to .shepherd/spec.md")
    parser.add_argument("--verification", type=Path, required=True, help="Path to .shepherd/verification.md")
    parser.add_argument("--out", type=Path, required=True, help="Output HTML path")
    parser.add_argument("--title", default="Shepherd Spec Review", help="Document title")
    args = parser.parse_args()

    spec_text = args.spec.read_text(encoding="utf-8")
    _, rows = parse_verification_table(args.verification)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    ac_rows = "\n".join(
        "<tr>"
        f"<td><strong>{html.escape(row.ac_id)}</strong></td>"
        f"<td><span class='pill'>{html.escape(row.values.get('Proof modality', ''))}</span></td>"
        f"<td>{html.escape(row.values.get('Required artifacts', ''))}</td>"
        f"<td>{html.escape(row.values.get('Milestone', ''))}</td>"
        f"<td class='{html.escape(row.qa_result)}'>{html.escape(row.values.get('QA result', ''))}</td>"
        f"<td>{html.escape(row.values.get('Evidence', ''))}</td>"
        "</tr>"
        for row in rows
    )

    feedback_seed = {
        "document": str(args.out),
        "comments": [],
        "decisions": [],
    }
    ac_options = "\n".join(f"<option value='{html.escape(row.ac_id)}'>{html.escape(row.ac_id)}</option>" for row in rows)

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(args.title)}</title>
<style>{CSS}</style>
</head>
<body>
<main>
<header>
<p class="pill">Shepherd spec review</p>
<h1>{html.escape(args.title)}</h1>
<p>Full spec, AC proof requirements, verification plan, and local human feedback export.</p>
</header>
<section class="grid">
<article class="panel">
<h2>Whole Spec</h2>
<div class="spec">{render_markdown_summary(spec_text)}</div>
</article>
<aside class="panel">
<h2>Review Workbench</h2>
<div class="control">
<label for="target">Target</label>
<select id="target">{ac_options}<option value="spec">Whole spec</option></select>
</div>
<div class="control">
<label for="decision">Decision</label>
<select id="decision"><option value="comment">Comment</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
</div>
<div class="control">
<label for="comment">Comment</label>
<textarea id="comment" rows="5" placeholder="Write feedback for this AC or section"></textarea>
</div>
<div class="actions">
<button type="button" onclick="addFeedback()">Add feedback</button>
<button type="button" class="secondary" onclick="downloadFeedback()">Export JSON</button>
</div>
<h3>Feedback JSON</h3>
<div id="feedback" class="feedback">{html.escape(json.dumps(feedback_seed, indent=2))}</div>
</aside>
</section>
<section class="panel" style="margin-top:24px">
<h2>Verification Plan</h2>
<table>
<thead><tr><th>AC</th><th>Proof modality</th><th>Required artifacts</th><th>Milestone</th><th>QA result</th><th>Evidence</th></tr></thead>
<tbody>{ac_rows}</tbody>
</table>
</section>
</main>
<script>
const feedback = {json.dumps(feedback_seed)};
function renderFeedback() {{
  document.getElementById('feedback').textContent = JSON.stringify(feedback, null, 2);
}}
function addFeedback() {{
  const target = document.getElementById('target').value;
  const decision = document.getElementById('decision').value;
  const comment = document.getElementById('comment').value.trim();
  const item = {{ target, decision, comment, createdAt: new Date().toISOString() }};
  if (decision === 'comment') feedback.comments.push(item);
  else feedback.decisions.push(item);
  document.getElementById('comment').value = '';
  renderFeedback();
}}
function downloadFeedback() {{
  const blob = new Blob([JSON.stringify(feedback, null, 2)], {{ type: 'application/json' }});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'feedback.json';
  anchor.click();
  URL.revokeObjectURL(url);
}}
renderFeedback();
</script>
</body>
</html>
"""
    args.out.write_text(page, encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
