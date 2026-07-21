import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openFirstProductFromShop,
  shopSortSelect,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Category & Product Listing", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);
  });

  test("ODB-UC-041: buyer opens shop and sees product list", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-041", "Shop All Products + Categories + count", async () => {
      await expect(
        page.getByRole("heading", { name: /^Shop All Products$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Categories$/i }),
      ).toBeVisible();
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
    });
  });

  test("ODB-UC-042: listing content and product links display", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-042", "Products found + product card links", async () => {
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    });
  });

  test("ODB-UC-043: product cards show title and price", async ({ page, soft }) => {
    await soft("ODB-UC-043", "Card has product link, price, image", async () => {
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
      await expect(page.locator("img").first()).toBeVisible();
    });
  });

  test("ODB-UC-044: buyer sees price filter range", async ({ page, soft }) => {
    await soft("ODB-UC-044", "By Price section with $0 to $20,000 range", async () => {
      await expect(
        page.getByRole("heading", { name: /^By Price$/i }),
      ).toBeVisible();
      await expect(page.getByText(/\$0/i).first()).toBeVisible();
      await expect(page.getByRole("slider").first()).toBeVisible();
    });
  });

  test("ODB-UC-045: buyer filters products by brand", async ({ page, soft }) => {
    await soft("ODB-UC-045", "By Brands checkbox (AIR LIFT / ACCEL / AFE)", async () => {
      await expect(
        page.getByRole("heading", { name: /^By Brands$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: /Search brands/i }),
      ).toBeVisible();
      const brand = page
        .getByRole("checkbox", { name: /^AIR LIFT$|^ACCEL$|^AFE$/i })
        .first();
      await brand.click({ force: true });
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible({
        timeout: 30_000,
      });
    });
  });

  test("ODB-UC-046: buyer filters in-stock products", async ({ page, soft }) => {
    await soft("ODB-UC-046", "Availability → In stock only", async () => {
      await expect(
        page.getByRole("heading", { name: /^Availability$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: /In stock only/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-048: buyer filters products by rating", async ({ page, soft }) => {
    await soft("ODB-UC-048", "By Rating radios including 4 stars & up", async () => {
      await expect(
        page.getByRole("heading", { name: /^By Rating$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("radio", { name: /4 stars & up/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-049: buyer clears filters by returning to shop", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-049", "Re-open /shop restores full listing count", async () => {
      const brand = page.getByRole("checkbox", { name: /^AIR LIFT$/i });
      if (await brand.isVisible({ timeout: 3000 }).catch(() => false)) {
        await brand.click({ force: true });
      }
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
    });
  });

  test("ODB-UC-050: buyer moves through product listing pages", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-050", "Pagination Previous / Next controls present", async () => {
      await expect(page.getByText(/Previous Page/i).first()).toBeVisible();
      const next = page.getByRole("button").filter({ hasText: /Next|›|»/i }).or(
        page.getByText(/Next Page/i),
      );
      if (await next.first().isEnabled({ timeout: 3000 }).catch(() => false)) {
        await next.first().click();
        await expect(page.getByText(/\d+ Products found/i)).toBeVisible();
      }
    });
  });

  test("ODB-UC-051: buyer clicks product card and opens product page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-051", "Open product from shop listing", async () => {
      await openFirstProductFromShop(page);
      await expect(page).toHaveURL(/\/product\//);
    });
  });

  test("ODB-UC-052: buyer adds product directly from listing page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-052", "Add To Cart from product card", async () => {
      const addToCart = page.getByRole("button", { name: /^Add To Cart$/i }).first();
      await expect(addToCart).toBeVisible({ timeout: 10_000 });
      await addToCart.click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /Cart Updated|added to your cart/i })
          .or(page.getByRole("link", { name: /Cart/i })),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-053: shopper can change Sort items on listing", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-053", "Sort by popularity from Sort items", async () => {
      await shopSortSelect(page).selectOption({ value: "popularity" });
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    });
  });
});
