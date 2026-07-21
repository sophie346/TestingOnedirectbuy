import { test, expect } from "../helpers/softTest.js";
import {
  openStoresPage,
  openFirstStoreDetail,
  searchStores,
  expectProductSellerInfo,
} from "../helpers/oneDirectBuySeller.js";
import { gotoOneDirectBuy, waitForShopProducts } from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Seller Storefront (buyer-facing)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-200: buyer views seller storefront listing page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-200", "Store list + Search vendor + Visit Store", async () => {
      await openStoresPage(page);
      await expect(page).toHaveURL(/\/stores/);
      await expect(page.getByRole("heading", { name: /^Store list$/i })).toBeVisible();
      await expect(page.getByPlaceholder(/Search vendor/i)).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Visit Store/i }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-364: buyer can search seller storefront listing", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-364", "Search vendor filters store directory", async () => {
      await searchStores(page, "auto");
      await expect(
        page
          .locator('a[href*="/store/"]')
          .or(page.getByText(/no store|no result|0 store/i))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-201: buyer opens a store detail page", async ({ page, soft }) => {
    await soft("ODB-UC-201", "Store detail shows Contact Seller + products", async () => {
      await openFirstStoreDetail(page);
      await expect(page).toHaveURL(/\/store\//);
      await expect(
        page.getByRole("button", { name: /^Contact Seller$/i }).or(
          page.getByRole("link", { name: /^Contact Seller$/i }),
        ),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByPlaceholder(/Search in this shop/i)).toBeVisible();
      await expect(page.getByText(/\d+\s+Products found/i)).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-066: product detail shows seller information", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-066", "PDP Sold by label", async () => {
      await expectProductSellerInfo(page);
    });
  });

  test("ODB-UC-047: shop listing exposes product cards", async ({ page, soft }) => {
    await soft("ODB-UC-047", "Shop has Categories + product links", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      await expect(
        page.getByRole("heading", { name: /^Categories$/i }),
      ).toBeVisible();
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    });
  });
});
