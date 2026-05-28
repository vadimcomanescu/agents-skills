#!/usr/bin/env python3
"""Render a static Shepherd verification evidence dossier."""

from __future__ import annotations

import argparse
import html
from pathlib import Path

from shepherd_verification import extract_paths, parse_verification_table


CSS = """
:root { --canvas:#ffffff; --ink:#171717; --body:#4d4d4d; --muted:#888888; --hairline:#ebebeb; --green:#007a5e; --magenta:#ff0080; --warning:#f5a623; --error:#b80022; }
* { box-sizing:border-box; }
body { margin:0; background:var(--canvas); color:var(--ink); font-family:Inter, Geist, Arial, sans-serif; line-height:1.45; }
main { max-width:1392px; margin:0 auto; padding:32px 24px 64px; }
header { border-bottom:1px solid var(--hairline); padding-bottom:24px; margin-bottom:24px; }
h1 { margin:0 0 8px; font-size:clamp(32px,4vw,58px); line-height:1; letter-spacing:0; }
h2 { margin:32px 0 12px; font-size:24px; }
.summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.metric, .card { border:1px solid var(--hairline); border-radius:8px; padding:16px; background:#fff; }
.metric strong { display:block; font-size:28px; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { border-bottom:1px solid var(--hairline); padding:10px; vertical-align:top; text-align:left; }
.pass { color:var(--green); font-weight:700; }
.fail { color:var(--error); font-weight:700; }
.pending { color:var(--warning); font-weight:700; }
.waived { color:var(--magenta); font-weight:700; }
.gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.artifact { overflow-wrap:anywhere; color:var(--body); }
img { max-width:100%; border:1px solid var(--hairline); border-radius:8px; }
@media (max-width:900px) { .summary { grid-template-columns:1fr 1fr; } main { padding:20px 14px 48px; } }
"""


def status_class(verdict: str) -> str:
    lowered = verdict.lower()
    if lowered in {"pass", "passed"}:
        return "pass"
    if lowered in {"fail", "failed"}:
        return "fail"
    if lowered == "waived":
        return "waived"
    return "pending"


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a static Shepherd evidence dossier.")
    parser.add_argument("--verification", type=Path, required=True, help="Path to .shepherd/verification.md")
    parser.add_argument("--out", type=Path, required=True, help="Output HTML path")
    parser.add_argument("--title", default="Shepherd Verification Evidence Dossier")
    parser.add_argument("--baseline", type=Path, help="Optional baseline report")
    parser.add_argument("--real-repo", type=Path, help="Optional real-repo report")
    args = parser.parse_args()

    _, rows = parse_verification_table(args.verification)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    counts = {"pass": 0, "fail": 0, "pending": 0, "waived": 0}
    for row in rows:
        counts[status_class(row.values.get("QA result", ""))] += 1

    table_rows = []
    gallery = []
    for row in rows:
        qa_result = row.values.get("QA result", "")
        css_class = status_class(qa_result)
        paths = extract_paths(row.evidence)
        links = []
        for path in paths:
            links.append(f"<a href='{html.escape(path)}'>{html.escape(path)}</a>")
            if Path(path).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                gallery.append(
                    f"<figure class='card'><img src='{html.escape(path)}' alt='{html.escape(row.ac_id)} evidence'><figcaption>{html.escape(row.ac_id)}: {html.escape(path)}</figcaption></figure>"
                )
        table_rows.append(
            "<tr>"
            f"<td><strong>{html.escape(row.ac_id)}</strong></td>"
            f"<td>{html.escape(row.values.get('Proof modality', ''))}</td>"
            f"<td>{html.escape(row.values.get('Required artifacts', ''))}</td>"
            f"<td>{html.escape(row.values.get('Milestone', ''))}</td>"
            f"<td>{'<br>'.join(links) if links else html.escape(row.evidence)}</td>"
            f"<td>{html.escape(row.verified_revision)}</td>"
            f"<td>{html.escape(row.values.get('Evidence state', ''))}</td>"
            f"<td>{html.escape(row.waiver)}</td>"
            f"<td class='{css_class}'>{html.escape(qa_result)}</td>"
            "</tr>"
        )

    baseline = args.baseline.read_text(encoding="utf-8") if args.baseline and args.baseline.exists() else "No baseline report attached yet."
    real_repo = args.real_repo.read_text(encoding="utf-8") if args.real_repo and args.real_repo.exists() else "No real-repo report attached yet."

    page = f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(args.title)}</title><style>{CSS}</style></head>
<body><main>
<header><p>Shepherd verification evidence</p><h1>{html.escape(args.title)}</h1><p>Per-AC QA results, artifact links, evidence state, waivers, baseline comparison, and real-repo evidence.</p></header>
<section class="summary">
<div class="metric"><span>Passed</span><strong>{counts['pass']}</strong></div>
<div class="metric"><span>Failed</span><strong>{counts['fail']}</strong></div>
<div class="metric"><span>Pending</span><strong>{counts['pending']}</strong></div>
<div class="metric"><span>Waived</span><strong>{counts['waived']}</strong></div>
</section>
<section><h2>Verification Matrix</h2><table><thead><tr><th>AC</th><th>Proof modality</th><th>Required artifact</th><th>Milestone</th><th>Evidence</th><th>Verified revision</th><th>Evidence state</th><th>Waiver</th><th>QA result</th></tr></thead><tbody>{''.join(table_rows)}</tbody></table></section>
<section><h2>Screenshot Evidence</h2><div class="gallery">{''.join(gallery) if gallery else '<div class="card">No screenshots attached yet.</div>'}</div></section>
<section class="card"><h2>Baseline Comparison</h2><pre>{html.escape(baseline)}</pre></section>
<section class="card"><h2>Real-Repo Runs</h2><pre>{html.escape(real_repo)}</pre></section>
</main></body></html>
"""
    args.out.write_text(page, encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
