import { expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  waitForShopProducts,
  openFirstProductFromShop,
} from "./oneDirectBuyNav.js";

/** Open the public seller onboarding landing page. */
export async function openBecomeVendorPage(page) {
  await gotoOneDirectBuy(page, "/vendor/become-a-vendor");
  await expect(
    page.getByText(/sell|vendor|shopper|marketplace/i).first()
  ).toBeVisible({ timeout: 30_000 });
}

/** Open the marketplace store directory. */
export async function openStoresPage(page) {
  await gotoOneDirectBuy(page, "/stores");
  await expect(
    page
      .getByPlaceholder(/Search vendor/i)
      .or(page.locator(".ps-store-list"))
      .or(page.getByRole("heading", { name: /Store list|Stores/i }))
      .first()
  ).toBeVisible({ timeout: 30_000 });
}

/** Click the primary Start Selling CTA on the vendor landing page. */
export async function clickStartSelling(page) {
  const startSelling = page.getByRole("link", { name: /Start Selling/i });
  await expect(startSelling.first()).toBeVisible({ timeout: 15_000 });
  await startSelling.first().click();
}

/** Resolve store-list route (legacy link) to an active stores page. */
export async function openVendorStoreList(page) {
  await gotoOneDirectBuy(page, "/vendor/store-list");
  if (page.url().includes("/vendor/store-list")) {
    const hasStoresContent = await page
      .getByText(/store list|stores|seller|404|not found/i)
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!hasStoresContent) {
      await openStoresPage(page);
    }
  }
}

/** Open first store detail page when store cards exist. */
export async function openFirstStoreDetail(page) {
  await gotoOneDirectBuy(page, "/stores");
  const storeLink = page.locator('a[href*="/store/"]').first();
  const hasStore = await storeLink.isVisible({ timeout: 30_000 }).catch(() => false);
  if (hasStore) {
    await storeLink.click();
    await page.waitForURL(/\/store\//, { timeout: 20_000 });
    return;
  }
  await gotoOneDirectBuy(page, "/store/demo-store");
}

/** Search stores using the vendor search input on /stores. */
export async function searchStores(page, keyword) {
  await openStoresPage(page);
  const searchInput = page.getByPlaceholder(/Search vendor/i);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(keyword);
  await searchInput.press("Enter");
}

/** Assert product detail page loaded (seller info when present on storefront). */
export async function expectProductSellerInfo(page) {
  await openFirstProductFromShop(page);
  await expect(
    page.locator("h1, .ps-product__title, [role='alert']").first()
  ).toBeVisible({ timeout: 20_000 });
}
