const fs = require("fs/promises");
const path = require("path");

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {string} severity
 */
function severityClass(severity) {
  const key = String(severity || "minor").toLowerCase();
  if (key === "critical") return "severity-critical";
  if (key === "major") return "severity-major";
  return "severity-minor";
}

/**
 * @param {unknown} data
 */
function formatJsonBlock(data) {
  return escapeHtml(JSON.stringify(data, null, 2));
}

/**
 * @param {string} fromDir
 * @param {string} targetPath
 */
function relativeAssetPath(fromDir, targetPath) {
  const absolute = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(process.cwd(), targetPath);
  return path
    .relative(fromDir, absolute)
    .split(path.sep)
    .join("/");
}

/**
 * @param {import('./openai-ui-analysis').UiAnalysisResult} analysis
 * @param {{
 *   testFile: string;
 *   testTitle?: string;
 *   steps: import('./openai-ui-analysis').StepCapture[];
 *   generatedAt?: string;
 *   model?: string;
 *   htmlOutputPath: string;
 *   indexOutputPath: string;
 * }} context
 */
function buildAnalysisHtml(analysis, context) {
  const generatedAt = context.generatedAt || new Date().toISOString();
  const testName = path.basename(context.testFile, path.extname(context.testFile));
  const htmlDir = path.dirname(context.htmlOutputPath);
  const indexHref = relativeAssetPath(htmlDir, context.indexOutputPath);

  const issues = analysis.uiIssues || [];
  const enhancements = analysis.enhancements || [];
  const flow = [...(analysis.recommendedFlow || [])].sort(
    (a, b) => a.order - b.order,
  );

  const issueCounts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    major: issues.filter((i) => i.severity === "major").length,
    minor: issues.filter((i) => i.severity === "minor").length,
  };

  const stepCards = context.steps
    .map((step) => {
      const imageSrc = relativeAssetPath(htmlDir, step.screenshotPath);
      const stepIssues = issues.filter((i) => i.step === step.stepName);
      const stepEnhancements = enhancements.filter((e) => e.step === step.stepName);
      const pageData = step.pageData || {};

      const lists = [
        { label: "Headings", items: pageData.headings },
        { label: "Buttons", items: pageData.buttons },
        { label: "Links", items: pageData.links },
        { label: "Alerts", items: pageData.alerts },
      ]
        .filter((group) => Array.isArray(group.items) && group.items.length)
        .map(
          (group) => `
            <div class="data-group">
              <h4>${escapeHtml(group.label)}</h4>
              <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </div>`,
        )
        .join("");

      const inputs =
        Array.isArray(pageData.inputs) && pageData.inputs.length
          ? `<div class="data-group">
              <h4>Inputs</h4>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Label / Placeholder</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageData.inputs
                      .map(
                        (input) => `
                      <tr>
                        <td>${escapeHtml(input.tag)}</td>
                        <td>${escapeHtml(input.type || "—")}</td>
                        <td>${escapeHtml(input.name || "—")}</td>
                        <td>${escapeHtml(input.ariaLabel || input.placeholder || "—")}</td>
                        <td>${escapeHtml(input.value || "—")}</td>
                      </tr>`,
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            </div>`
          : "";

      return `
        <article class="step-card" id="step-${step.stepIndex}">
          <div class="step-header">
            <div class="step-badge">${step.stepIndex}</div>
            <div>
              <h3>${escapeHtml(step.stepName)}</h3>
              <p class="meta-line">
                <span>${escapeHtml(step.title || "Untitled page")}</span>
                <a href="${escapeHtml(step.url)}" target="_blank" rel="noopener">${escapeHtml(step.url)}</a>
              </p>
            </div>
          </div>
          <div class="step-grid">
            <div class="screenshot-panel">
              <a href="${escapeHtml(imageSrc)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(imageSrc)}" alt="Screenshot for ${escapeHtml(step.stepName)}" loading="lazy" />
              </a>
              <p class="caption">Click to open full screenshot</p>
            </div>
            <div class="step-details">
              ${lists}
              ${inputs}
              ${
                pageData.mainText
                  ? `<div class="data-group">
                      <h4>Visible text excerpt</h4>
                      <p class="excerpt">${escapeHtml(pageData.mainText)}</p>
                    </div>`
                  : ""
              }
              ${
                stepIssues.length
                  ? `<div class="inline-issues">
                      <h4>Issues for this step</h4>
                      ${stepIssues
                        .map(
                          (issue) => `
                        <div class="issue-chip ${severityClass(issue.severity)}">
                          <strong>${escapeHtml(issue.severity)}</strong>
                          <span>${escapeHtml(issue.issue)}</span>
                          <em>${escapeHtml(issue.suggestion)}</em>
                        </div>`,
                        )
                        .join("")}
                    </div>`
                  : ""
              }
              ${
                stepEnhancements.length
                  ? `<div class="inline-enhancements">
                      <h4>Enhancements for this step</h4>
                      ${stepEnhancements
                        .map(
                          (item) => `
                        <div class="enhancement-chip">
                          <span>${escapeHtml(item.enhancement)}</span>
                          <em>${escapeHtml(item.rationale)}</em>
                        </div>`,
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </div>
          </div>
        </article>`;
    })
    .join("");

  const issuesHtml = issues.length
    ? issues
        .map(
          (issue) => `
        <div class="issue-row ${severityClass(issue.severity)}">
          <div class="issue-severity">${escapeHtml(issue.severity)}</div>
          <div class="issue-body">
            <div class="issue-step">${escapeHtml(issue.step)}</div>
            <p class="issue-text">${escapeHtml(issue.issue)}</p>
            <p class="issue-suggestion"><strong>Suggestion:</strong> ${escapeHtml(issue.suggestion)}</p>
          </div>
        </div>`,
        )
        .join("")
    : `<p class="empty-state">No UI issues reported for this run.</p>`;

  const enhancementsHtml = enhancements.length
    ? enhancements
        .map(
          (item) => `
        <div class="enhancement-row">
          <div class="enhancement-step">${escapeHtml(item.step)}</div>
          <p class="enhancement-text">${escapeHtml(item.enhancement)}</p>
          <p class="enhancement-rationale">${escapeHtml(item.rationale)}</p>
        </div>`,
        )
        .join("")
    : `<p class="empty-state">No enhancements suggested for this run.</p>`;

  const flowHtml = flow.length
    ? flow
        .map(
          (item) => `
        <div class="flow-item">
          <div class="flow-order">${item.order}</div>
          <div class="flow-content">
            <h4>${escapeHtml(item.step)}</h4>
            <p>${escapeHtml(item.action)}</p>
            ${item.notes ? `<p class="flow-notes">${escapeHtml(item.notes)}</p>` : ""}
          </div>
        </div>`,
        )
        .join("")
    : `<p class="empty-state">No recommended flow generated.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UI Analysis — ${escapeHtml(testName)}</title>
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121a2f;
      --panel-2: #18233d;
      --text: #e8eefc;
      --muted: #9fb0d3;
      --line: rgba(255,255,255,0.08);
      --accent: #6ea8ff;
      --accent-2: #8b5cf6;
      --critical: #ff5d6c;
      --major: #ffb020;
      --minor: #4cc9f0;
      --success: #3ddc97;
      --shadow: 0 18px 50px rgba(0,0,0,0.28);
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Roboto, Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(110,168,255,0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(139,92,246,0.16), transparent 24%),
        var(--bg);
      color: var(--text);
      line-height: 1.55;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .page {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(110,168,255,0.16), rgba(139,92,246,0.14));
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 4px);
      padding: 28px 30px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }
    .eyebrow {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    h1, h2, h3, h4 { margin: 0 0 10px; line-height: 1.2; }
    h1 { font-size: clamp(28px, 4vw, 40px); }
    h2 { font-size: 24px; margin-bottom: 16px; }
    .hero-meta, .meta-line {
      color: var(--muted);
      font-size: 14px;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 14px 22px;
      margin-top: 14px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
      margin: 22px 0 28px;
    }
    .stat {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px;
    }
    .stat .label { color: var(--muted); font-size: 13px; }
    .stat .value { font-size: 30px; font-weight: 800; margin-top: 6px; }
    .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 22px;
      box-shadow: var(--shadow);
    }
    .summary {
      font-size: 17px;
      color: #d7e2ff;
    }
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 8px;
    }
    .toc a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      color: var(--text);
      font-size: 13px;
    }
    .step-card {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 18px;
    }
    .step-header {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    .step-badge {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: white;
      flex-shrink: 0;
    }
    .step-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 18px;
    }
    .screenshot-panel {
      background: #0d1428;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
    }
    .screenshot-panel img {
      width: 100%;
      display: block;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #fff;
    }
    .caption, .flow-notes, .enhancement-rationale, .issue-suggestion {
      color: var(--muted);
      font-size: 14px;
    }
    .data-group {
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .data-group:last-child { border-bottom: 0; padding-bottom: 0; }
    .data-group ul {
      margin: 0;
      padding-left: 18px;
      color: #d7e2ff;
    }
    .excerpt {
      margin: 0;
      color: #d7e2ff;
      white-space: pre-wrap;
      max-height: 220px;
      overflow: auto;
      background: #0d1428;
      border-radius: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      font-size: 13px;
    }
    .table-wrap { overflow: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 600; }
    .issue-row, .enhancement-row, .flow-item, .issue-chip, .enhancement-chip {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #0f1730;
    }
    .issue-row {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 14px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .issue-severity {
      font-weight: 800;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.08em;
      align-self: start;
      padding-top: 4px;
    }
    .issue-step, .enhancement-step {
      color: var(--accent);
      font-weight: 700;
      margin-bottom: 6px;
    }
    .enhancement-row, .inline-issues, .inline-enhancements { margin-top: 14px; }
    .enhancement-row { padding: 14px; margin-bottom: 12px; }
    .flow-item {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 14px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .flow-order {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(110,168,255,0.15);
      color: var(--accent);
      font-weight: 800;
    }
    .issue-chip, .enhancement-chip {
      padding: 12px;
      margin-bottom: 10px;
    }
    .issue-chip strong, .enhancement-chip span { display: block; margin-bottom: 6px; }
    .severity-critical { border-color: rgba(255,93,108,0.45); }
    .severity-major { border-color: rgba(255,176,32,0.45); }
    .severity-minor { border-color: rgba(76,201,240,0.45); }
    .severity-critical .issue-severity, .issue-chip.severity-critical strong { color: var(--critical); }
    .severity-major .issue-severity, .issue-chip.severity-major strong { color: var(--major); }
    .severity-minor .issue-severity, .issue-chip.severity-minor strong { color: var(--minor); }
    .empty-state { color: var(--muted); margin: 0; }
    .back-link {
      display: inline-flex;
      margin-bottom: 16px;
      color: var(--muted);
      font-size: 14px;
    }
    @media (max-width: 900px) {
      .step-grid, .issue-row, .flow-item { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: white; color: black; }
      .section, .hero, .step-card, .stat, .issue-row, .enhancement-row, .flow-item {
        box-shadow: none;
        background: white;
        color: black;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <a class="back-link" href="${escapeHtml(indexHref)}">← All UI reports</a>

    <header class="hero">
      <div class="eyebrow">Playwright UI Analysis</div>
      <h1>${escapeHtml(testName)}</h1>
      <p class="hero-meta">
        <span><strong>Test file:</strong> ${escapeHtml(context.testFile)}</span>
        <span><strong>Test title:</strong> ${escapeHtml(context.testTitle || "n/a")}</span>
        <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
        <span><strong>Model:</strong> ${escapeHtml(context.model || "gpt-4o")}</span>
      </p>
    </header>

    <div class="stats">
      <div class="stat"><div class="label">Steps captured</div><div class="value">${context.steps.length}</div></div>
      <div class="stat"><div class="label">Critical issues</div><div class="value" style="color:var(--critical)">${issueCounts.critical}</div></div>
      <div class="stat"><div class="label">Major issues</div><div class="value" style="color:var(--major)">${issueCounts.major}</div></div>
      <div class="stat"><div class="label">Minor issues</div><div class="value" style="color:var(--minor)">${issueCounts.minor}</div></div>
      <div class="stat"><div class="label">Enhancements</div><div class="value" style="color:var(--success)">${enhancements.length}</div></div>
      <div class="stat"><div class="label">Flow steps</div><div class="value">${flow.length}</div></div>
    </div>

    <section class="section">
      <h2>Executive summary</h2>
      <p class="summary">${escapeHtml(analysis.summary || "No summary provided.")}</p>
      <div class="toc">
        ${context.steps.map((step) => `<a href="#step-${step.stepIndex}">Step ${step.stepIndex}: ${escapeHtml(step.stepName)}</a>`).join("")}
      </div>
    </section>

    <section class="section">
      <h2>Step captures</h2>
      ${stepCards}
    </section>

    <section class="section">
      <h2>UI issues</h2>
      ${issuesHtml}
    </section>

    <section class="section">
      <h2>Enhancements</h2>
      ${enhancementsHtml}
    </section>

    <section class="section">
      <h2>Recommended E2E flow</h2>
      ${flowHtml}
    </section>
  </div>
</body>
</html>`;
}

/**
 * @param {Array<{
 *   testFile: string;
 *   testTitle?: string;
 *   htmlPath: string;
 *   generatedAt: string;
 *   issueCount: number;
 *   enhancementCount: number;
 *   stepCount: number;
 * }>} reports
 */
function buildIndexHtml(reports) {
  const sorted = [...reports].sort((a, b) =>
    a.testFile.localeCompare(b.testFile),
  );

  const cards = sorted.length
    ? sorted
        .map((report) => {
          const href = path.basename(report.htmlPath);
          return `
          <a class="report-card" href="${escapeHtml(href)}">
            <div class="report-title">${escapeHtml(path.basename(report.testFile))}</div>
            <div class="report-path">${escapeHtml(report.testFile)}</div>
            <div class="report-stats">
              <span>${report.stepCount} steps</span>
              <span>${report.issueCount} issues</span>
              <span>${report.enhancementCount} enhancements</span>
            </div>
            <div class="report-date">${escapeHtml(report.generatedAt)}</div>
          </a>`;
        })
        .join("")
    : `<p class="empty">No UI analysis reports generated yet.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UI Analysis Reports</title>
  <style>
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Roboto, Arial, sans-serif;
      background: #0b1020;
      color: #e8eefc;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 36px 20px 60px; }
    h1 { margin: 0 0 8px; font-size: 36px; }
    .sub { color: #9fb0d3; margin-bottom: 28px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .report-card {
      display: block;
      text-decoration: none;
      color: inherit;
      background: #121a2f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 18px;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .report-card:hover {
      transform: translateY(-2px);
      border-color: rgba(110,168,255,0.45);
    }
    .report-title { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
    .report-path { color: #9fb0d3; font-size: 13px; margin-bottom: 14px; word-break: break-all; }
    .report-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }
    .report-stats span {
      background: #18233d;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      color: #d7e2ff;
    }
    .report-date { color: #9fb0d3; font-size: 12px; }
    .empty { color: #9fb0d3; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>UI Analysis Reports</h1>
    <p class="sub">Open any report to review screenshots, page data, AI findings, and recommended test flow.</p>
    <div class="grid">${cards}</div>
  </div>
</body>
</html>`;
}

/**
 * @param {string} htmlPath
 * @param {import('./openai-ui-analysis').UiAnalysisResult} analysis
 * @param {{
 *   testFile: string;
 *   testTitle?: string;
 *   steps: import('./openai-ui-analysis').StepCapture[];
 *   model?: string;
 *   analysisRoot: string;
 * }} context
 */
async function writeAnalysisHtmlReport(htmlPath, analysis, context) {
  const generatedAt = new Date().toISOString();
  const html = buildAnalysisHtml(analysis, {
    testFile: context.testFile,
    testTitle: context.testTitle,
    steps: context.steps,
    model: context.model,
    generatedAt,
    htmlOutputPath: htmlPath,
    indexOutputPath: path.join(context.analysisRoot, "index.html"),
  });
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await fs.writeFile(htmlPath, html, "utf8");
  return {
    htmlPath,
    generatedAt,
    issueCount: (analysis.uiIssues || []).length,
    enhancementCount: (analysis.enhancements || []).length,
    stepCount: context.steps.length,
    testFile: context.testFile,
    testTitle: context.testTitle,
  };
}

/**
 * @param {string} indexPath
 * @param {Array<Awaited<ReturnType<typeof writeAnalysisHtmlReport>>>} reports
 */
async function writeAnalysisIndexHtml(indexPath, reports) {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, buildIndexHtml(reports), "utf8");
}

module.exports = {
  buildAnalysisHtml,
  buildIndexHtml,
  writeAnalysisHtmlReport,
  writeAnalysisIndexHtml,
};
