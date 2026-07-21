/**
 * Aggregates soft-check buffers + hard test failures into a readable ISSUES report
 * under reports/<run>/ (and test-results/soft-issues/).
 */
const fs = require("fs/promises");
const path = require("path");

const BUFFER_DIR = path.join("test-results", "soft-issues", "_buffer");

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

function severityRank(severity) {
  const map = { critical: 0, major: 1, minor: 2 };
  return map[String(severity || "").toLowerCase()] ?? 9;
}

/**
 * @param {Array<object>} issues
 * @param {{ generatedAt: string, runStatus: string, softPass: boolean }} meta
 */
function renderMarkdown(issues, meta) {
  const lines = [];
  lines.push(`# OneDirectBuy — CI Issues Report`);
  lines.push("");
  lines.push(`> Soft-captured UI / locator issues with readable markers.`);
  lines.push(`> GitHub Actions stays **green** when \`CI_SOFT_PASS=1\` — review this file for product/UI work.`);
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Generated | ${meta.generatedAt} |`);
  lines.push(`| Playwright status | ${meta.runStatus} |`);
  lines.push(`| Soft pass (CI green) | ${meta.softPass ? "yes" : "no"} |`);
  lines.push(`| Total issues | ${issues.length} |`);
  lines.push("");

  const byMarker = {};
  for (const issue of issues) {
    const m = issue.marker || "[UI-MISMATCH]";
    byMarker[m] = (byMarker[m] || 0) + 1;
  }
  if (Object.keys(byMarker).length) {
    lines.push(`## Marker summary`);
    lines.push("");
    for (const [marker, count] of Object.entries(byMarker).sort()) {
      lines.push(`- \`${marker}\` × ${count}`);
    }
    lines.push("");
  }

  if (!issues.length) {
    lines.push(`## No issues`);
    lines.push("");
    lines.push(`All soft checks passed.`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`## Issues`);
  lines.push("");

  const sorted = [...issues].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      String(a.id || "").localeCompare(String(b.id || "")),
  );

  sorted.forEach((issue, index) => {
    const marker = issue.marker || "[UI-MISMATCH]";
    lines.push(`### ${index + 1}. ${marker} ${issue.id || "n/a"} — ${issue.title || "Issue"}`);
    lines.push("");
    lines.push(`| Field | Detail |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Marker | \`${marker}\` |`);
    lines.push(`| Severity | ${issue.severity || "n/a"} |`);
    lines.push(`| Test | ${issue.testTitle || "n/a"} |`);
    lines.push(`| Spec | \`${issue.testFile || "n/a"}\` |`);
    lines.push(`| URL | ${issue.url || "n/a"} |`);
    if (issue.screenshotPath) {
      lines.push(`| Screenshot | \`${String(issue.screenshotPath).replace(/\\/g, "/")}\` |`);
    }
    lines.push("");
    lines.push(`**Evidence**`);
    lines.push("");
    lines.push("```");
    lines.push(String(issue.evidence || "").trim() || "(none)");
    lines.push("```");
    lines.push("");
    lines.push(`**Suggested fix:** ${issue.suggestion || "Investigate with screenshot."}`);
    lines.push("");
    lines.push(`---`);
    lines.push("");
  });

  lines.push(`## Marker legend`);
  lines.push("");
  lines.push(`| Marker | Meaning |`);
  lines.push(`| --- | --- |`);
  lines.push(`| \`[MISSING-ELEMENT]\` | Expected control not found / not clickable |`);
  lines.push(`| \`[TIMEOUT]\` | Action or assertion timed out |`);
  lines.push(`| \`[STRICT-MODE]\` | Locator matched more than one element |`);
  lines.push(`| \`[ASSERTION]\` | Expectation failed (text/visibility/value) |`);
  lines.push(`| \`[NAVIGATION]\` | URL / navigation mismatch |`);
  lines.push(`| \`[PERFORMANCE]\` | Load time over budget |`);
  lines.push(`| \`[AUTH]\` | Login / credentials problem |`);
  lines.push(`| \`[INFRA]\` | Browser/runner infrastructure problem |`);
  lines.push(`| \`[UI-MISMATCH]\` | Other UI mismatch |`);
  lines.push("");

  return lines.join("\n");
}

class SoftIssuesReporter {
  constructor() {
    /** @type {Array<object>} */
    this.failures = [];
  }

