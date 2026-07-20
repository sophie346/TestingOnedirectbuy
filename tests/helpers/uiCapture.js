import fs from "fs/promises";
import path from "path";

const DEFAULT_CAPTURE_ROOT =
  process.env.UI_CAPTURE_DIR || path.join("test-results", "ui-capture");

/**
 * @param {string} value
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Extract visible page reference data for OpenAI context (not full HTML).
 * @param {import('@playwright/test').Page} page
 */
async function extractPageReferenceData(page) {
  return page.evaluate(() => {
    const isVisible = (/** @type {Element} */ el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const textOf = (/** @type {Element[]} */ nodes, limit = 25) =>
      nodes
        .filter(isVisible)
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean)
        .slice(0, limit);

    return {
      headings: textOf([...document.querySelectorAll("h1, h2, h3, h4")]),
      buttons: textOf([...document.querySelectorAll("button")]),
      links: textOf([...document.querySelectorAll("a")]),
      inputs: [...document.querySelectorAll("input, textarea, select")]
        .filter(isVisible)
        .map((el) => {
          const input = /** @type {HTMLInputElement} */ (el);
          return {
            tag: el.tagName.toLowerCase(),
            type: input.type || undefined,
            name: input.name || undefined,
            placeholder: input.placeholder || undefined,
            ariaLabel: input.getAttribute("aria-label") || undefined,
            value: input.value ? input.value.slice(0, 120) : undefined,
          };
        })
        .slice(0, 30),
      alerts: textOf([
        ...document.querySelectorAll('[role="alert"], [role="status"]'),
      ]),
      mainText: (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
    };
  });
}

/**
 * @param {import('@playwright/test').TestInfo} testInfo
 */
function getCaptureDirForTest(testInfo) {
  const relativeFile = path
    .relative(process.cwd(), testInfo.file)
    .replace(/\\/g, "/");
  const testTitle = slugify(testInfo.title) || "test";
  return path.join(
    DEFAULT_CAPTURE_ROOT,
    slugify(relativeFile),
    testTitle,
  );
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export function createStepCapture(page, testInfo) {
  let stepIndex = 0;

  /**
   * @returns {number}
   */
  function getCaptureCount() {
    return stepIndex;
  }

  /**
   * Run a test step, then capture screenshot + page reference data.
   * @param {string} stepName
   * @param {() => Promise<void>} fn
   */
  async function captureStep(stepName, fn) {
    await fn();

    stepIndex += 1;
    const padded = String(stepIndex).padStart(2, "0");
    const stepSlug = slugify(stepName) || `step-${stepIndex}`;
    const captureDir = getCaptureDirForTest(testInfo);
    await fs.mkdir(captureDir, { recursive: true });

    const baseName = `${padded}-${stepSlug}`;
    const screenshotPath = path.join(captureDir, `${baseName}.png`);
    const metadataPath = path.join(captureDir, `${baseName}.json`);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const pageData = await extractPageReferenceData(page);
    const metadata = {
      stepIndex,
      stepName,
      testFile: path.resolve(testInfo.file),
      testTitle: testInfo.title,
      url: page.url(),
      title: await page.title(),
      capturedAt: new Date().toISOString(),
      screenshotPath: path.resolve(screenshotPath),
      pageData,
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

    await testInfo.attach(`${stepName} — screenshot`, {
      path: screenshotPath,
      contentType: "image/png",
    });
    await testInfo.attach(`${stepName} — page data`, {
      body: JSON.stringify(pageData, null, 2),
      contentType: "application/json",
    });

    return metadata;
  }

  return { captureStep, getCaptureCount };
}

export { DEFAULT_CAPTURE_ROOT, extractPageReferenceData, slugify };
