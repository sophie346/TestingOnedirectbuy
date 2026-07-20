/**
 * Soft-aware Playwright test fixture.
 * Use `soft(id, title, async () => { ... })` instead of hard expects for UI checks.
 * Soft failures are recorded with markers; the test still passes.
 */
import { test as base, expect } from "@playwright/test";
import { createSoftChecker, MARKERS } from "./softCheck.js";

export const test = base.extend({
  soft: async ({ page }, use, testInfo) => {
    const checker = createSoftChecker(page, testInfo);
    await use(checker.soft);
    checker.flush();
  },
});

export { expect, MARKERS };
