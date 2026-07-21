import { expect } from "@playwright/test";
import {
  gotoOneDirectBuy,
  openFirstProductFromShop,
  openKnownProductDetail,
} from "./oneDirectBuyNav.js";

/** Open the public seller onboarding landing page. */
export async function openBecomeVendorPage(page) {
  await gotoOneDirectBuy(page, "/vendor/become-a-vendor");
  await expect(
    page.getByRole("heading", { name: /^Sell on OneDirect Buy$/i }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Open the marketplace store directory and wait for stores to load. */
export async function openStoresPage(page) {
  await gotoOneDirectBuy(page, "/stores");
  await expect(
    page.getByRole("heading", { name: /^Store list$/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder(/Search vendor/i)).toBeVisible();
  await expect(page.getByText(/^Loading\.\.\.$/i))
    .toBeHidden({ timeout: 60_000 })
    .catch(() => {});
  await expect(
    page
      .locator('a[href*="/store/"]')
      .or(page.getByRole("link", { name: /Visit Store/i }))
      .first(),
  ).toBeVisible({ timeout: 60_000 });
}

/** Click a primary Start Selling / Apply CTA → seller application. */
export async function clickStartSelling(page) {
  const startSelling = page
    .getByRole("link", { name: /^Start Selling Today$/i })
    .or(page.getByRole("link", { name: /^Apply Now$/i }))
    .or(page.getByRole("link", { name: /Start seller application/i }))
    .or(page.getByRole("link", { name: /Start Selling/i }));
  await expect(startSelling.first()).toBeVisible({ timeout: 15_000 });
  await Promise.all([
    page.waitForURL(/\/vendor\/seller-application/, { timeout: 20_000 }),
    startSelling.first().click(),
  ]);
}

/** Resolve store-list route to the active /stores directory. */
export async function openVendorStoreList(page) {
  await gotoOneDirectBuy(page, "/vendor/store-list");
  if (/store-list|404|not found/i.test(page.url() + (await page.title()))) {
    await openStoresPage(page);
    return;
  }
  const hasStores = await page
    .getByRole("heading", { name: /^Store list$/i })
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!hasStores) {
    await openStoresPage(page);
  }
}

/** Open first store detail page when store cards exist. */
export async function openFirstStoreDetail(page) {
  await openStoresPage(page);
  const storeLink = page.locator('a[href*="/store/"]').first();
  await expect(storeLink).toBeVisible({ timeout: 30_000 });
  await Promise.all([
    page.waitForURL(/\/store\//, { timeout: 20_000 }),
    storeLink.click(),
  ]);
  await expect(page.getByText(/Loading store/i))
    .toBeHidden({ timeout: 45_000 })
    .catch(() => {});
}

/** Search stores using the vendor search input on /stores. */
export async function searchStores(page, keyword) {
  await openStoresPage(page);
  const searchInput = page.getByPlaceholder(/Search vendor/i);
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  await searchInput.fill(keyword);
  await searchInput.press("Enter");
}

/** Assert product detail shows Sold by / seller info. */
export async function expectProductSellerInfo(page) {
  await openKnownProductDetail(page, "bearing").catch(async () => {
    await openFirstProductFromShop(page);
  });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Sold by\s*:/i).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Open seller application form. */
export async function openSellerApplication(page) {
  await gotoOneDirectBuy(page, "/vendor/seller-application");
  await expect(
    page.getByRole("heading", { name: /Apply to sell on OneDirect Buy/i }),
  ).toBeVisible({ timeout: 30_000 });
}
