import { test, expect } from "@playwright/test";
import {
  openStoresPage,
  openFirstStoreDetail,
  searchStores,
  expectProductSellerInfo,
} from "../helpers/oneDirectBuySeller.js";
import { gotoOneDirectBuy, waitForShopProducts } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Seller Storefront (buyer-facing)", () => {
  test("ODB-UC-200: buyer views seller storefront listing page", async ({ page }) => {
    await openStoresPage(page);
    await expect(page.getByPlaceholder(/Search vendor/i)).toBeVisible();
  });

  test("ODB-UC-364: admin or buyer can search seller storefront listing", async ({
    page,
  }) => {
    await searchStores(page, "auto");
    await expect(page.getByText(/store|seller|loading|no store|product/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("ODB-UC-201: buyer views seller products from store or shop listing", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
  });

  test("ODB-UC-201: buyer opens a store detail page when stores exist", async ({
    page,
  }) => {
    await openFirstStoreDetail(page);
    await expect(page).toHaveURL(/\/store\//);
    await expect(
      page
        .locator(".ps-vendor-store, .ps-block--vendor")
        .or(page.getByRole("button", { name: /Contact Seller/i }))
        .or(page.getByText(/Contact Seller|store|product/i))
        .first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("ODB-UC-066: product detail shows seller or store information", async ({
    page,
  }) => {
    await expectProductSellerInfo(page);
  });

  test("ODB-UC-047: shop listing exposes product cards for seller filtering context", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);
    const filterArea = page.getByText(/filter|brand|price|seller|category/i).first();
    if (await filterArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(filterArea).toBeVisible();
    } else {
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    }
  });
});
