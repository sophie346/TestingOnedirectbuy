import { test, expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  ONE_DIRECT_BUY_BASE_URL,
} from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-027: header navigation links open correct pages", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /All products/i }).click();
    await expect(page).toHaveURL(/\/shop/);
    await gotoOneDirectBuy(page, "/");
    await page.getByRole("link", { name: /Sell on OneDirectBuy/i }).first().click();
    await expect(page).toHaveURL(/vendor|become-a-vendor|sell/i);
    await gotoOneDirectBuy(page, "/");
    await page.getByRole("link", { name: /Track your order|Track Order/i }).first().click();
    await expect(page).toHaveURL(/order-track|order-tracking|track/i);
  });

  test("ODB-UC-028: footer policy and support links open correctly", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /^Privacy Policy$/i }).first().click();
    await expect(page).toHaveURL(/privacy/i);
    await gotoOneDirectBuy(page, "/");
    await page
      .getByRole("link", { name: /Terms of Service|Conditions of Use/i })
      .first()
      .click();
    await expect(page).toHaveURL(/terms|conditions/i);
    await gotoOneDirectBuy(page, "/");
    await page.getByRole("link", { name: /Help Center/i }).first().click();
    await expect(page).toHaveURL(/help|faqs|contact/i);
  });

  test("ODB-UC-029: category menu opens category content", async ({ page }) => {
    await page.getByRole("button", { name: /Categories/i }).click();
    await expect(page.getByText(/AC FILTER|Auto Parts|Category/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("ODB-UC-038: logo click returns user to homepage", async ({ page }) => {
    await gotoOneDirectBuy(page, "/shop");
    await page.locator('a[href="/"], a.ps-logo, a[href*="home"]').first().click();
    await expect(page).toHaveURL(new RegExp(`${ONE_DIRECT_BUY_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`));
  });

  test("ODB-UC-039: mobile menu opens and links work", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOneDirectBuy(page, "/");
    await page.getByRole("button", { name: /^Menu$/i }).click();
    await expect(page.getByRole("link", { name: /All products/i })).toBeVisible();
    await page.getByRole("link", { name: /All products/i }).click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test("ODB-UC-040: breadcrumb navigation redirects to parent pages", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await page.getByRole("link", { name: /^Home$/i }).first().click();
    await expect(page).toHaveURL(/\/($|\?)/);
  });
});