  onTestEnd(test, result) {
    if (result.status !== "failed" && result.status !== "timedOut") return;

    const shot = (result.attachments || []).find(
      (a) => a.contentType === "image/png" || a.name?.includes("screenshot"),
    );
    const evidence = (result.error?.message || result.status || "").slice(0, 800);
    let marker = "[ASSERTION]";
    let category = "product";
    if (
      /Executable doesn't exist|browserType\.launch|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|net::ERR_|chrome-error:\/\//i.test(
        evidence,
      )
    ) {
      marker = "[INFRA]";
      category = "infra";
    } else if (/strict mode violation/i.test(evidence)) {
      marker = "[STRICT-MODE]";
      category = "automation";
    } else if (/TimeoutError|Timeout \d+ms exceeded/i.test(evidence)) {
      marker = "[TIMEOUT]";
    } else if (/waiting for/i.test(evidence)) {
      marker = "[MISSING-ELEMENT]";
    }

    this.failures.push({
      marker,
      id: "hard-fail",
      title: `Hard test failure: ${test.title}`,
      severity: category === "infra" ? "minor" : "critical",
      category,
      source: "test-failure",
      testFile: path.relative(process.cwd(), test.location.file).replace(/\\/g, "/"),
      testTitle: test.title,
      step: "test",
      url: "",
      screenshotPath: shot?.path || "",
      evidence,
      suggestion:
        marker === "[INFRA]"
          ? "Infrastructure/network/browser problem — not a product UI bug. Re-run when the site is reachable (or install browsers)."
          : "This was a hard failure (not wrapped in soft()). Fix the assertion or wrap it with soft() if it should be advisory only.",
      capturedAt: new Date().toISOString(),
    });
  }

  /**
   * @param {import('@playwright/test/reporter').FullResult} result
   */
  async onEnd(result) {
    if (
      process.env.SOFT_ISSUES_REPORT === "0" ||
      process.env.SOFT_ISSUES_REPORT === "false"
    ) {
      return;
    }

    /** @type {Array<object>} */
    const issues = [...this.failures];

    const bufferRoot = path.join(process.cwd(), BUFFER_DIR);
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
        // ignore
      }
    }

    const seen = new Set();
    const unique = [];
    for (const issue of issues) {
      const key = [issue.marker, issue.id, issue.title, issue.testTitle, issue.evidence]
        .join("|")
        .slice(0, 500);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(issue);
    }

    unique.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        String(a.id || "").localeCompare(String(b.id || "")),
    );

    const softPass =
      process.env.CI_SOFT_PASS === "1" ||
      process.env.CI_SOFT_PASS === "true" ||
      (Boolean(process.env.CI) &&
        process.env.CI_SOFT_PASS !== "0" &&
        process.env.CI_SOFT_PASS !== "false");

    const meta = {
      generatedAt: new Date().toISOString(),
      runStatus: result.status,
      softPass,
    };

    const reportRoot =
      process.env.PW_REPORT_OUTPUT_DIR &&
      path.dirname(process.env.PW_REPORT_OUTPUT_DIR);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fallbackDir = path.join("test-results", "soft-issues", stamp);
    const outDir = reportRoot || fallbackDir;
    await fs.mkdir(outDir, { recursive: true });

    const md = renderMarkdown(unique, meta);
    const mdPath = path.join(outDir, "ISSUES.md");
    const jsonPath = path.join(outDir, "ISSUES.json");
    const latestDir = path.join("test-results", "soft-issues");
    await fs.mkdir(latestDir, { recursive: true });

    await fs.writeFile(mdPath, md, "utf8");
    const productIssues = unique.filter(
      (i) => (i.category || "product") === "product",
    );
    const payload = {
      meta: {
        ...meta,
        issueCount: unique.length,
        productIssueCount: productIssues.length,
        infraOrBlockedCount: unique.length - productIssues.length,
      },
      issues: unique,
      /** Issues worth sending to product developers (excludes infra/blocked). */
      productIssues,
    };
    await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
    await fs.writeFile(path.join(latestDir, "LATEST_ISSUES.md"), md, "utf8");
    await fs.writeFile(
      path.join(latestDir, "LATEST_ISSUES.json"),
      JSON.stringify(payload, null, 2),
      "utf8",
    );

    for (const file of bufferFiles) {
      await fs.unlink(file).catch(() => {});
    }

    console.log(`\n[softIssuesReporter] Issues report written:`);
    console.log(`  - ${mdPath}`);
    console.log(`  - ${jsonPath}`);
    console.log(
      `  - Issues: ${unique.length} (product: ${productIssues.length}, infra/blocked: ${unique.length - productIssues.length})`,
    );
    if (unique.length) {
      console.log(`  Markers:`);
      const counts = {};
      for (const i of unique) {
        const m = i.marker || "[UI-MISMATCH]";
        counts[m] = (counts[m] || 0) + 1;
      }
      for (const [m, c] of Object.entries(counts)) {
        console.log(`    ${m} × ${c}`);
      }
    }
  }
}

module.exports = SoftIssuesReporter;
