import { test as base, expect } from "@playwright/test";
import { createStepCapture } from "../helpers/uiCapture.js";

export const test = base.extend({
  captureStep: async ({ page }, use, testInfo) => {
    const { captureStep } = createStepCapture(page, testInfo);
    await use(captureStep);
  },
  /** Ensures UI captures exist for AI analysis (including on test failure). */
  _autoUiCapture: [
    async ({ page }, use, testInfo) => {
      const { captureStep, getCaptureCount } = createStepCapture(page, testInfo);
      await use();
      const failed = testInfo.status !== testInfo.expectedStatus;
      if (failed) {
        await captureStep("Failure state", async () => {}).catch(() => {});
      } else if (getCaptureCount() === 0) {
        await captureStep("Final state", async () => {});
      }
    },
    { auto: true },
  ],
});

export { expect };
