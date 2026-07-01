interface ReportRow {
  date: string;
  metric: string;
  value: number;
}

interface Report {
  title: string;
  rows: ReportRow[];
}

/**
 * renderReportPage — renders the single existing report type (daily metrics) as HTML.
 * There is only one report type in this repo; no exporter abstraction exists yet.
 */
export function renderReportPage(report: Report): string {
  const rows = report.rows
    .map((row) => `<tr><td>${row.date}</td><td>${row.metric}</td><td>${row.value}</td></tr>`)
    .join('\n');

  return `<h1>${report.title}</h1><table>${rows}</table>`;
}
