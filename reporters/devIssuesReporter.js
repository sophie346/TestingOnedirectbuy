const fs = require("fs/promises");
const path = require("path");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const BUFFER_DIR = path.join("test-results", "dev-issues", "_buffer");
const CAPTURE_ROOT =
  process.env.UI_CAPTURE_DIR || path.join("test-results", "ui-capture");

/**
 * @param {string} dir
 */
async function listJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(full)));
    } else if (entry.name.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} severity
 */
function severityRank(severity) {
  const map = { critical: 0, major: 1, minor: 2 };
  return map[String(severity || "").toLowerCase()] ?? 9;
}

/**
 * @param {Array<object>} issues
 */
function renderMarkdown(issues, meta) {
  const bySeverity = { critical: [], major: [], minor: [], other: [] };
  for (const issue of issues) {
    const key = ["critical", "major", "minor"].includes(
      String(issue.severity || "").toLowerCase()
    )
      ? String(issue.severity).toLowerCase()
      : "other";
    bySeverity[key].push(issue);
  }

  const lines = [];
  lines.push(`# OneProductHub V2 — Issues for Developers`);
  lines.push("");
  lines.push(`**Generated:** ${meta.generatedAt}`);
  lines.push(`**Run status:** ${meta.runStatus}`);
  lines.push(`**Total issues:** ${issues.length}`);
  lines.push(
    `**Breakdown:** critical ${bySeverity.critical.length} · major ${bySeverity.major.length} · minor ${bySeverity.minor.length} · other ${bySeverity.other.length}`
  );
  lines.push("");
  lines.push(
    `Screenshots are kept under \`${CAPTURE_ROOT}\` and linked per issue below.`
  );
  lines.push("");
  lines.push(`---`);
  lines.push("");

  if (!issues.length) {
    lines.push(`## No issues detected`);
    lines.push("");
    lines.push(
      `All V2 captures were scanned and no UI error patterns or test failures were buffered.`
    );
    lines.push("");
    return lines.join("\n");
  }

  for (const severity of ["critical", "major", "minor", "other"]) {
    const group = bySeverity[severity];
    if (!group.length) continue;
    lines.push(
      `## ${severity.toUpperCase()} (${group.length})`
    );
    lines.push("");

    group.forEach((issue, index) => {
      lines.push(`### ${index + 1}. ${issue.title || issue.id || "Issue"}`);
      lines.push("");
      lines.push(`| Field | Detail |`);
      lines.push(`| --- | --- |`);
      lines.push(`| Severity | ${issue.severity || "n/a"} |`);
      lines.push(`| Source | ${issue.source || "n/a"} |`);
      lines.push(`| Test | ${issue.testTitle || "n/a"} |`);
      lines.push(`| Spec file | \`${issue.testFile || "n/a"}\` |`);
      lines.push(`| Step | ${issue.step || "n/a"} |`);
      lines.push(`| URL | ${issue.url || "n/a"} |`);
      if (issue.evidence) {
        lines.push(
          `| Evidence | \`${String(issue.evidence).replace(/\|/g, "\\|").slice(0, 200)}\` |`
        );
      }
      if (issue.screenshotPath) {
        const rel = path.relative(process.cwd(), issue.screenshotPath);
        lines.push(`| Screenshot | \`${rel}\` |`);
      }
      lines.push("");
      lines.push(`**Suggested fix**`);
      lines.push("");
      lines.push(issue.suggestion || "Investigate with the screenshot and reproduce the flow.");
      lines.push("");
    });
  }

  lines.push(`---`);
  lines.push("");
  lines.push(`## How to use this report`);
  lines.push("");
  lines.push(`1. Start with **CRITICAL** items.`);
  lines.push(`2. Open the screenshot path next to each issue.`);
  lines.push(`3. Reproduce on https://oneproducthub.onechanneladmin.com/`);
  lines.push(`4. Fix, then re-run: \`npx playwright test tests/OneproducthubV2\``);
  lines.push("");

  return lines.join("\n");
}

/**
 * @param {Array<object>} issues
 * @param {object} meta
 */
