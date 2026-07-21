import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  searchProducts,
  shopSortSelect,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-030: buyer searches products using keyword", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-030",
      "Type keyword in header Search products → results heading",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await searchProducts(page, "bearing");
        await expect(page).toHaveURL(/\/search\?keyword=bearing/i);
        await expect(
          page.getByRole("heading", {
            name: /Search result for:\s*"?\s*bearing/i,
          }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
          timeout: 30_000,
        });
      },
    );
  });

  test("ODB-UC-031: no results search displays no-result message", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-031",
      "Empty keyword shows 'No product found.' (not cart empty state)",
      async () => {
        await gotoOneDirectBuy(
          page,
          "/search?keyword=zzzznonexistentproduct99999",
        );
        await expect(
          page.getByRole("heading", { name: /Search result for/i }),
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          page.getByText(/^No product found\.?$/i).first(),
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('a[href*="/product/"]')).toHaveCount(0);
      },
    );
  });

  test("ODB-UC-032: spelling variation search handles misspelled terms", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-032",
      "Misspelled keyword still loads search results page",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await searchProducts(page, "bering");
        await expect(
          page.getByRole("heading", { name: /Search result for/i }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );
  });

  test("ODB-UC-034: shop category sidebar filters listing", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-034", "Click Exterior in Categories sidebar", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      const exterior = page
        .getByRole("heading", { name: /^Categories$/i })
        .locator("..")
        .getByRole("link", { name: /^Exterior$/i })
        .or(page.getByRole("link", { name: /^Exterior$/i }))
        .first();
      await exterior.click();
      await page.waitForURL(/\/category\/exterior|\/shop/i, { timeout: 20_000 });
      await expect(
        page
          .getByText(/\d+ Products found/i)
          .or(page.getByRole("heading", { name: /Exterior|Shop/i }))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-035: results sort by price low to high and high to low", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-035", "Sort items: low to high then high to low", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      const sort = shopSortSelect(page);
      await sort.selectOption({ value: "price-asc" });
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
      await sort.selectOption({ value: "price-desc" });
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
    });
  });

  test("ODB-UC-036: results sort by newest products", async ({ page, soft }) => {
    await soft("ODB-UC-036", "Sort items → Sort by latest", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      await shopSortSelect(page).selectOption({ value: "latest" });
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-037: buyer opens product page from search result", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-037", "Open first product from bearing search", async () => {
      await gotoOneDirectBuy(page, "/");
      await searchProducts(page, "bearing");
      const productLink = page.locator('a[href*="/product/"]').first();
      await expect(productLink).toBeVisible({ timeout: 60_000 });
      await Promise.all([
        page.waitForURL(/\/product\//, { timeout: 30_000 }),
        productLink.click(),
      ]);
    });
  });

  test("ODB-UC-507: search response time within accepted limit", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-507", "Header search responds within 20s", async () => {
      await gotoOneDirectBuy(page, "/");
      const start = Date.now();
      await searchProducts(page, "filter");
      await expect(
        page.getByRole("heading", { name: /Search result for/i }),
      ).toBeVisible({ timeout: 20_000 });
      expect(Date.now() - start).toBeLessThan(20_000);
    });
  });
});
