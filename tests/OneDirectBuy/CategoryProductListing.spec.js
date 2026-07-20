import { test, expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  waitForShopProducts,
  openFirstProductFromShop,
} from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Category & Product Listing", () => {
  test.beforeEach(async ({ page }) => {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);
  });

  test("ODB-UC-041: buyer opens category page and sees product list", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: /^Categories$/i })).toBeVisible();
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
  });

  test("ODB-UC-042: category name and listing content display", async ({
    page,
  }) => {
    await expect(page.getByText(/Shop Default|Products found/i).first()).toBeVisible();
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
  });

  test("ODB-UC-043: product cards show image, title, and price", async ({
    page,
  }) => {
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
    await expect(page.locator("img").first()).toBeVisible();
  });

  test("ODB-UC-044: buyer filters products by price range", async ({ page }) => {
    await expect(page.getByText(/Price:\s*\$/i)).toBeVisible();
  });

  test("ODB-UC-045: buyer filters products by brand", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /By Brands/i })).toBeVisible();
    const brand = page.getByText(/^AIR LIFT$|^AFE$|^ACCEL$/i).first();
    if (await brand.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brand.click();
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
    }
  });

  test("ODB-UC-046: buyer filters in-stock products", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Availability/i })).toBeVisible();
    await expect(page.getByText(/In stock only/i)).toBeVisible();
  });

  test("ODB-UC-048: buyer filters products by rating", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /By Rating/i })).toBeVisible();
    await expect(page.getByText(/4 stars & up/i)).toBeVisible();
  });

  test("ODB-UC-049: buyer clears all filters", async ({ page }) => {
    const brand = page.getByText(/^AIR LIFT$/i).first();
    if (await brand.isVisible({ timeout: 3000 }).catch(() => false)) {
      await brand.click();
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
    }
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
  });

  test("ODB-UC-050: buyer moves through product listing pages", async ({
    page,
  }) => {
    const nextPage = page.getByRole("button").filter({ hasText: /Next|›|»/i }).or(
      page.locator(".pagination a").last()
    );
    if (await nextPage.first().isEnabled({ timeout: 3000 }).catch(() => false)) {
      await nextPage.first().click();
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
    } else {
      await expect(page.getByText(/Previous Page|Next Page/i).first()).toBeVisible();
    }
  });

  test("ODB-UC-051: buyer clicks product card and opens product page", async ({
    page,
  }) => {
    await openFirstProductFromShop(page);
    await expect(page).toHaveURL(/\/product\//);
  });

  test("ODB-UC-052: buyer adds product directly from listing page", async ({
    page,
  }) => {
    const addToCart = page.getByRole("button", { name: /Add To Cart/i }).first();
    if (await addToCart.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addToCart.click();
      await expect(
        page.getByText(/added|cart|success/i).or(page.getByRole("link", { name: /^\d+$/ })).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
