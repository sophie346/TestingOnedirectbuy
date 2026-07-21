/**
 * Soft checks: capture UI/locator issues with readable markers without failing the test.
 * Issues are buffered for reporters/softIssuesReporter.js → reports/<run>/ISSUES.md
 */
import fs from "fs";
import path from "path";

export const BUFFER_DIR = path.join("test-results", "soft-issues", "_buffer");
const SCREENSHOT_DIR = path.join("test-results", "soft-issues", "screenshots");

/** Readable markers printed in logs and ISSUES.md */
export const MARKERS = {
  MISSING_ELEMENT: "[MISSING-ELEMENT]",
  TIMEOUT: "[TIMEOUT]",
  STRICT_MODE: "[STRICT-MODE]",
  ASSERTION: "[ASSERTION]",
  UI_MISMATCH: "[UI-MISMATCH]",
  NAVIGATION: "[NAVIGATION]",
  PERFORMANCE: "[PERFORMANCE]",
  AUTH: "[AUTH]",
  INFRA: "[INFRA]",
  BLOCKED: "[BLOCKED]",
};

/**
 * True when the failure is environment/network — not a product UI bug.
 * @param {unknown} err
 */
export function isInfraError(err) {
  const msg = String(err && err.message != null ? err.message : err);
  return /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_INTERNET_DISCONNECTED|ERR_TIMED_OUT|ERR_ADDRESS_UNREACHABLE|net::ERR_|chrome-error:\/\/|NS_ERROR_UNKNOWN_HOST|no healthy upstream|502 bad gateway|503 service/i.test(
    msg,
  );
}

/**
 * @param {unknown} err
 */
export function classifyError(err) {
  const msg = String(err && err.message != null ? err.message : err);
  if (isInfraError(err)) return MARKERS.INFRA;
  if (/strict mode violation/i.test(msg)) return MARKERS.STRICT_MODE;
  if (/TimeoutError|Timeout \d+ms exceeded/i.test(msg)) return MARKERS.TIMEOUT;
  if (/waiting for|locator\.(click|fill|selectOption)/i.test(msg)) {
    return MARKERS.MISSING_ELEMENT;
  }
  if (/toHaveURL|navigation|net::/i.test(msg)) return MARKERS.NAVIGATION;
  if (/toBeLessThan|performance|loadMs/i.test(msg)) return MARKERS.PERFORMANCE;
  if (/password|login|credential|auth/i.test(msg)) return MARKERS.AUTH;
  if (/expect\(|toBeVisible|toHaveTitle|toHaveValue|Expected/i.test(msg)) {
    return MARKERS.ASSERTION;
  }
  return MARKERS.UI_MISMATCH;
}

/**
 * @param {string} marker
 */
function suggestionFor(marker) {
  switch (marker) {
    case MARKERS.INFRA:
      return "Infrastructure/network failure (DNS, connection, gateway) — not a product bug. Re-run when the site is reachable.";
    case MARKERS.BLOCKED:
      return "Journey stopped because a prior required step failed — fix that step first; later steps were not run.";
    case MARKERS.STRICT_MODE:
      return "Locator matched multiple elements — narrow with getByLabel / getByRole name / .first() scoped to the section.";
    case MARKERS.MISSING_ELEMENT:
    case MARKERS.TIMEOUT:
      return "Element not found or not interactable — UI label/role may have changed; update locator or confirm viewport (mobile vs desktop).";
    case MARKERS.NAVIGATION:
      return "URL did not match expected pattern — confirm route or footer/header destination changed.";
    case MARKERS.PERFORMANCE:
      return "Page exceeded the accepted load budget — check CDN/API latency or relax the threshold for CI.";
    case MARKERS.AUTH:
      return "Auth step failed — verify ONEDIRECTBUY_BUYER_* secrets/vars in GitHub Actions.";
    default:
      return "Reproduce with the screenshot, compare against live UI, update assertion or fix product bug.";
  }
}

/**
 * Category for filtering what to send to product developers.
 * @param {string} marker
 */
export function issueCategory(marker) {
  if (marker === MARKERS.INFRA || marker === MARKERS.BLOCKED) return "infra";
  if (marker === MARKERS.STRICT_MODE) return "automation";
  return "product";
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export function createSoftChecker(page, testInfo) {
  /** @type {Array<object>} */
  const issues = [];

  /**
   * Run a check; on failure record a marked issue and continue (does not throw).
   * @param {string} id Use-case id e.g. ODB-UC-029
   * @param {string} title Short human description
   * @param {() => Promise<void>} fn
   * @param {{ severity?: string }} [opts]
   * @returns {Promise<boolean>} true if check passed
   */
  async function soft(id, title, fn, opts = {}) {
    const severity = opts.severity || "major";
    const forceMarker = opts.marker || "";
    try {
      await fn();
      return true;
    } catch (err) {
      const marker = forceMarker || classifyError(err);
      const category = opts.category || issueCategory(marker);
      const evidence = String(err && err.message != null ? err.message : err)
        .split("\n")
        .slice(0, 6)
        .join("\n")
        .slice(0, 800);

      let screenshotPath = "";
      // Skip full-page shots on chrome-error / dead pages — not useful for product.
      const skipShot =
        category === "infra" ||
        /chrome-error:\/\//i.test((() => {
          try {
            return page.url();
          } catch {
            return "";
          }
        })());
      if (!skipShot) {
        try {
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          const safe = `${id}-${Date.now()}`.replace(/[^\w.-]+/g, "_");
          screenshotPath = path.join(SCREENSHOT_DIR, `${safe}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          screenshotPath = "";
        }
      }

      const issue = {
        marker,
        id,
        title,
        severity: category === "infra" ? "minor" : severity,
        category,
        source: "soft-check",
        testFile: path.relative(process.cwd(), testInfo.file).replace(/\\/g, "/"),
        testTitle: testInfo.title,
        step: id,
        url: (() => {
          try {
            return page.url();
          } catch {
            return "";
          }
        })(),
        evidence,
        screenshotPath,
        suggestion: suggestionFor(marker),
        capturedAt: new Date().toISOString(),
      };
      issues.push(issue);

      const line = `${marker} ${id} — ${title}`;
      console.log(`\n⚠ ${line}`);
      console.log(`  ${evidence.split("\n")[0]}`);
      if (screenshotPath) console.log(`  screenshot: ${screenshotPath}`);

      try {
        await testInfo.attach(line, {
          body: Buffer.from(
            [
              line,
              `Severity: ${severity}`,
              `URL: ${issue.url}`,
              "",
              evidence,
              "",
              `Suggested fix: ${issue.suggestion}`,
            ].join("\n"),
            "utf8",
          ),
          contentType: "text/plain",
        });
        if (screenshotPath && fs.existsSync(screenshotPath)) {
          await testInfo.attach(`${marker} screenshot`, {
            path: screenshotPath,
            contentType: "image/png",
          });
        }
      } catch {
        // attachment is best-effort
      }

      return false;
    }
  }

  function flush() {
    if (!issues.length) return;
    fs.mkdirSync(BUFFER_DIR, { recursive: true });
    const file = path.join(
      BUFFER_DIR,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
    );
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          testFile: path.relative(process.cwd(), testInfo.file).replace(/\\/g, "/"),
          testTitle: testInfo.title,
          issues,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  return { soft, flush, issues, MARKERS };
}
