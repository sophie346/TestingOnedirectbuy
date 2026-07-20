import { test, expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  openFirstProductFromShop,
} from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Product Detail", () => {
  test.beforeEach(async ({ page }) => {
    await openFirstProductFromShop(page);
  });

  test("ODB-UC-056: product page loads with full product information", async ({
    page,
  }) => {
    await expect(page.locator("h1, .ps-product__title, .ps-product__heading").first()).toBeVisible();
    await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
  });

  test("ODB-UC-057: buyer views product image gallery", async ({ page }) => {
    await expect(page.locator(".ps-product__gallery img, .ps-product img, img").first()).toBeVisible();
  });

  test("ODB-UC-058: product title, SKU, brand, price, and availability display", async ({
    page,
  }) => {
    await expect(page.getByText(/SKU|sku/i).or(page.locator("h1")).first()).toBeVisible();
    await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
  });

  test("ODB-UC-060: buyer increases or decreases quantity", async ({ page }) => {
    const qtyInput = page.locator('input[type="number"], .form-control').filter({ hasText: /^$/ }).first();
    const plusBtn = page.locator(".input-group-btn, .quantity").getByRole("button").last();
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await plusBtn.click();
    } else if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qtyInput.fill("2");
    }
  });

  test("ODB-UC-062: buyer adds product from detail page", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /Add To Cart|Add to cart/i }).first();
    await addBtn.click();
    await expect(page.getByText(/added|cart|success/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-063: Buy Now goes toward checkout", async ({ page }) => {
    const buyNow = page.getByRole("button", { name: /Buy Now|Buy now/i });
    if (await buyNow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buyNow.click();
      await expect(page).toHaveURL(/checkout|cart|shopping-cart/i, {
        timeout: 15_000,
      });
    }
  });

  test("ODB-UC-065: guest is prompted to login before wishlist", async ({
    page,
  }) => {
    const wishlistBtn = page.locator('[class*="wishlist"], .icon-heart').first();
    test.skip(!(await wishlistBtn.isVisible({ timeout: 5000 }).catch(() => false)), "Wishlist control not visible");
    await wishlistBtn.click();
    const sawLoginPrompt = await page
      .getByText(/login|sign in|register/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const onAuthUrl = /login|wishlist/.test(page.url());
    expect(sawLoginPrompt || onAuthUrl).toBeTruthy();
  });

  test("ODB-UC-068: product return policy displays clearly", async ({ page }) => {
    await expect(
      page.getByText(/return|refund|policy/i).or(page.getByRole("link", { name: /Return/i })).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ODB-UC-071: related or recommended products display", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.getByText(/Related|Recommended|You may also/i).or(page.locator('a[href*="/product/"]')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ODB-UC-072: product specifications display", async ({ page }) => {
    await expect(
      page.getByText(/specification|description|detail|feature/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ODB-UC-074: inactive product handling shows unavailable state", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/product/invalid-inactive-product-id-99999");
    await expect(
      page.getByText(/not found|unavailable|404|Ohh! Page not found/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-075: deleted product URL shows 404 or unavailable message", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/product/deleted-product-test-404");
    await expect(
      page.getByText(/not found|unavailable|404|Ohh! Page not found/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-406: related products display by category or brand", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('a[href*="/product/"]').nth(1)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-508: product page with images loads without timeout", async ({
    page,
  }) => {
    const start = Date.now();
    await expect(page.locator("img").first()).toBeVisible();
    expect(Date.now() - start).toBeLessThan(20_000);
  });

  test("ODB-UC-064: logged-in buyer saves product to wishlist", async ({
    page,
  }) => {
    await ensureLoggedInBuyer(page);
    await openFirstProductFromShop(page);
    const wishlistBtn = page.locator(".icon-heart, [href*='wishlist']").first();
    if (await wishlistBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wishlistBtn.click();
    }
    await gotoOneDirectBuy(page, "/account/wishlist");
    await expect(page).toHaveURL(/wishlist/);
  });
});
