import fs from "fs/promises";
import path from "path";

const ANALYSIS_ROOT =
  process.env.UI_ANALYSIS_DIR || path.join("test-results", "ui-analysis");

/**
 * Load the latest recommended flow for a spec file (from a prior run's UI analysis).
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export async function loadRecommendedFlow(testInfo) {
  const relativeFile = path
    .relative(process.cwd(), testInfo.file)
    .replace(/\\/g, "/");
  const flowPath = path.join(
    ANALYSIS_ROOT,
    `${relativeFile.replace(/\.spec\.js$/i, "")}.recommended-flow.json`,
  );

  try {
    const raw = await fs.readFile(flowPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Run extra verification steps from the recommended flow when UI_ANALYSIS_APPLY=1.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {(stepName: string, fn: () => Promise<void>) => Promise<unknown>} captureStep
 */
export async function applyRecommendedFlow(page, testInfo, captureStep) {
  const enabled =
    process.env.UI_ANALYSIS_APPLY === "1" ||
    process.env.UI_ANALYSIS_APPLY === "true";
  if (!enabled) {
    return;
  }

  const flow = await loadRecommendedFlow(testInfo);
  if (!Array.isArray(flow) || !flow.length) {
    return;
  }

  const sorted = [...flow].sort((a, b) => a.order - b.order);

  for (const item of sorted) {
    if (!item?.action || !item?.step) continue;

    await captureStep(`AI flow — ${item.step}`, async () => {
      const action = String(item.action).toLowerCase();

      if (action.includes("wait for network")) {
        await page.waitForLoadState("networkidle");
        return;
      }

      if (action.includes("verify url")) {
        const match = item.action.match(/https?:\/\/\S+/i);
        if (match) {
          await page.waitForURL(match[0], { timeout: 15_000 });
        }
        return;
      }

      const namedControl = item.action.match(/"([^"]+)"/);
      if (namedControl) {
        const label = namedControl[1];
        const button = page.getByRole("button", { name: new RegExp(label, "i") });
        const heading = page.getByRole("heading", { name: new RegExp(label, "i") });
        const link = page.getByRole("link", { name: new RegExp(label, "i") });

        if (action.includes("click")) {
          if (await button.isVisible().catch(() => false)) {
            await button.click();
          } else if (await link.isVisible().catch(() => false)) {
            await link.click();
          }
          return;
        }

        if (action.includes("visible") || action.includes("assert")) {
          const visible =
            (await button.isVisible().catch(() => false)) ||
            (await heading.isVisible().catch(() => false)) ||
            (await link.isVisible().catch(() => false));
          if (!visible) {
            throw new Error(
              `Recommended flow check failed: expected "${label}" to be visible (${item.step})`,
            );
          }
        }
      }
    });
  }
}
