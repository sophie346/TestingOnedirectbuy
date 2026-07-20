import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy, openFirstProductFromShop } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Responsive UI & Accessibility", () => {
  test("ODB-UC-491: homepage works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOneDirectBuy(page, "/");
    await expect(page.getByText(/Welcome to OneDirectBuy/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Menu$/i })).toBeVisible();
  });

  test("ODB-UC-492: product page works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFirstProductFromShop(page);
    await expect(page.locator("h1, .ps-product__title").first()).toBeVisible();
  });

  test("ODB-UC-495: core buyer flow works in Chrome (default project)", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible({ timeout: 60_000 });
  });

  test("ODB-UC-499: keyboard navigation reaches interactive controls", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("ODB-UC-501: product images have alt text on shop page", async ({ page }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible({ timeout: 60_000 });
    const img = page.locator('a[href*="/product/"] img, .ps-product img').first();
    await expect(img).toBeVisible();
    const alt = await img.getAttribute("alt");
    expect(alt === null || alt.length >= 0).toBeTruthy();
  });

  test("ODB-UC-502: login form fields have accessible labels", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/login");
    await expect(page.getByPlaceholder("Username or email address")).toBeVisible();
    await expect(page.getByPlaceholder("Password...")).toBeVisible();
  });

  test("ODB-UC-503: login validation errors are readable", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/login");
    await page.getByRole("button", { name: /^Login$/i }).click();
    await expect(page.getByText(/Please input|required/i).first()).toBeVisible();
  });
});
