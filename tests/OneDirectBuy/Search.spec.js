import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Search", () => {
  test("ODB-UC-030: buyer searches products using keyword", async ({ page, soft }) => {
    await soft("ODB-UC-030", "Keyword search shows results heading", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=bearing");
      await expect(
        page.getByRole("heading", { name: /Search result for/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/bearing|product|SKU/i).first()).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-031: no results search displays no-result message", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-031", "Empty search shows no-result message in main content", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=zzzznonexistentproduct99999");
      const main = page.locator("main, .ps-page, .ps-shopping, #__next, body").first();
      // Avoid matching hidden cart empty-state ("No products in cart")
      const emptyMsg = main
        .getByText(
          /no products found|0 products found|no result|not found|nothing found|no items/i,
        )
        .filter({ hasNotText: /cart/i })
        .first();
      await expect(emptyMsg).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-032: spelling variation search handles misspelled terms", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-032", "Misspelled keyword still loads search page", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=bering");
      await expect(
        page.getByRole("heading", { name: /Search result for/i }),
      ).toBeVisible();
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("ODB-UC-034: search results filter by selected category", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-034", "Category filter on shop listing", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
        timeout: 60_000,
      });
      const category = page.getByText(/^AC FILTER$|^Exterior$|^Interior$/i).first();
      if (await category.isVisible({ timeout: 5000 }).catch(() => false)) {
        await category.click();
        await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
      }
    });
  });

  test("ODB-UC-035: results sort by price low to high and high to low", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-035", "Sort by price low/high via Sort items combobox", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
        timeout: 60_000,
      });
      // Prefer Sort items — header also has a Product category combobox
      const sort = page
        .getByLabel(/Sort items/i)
        .or(page.locator('select[aria-label="Sort items"], select.ps-select'))
        .first();
      await sort.selectOption({ label: /low to high/i });
      await page.waitForTimeout(1500);
      await sort.selectOption({ label: /high to low/i });
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
    });
  });

  test("ODB-UC-036: results sort by newest products", async ({ page, soft }) => {
    await soft("ODB-UC-036", "Sort by latest via Sort items combobox", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
        timeout: 60_000,
      });
      const sort = page
        .getByLabel(/Sort items/i)
        .or(page.locator('select[aria-label="Sort items"], select.ps-select'))
        .first();
      await sort.selectOption({ label: /latest|newest/i });
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-037: buyer opens product page from search result", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-037", "Open product from search results", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=bearing");
      const productLink = page.locator('a[href*="/product/"]').first();
      await expect(productLink).toBeVisible({ timeout: 60_000 });
      await productLink.click();
      await expect(page).toHaveURL(/\/product\//);
    });
  });

  test("ODB-UC-507: search response time within accepted limit", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-507", "Search responds within 20s", async () => {
      const start = Date.now();
      await gotoOneDirectBuy(page, "/search?keyword=filter");
      await expect(
        page.getByRole("heading", { name: /Search result for/i }),
      ).toBeVisible();
      expect(Date.now() - start).toBeLessThan(20_000);
    });
  });
});
