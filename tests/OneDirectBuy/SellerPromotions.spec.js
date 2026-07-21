import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  addFirstProductToCartFromShop,
  openCart,
} from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Seller promotions (storefront)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-396: cart exposes coupon entry for seller-restricted promotions", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-396", "Cart Coupon field + Apply button", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await expect(page).toHaveURL(/\/account\/shopping-cart/);
      await expect(page.getByRole("textbox", { name: /^Coupon$/i })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("button", { name: /^Apply$/i })).toBeVisible();
    });
  });

  test("ODB-UC-396b: invalid coupon surfaces rejection notice", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-396b", "Invalid or expired coupon code", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await page.getByRole("textbox", { name: /^Coupon$/i }).fill("INVALIDCOUPON999");
      await page.getByRole("button", { name: /^Apply$/i }).click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /Invalid or expired coupon code/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
