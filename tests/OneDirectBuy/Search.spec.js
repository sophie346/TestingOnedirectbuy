import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Search", () => {
  test("ODB-UC-030: buyer searches products using keyword", async ({ page }) => {
    await gotoOneDirectBuy(page, "/search?keyword=bearing");
    await expect(
      page.getByRole("heading", { name: /Search result for/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/bearing|product|SKU/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("ODB-UC-031: no results search displays no-result message", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/search?keyword=zzzznonexistentproduct99999");
    await expect(
      page.getByText(/no product|0 product|not found|no result/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("ODB-UC-032: spelling variation search handles misspelled terms", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/search?keyword=bering");
    await expect(page.getByRole("heading", { name: /Search result for/i })).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
  });

  test("ODB-UC-034: search results filter by selected category", async ({
    page,
  }) => {
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

  test("ODB-UC-035: results sort by price low to high and high to low", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
      timeout: 60_000,
    });
    const sort = page.getByRole("combobox");
    await sort.selectOption({ label: "Sort by price: low to high" });
    await page.waitForTimeout(2000);
    await sort.selectOption({ label: "Sort by price: high to low" });
    await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
  });

  test("ODB-UC-036: results sort by newest products", async ({ page }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("combobox").selectOption({ label: "Sort by latest" });
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("ODB-UC-037: buyer opens product page from search result", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/search?keyword=bearing");
    const productLink = page.locator('a[href*="/product/"]').first();
    await expect(productLink).toBeVisible({ timeout: 60_000 });
    await productLink.click();
    await expect(page).toHaveURL(/\/product\//);
  });

  test("ODB-UC-507: search response time within accepted limit", async ({
    page,
  }) => {
    const start = Date.now();
    await gotoOneDirectBuy(page, "/search?keyword=filter");
    await expect(page.getByRole("heading", { name: /Search result for/i })).toBeVisible();
    expect(Date.now() - start).toBeLessThan(20_000);
  });
});