function renderHtml(issues, meta) {
  const escape = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const rows = issues
    .map((issue, i) => {
      const shot = issue.screenshotPath
        ? path.relative(process.cwd(), issue.screenshotPath).replace(/\\/g, "/")
        : "";
      const shotCell = shot
        ? `<a href="../../${escape(shot)}">Open screenshot</a>`
        : "—";
      return `<tr class="sev-${escape(issue.severity || "other")}">
  <td>${i + 1}</td>
  <td><span class="badge">${escape(issue.severity || "n/a")}</span></td>
  <td>${escape(issue.title || issue.id)}</td>
  <td>${escape(issue.testTitle || "")}<br/><code>${escape(issue.testFile || "")}</code></td>
  <td>${escape(issue.step || "")}</td>
  <td>${escape(issue.suggestion || "")}</td>
  <td>${shotCell}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OneProductHub V2 — Issues for Developers</title>
  <style>
    body { font-family: Segoe UI, system-ui, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
    h1 { margin: 0 0 8px; }
    .meta { color: #475569; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #0f172a; color: #fff; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .sev-critical .badge { background: #fee2e2; color: #991b1b; }
    .sev-major .badge { background: #ffedd5; color: #9a3412; }
    .sev-minor .badge { background: #fef9c3; color: #854d0e; }
    code { font-size: 12px; }
    a { color: #0369a1; }
  </style>
</head>
<body>
  <h1>OneProductHub V2 — Issues for Developers</h1>
  <div class="meta">
    Generated: ${escape(meta.generatedAt)} · Run status: ${escape(meta.runStatus)} · Total issues: ${issues.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Severity</th><th>Issue</th><th>Test</th><th>Step</th><th>Suggested fix</th><th>Screenshot</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7">No issues detected in this run.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
}

class DevIssuesReporter {
  constructor() {
    /** @type {Array<object>} */
    this.failures = [];
  }

  onTestEnd(test, result) {
    if (result.status === "failed" || result.status === "timedOut") {
      const shot = (result.attachments || []).find(
        (a) => a.name?.includes("screenshot") || a.contentType === "image/png"
      );
      this.failures.push({
        source: "test-failure",
        severity: "critical",
        id: "test-failed",
        title: `Test failed: ${test.title}`,
        step: "test",
        testFile: path.relative(process.cwd(), test.location.file),
        testTitle: test.title,
        url: "",
        screenshotPath: shot?.path || "",
        evidence: (result.error?.message || result.status || "").slice(0, 500),
        suggestion:
          "Reproduce with the attached screenshots, fix the product bug or flaky locator, then re-run this spec.",
        capturedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * @param {import('@playwright/test/reporter').FullResult} result
   */
  async onEnd(result) {
    const disabled =
      process.env.DEV_ISSUES_REPORT === "0" ||
      process.env.DEV_ISSUES_REPORT === "false";
    if (disabled) return;

    const stamp =
      process.env.PW_REPORT_OUTPUT_DIR?.split(/[\\/]/).pop() ||
      new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = path.join("test-results", "dev-issues", stamp);
    await fs.mkdir(outDir, { recursive: true });

    /** @type {Array<object>} */
    const issues = [...this.failures];

    const bufferRoot = path.isAbsolute(BUFFER_DIR)
      ? BUFFER_DIR
      : path.join(process.cwd(), BUFFER_DIR);
    const bufferFiles = await listJsonFiles(bufferRoot);
    for (const file of bufferFiles) {
      try {
        const raw = JSON.parse(await fs.readFile(file, "utf8"));
        if (Array.isArray(raw.issues)) {
          for (const issue of raw.issues) {
            issues.push({
              ...issue,
              testFile: issue.testFile || raw.testFile,
              testTitle: issue.testTitle || raw.testTitle,
            });
          }
        }
      } catch {
        // ignore bad buffer files
      }
    }

    // Deduplicate by title+test+step+evidence
    const seen = new Set();
    const unique = [];
    for (const issue of issues) {
      const key = [
        issue.title,
        issue.testTitle,
        issue.step,
        issue.evidence,
        issue.screenshotPath,
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(issue);
    }

    unique.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        String(a.testTitle || "").localeCompare(String(b.testTitle || ""))
    );

    const meta = {
      generatedAt: new Date().toISOString(),
      runStatus: result.status,
    };

    const mdPath = path.join(outDir, "ISSUES_FOR_DEVELOPERS.md");
    const htmlPath = path.join(outDir, "ISSUES_FOR_DEVELOPERS.html");
    const jsonPath = path.join(outDir, "ISSUES_FOR_DEVELOPERS.json");
    const latestMd = path.join("test-results", "dev-issues", "LATEST_ISSUES_FOR_DEVELOPERS.md");
    const latestHtml = path.join(
      "test-results",
      "dev-issues",
      "LATEST_ISSUES_FOR_DEVELOPERS.html"
    );

    const md = renderMarkdown(unique, meta);
    const html = renderHtml(unique, meta);

    await fs.writeFile(mdPath, md, "utf8");
    await fs.writeFile(htmlPath, html, "utf8");
    await fs.writeFile(jsonPath, JSON.stringify({ meta, issues: unique }, null, 2), "utf8");
    await fs.mkdir(path.dirname(latestMd), { recursive: true });
    await fs.writeFile(latestMd, md, "utf8");
    await fs.writeFile(latestHtml, html, "utf8");

    // Clear buffer so the next run starts clean
    for (const file of bufferFiles) {
      await fs.unlink(file).catch(() => {});
    }

    console.log(`[devIssuesReporter] Developer issues report written:`);
    console.log(`  - ${mdPath}`);
    console.log(`  - ${htmlPath}`);
    console.log(`  - ${latestMd}`);
    console.log(`  - Issues found: ${unique.length}`);
  }
}

module.exports = DevIssuesReporter;
