import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Error Handling & SEO", () => {
  test("ODB-UC-469: invalid URL shows friendly 404 page", async ({ page }) => {
    await gotoOneDirectBuy(page, "/this-page-does-not-exist-404-test");
    await expect(page.getByText(/Page not found|404|can't find/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-510: friendly 404 page includes homepage link", async ({ page }) => {
    await gotoOneDirectBuy(page, "/missing-route-playwright-test");
    await expect(page.getByRole("link", { name: /Homepage|Home/i }).first()).toBeVisible();
  });

  test("ODB-UC-458: product page includes canonical link when available", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible({ timeout: 60_000 });
    const productLink = page.locator('a[href*="/product/"]').first();
    await productLink.click();
    const canonical = page.locator('link[rel="canonical"]');
    if (await canonical.count()) {
      await expect(canonical).toHaveAttribute("href", /onedirectbuy\.com/);
    }
  });

  test("ODB-UC-460: sitemap is reachable", async ({ request }) => {
    const response = await request.get("https://onedirectbuy.com/sitemap.xml");
    expect(response.status()).toBeLessThan(500);
  });
});
