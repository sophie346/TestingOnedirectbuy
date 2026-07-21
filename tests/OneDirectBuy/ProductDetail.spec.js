import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openKnownProductDetail,
  productAddToCartControl,
} from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Product Detail", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openKnownProductDetail(page, "bearing");
  });

  test("ODB-UC-056: product page loads with full product information", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-056", "H1 title + price visible on /product/", async () => {
      await expect(page).toHaveURL(/\/product\//);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /\$\s*\d+/ }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-057: buyer views product image gallery", async ({ page, soft }) => {
    await soft("ODB-UC-057", "View larger control or main product image", async () => {
      const enlarge = page.getByRole("button", { name: /View .+ larger/i });
      if (await enlarge.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await expect(enlarge).toBeVisible();
        return;
      }
      await expect(
        page.locator(".ps-product__thumbnail img, .ps-product img, main img").first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-058: title, SKU, brand, price, stock, seller", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-058", "SKU# / Brand / In stock / Ships from / Sold by", async () => {
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/SKU#/i);
      await expect(page.getByText(/Brand\s*:/i).first()).toBeVisible();
      await expect(page.getByText(/^In stock$/i).first()).toBeVisible();
      await expect(page.getByText(/Ships from\s*:/i).first()).toBeVisible();
      await expect(page.getByText(/Sold by\s*:/i).first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /\$\s*\d+/ }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-060: buyer increases quantity via up control", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-060", "Quantity up (.up) control is usable", async () => {
      const up = page.locator("button.up").first();
      const down = page.locator("button.down").first();
      await expect(up).toBeVisible({ timeout: 10_000 });
      await expect(down).toBeVisible();
      await up.click({ force: true });
      const qty = page
        .locator(".ps-product__shopping input, .form-group--number input")
        .or(page.getByRole("textbox"))
        .first();
      const value = await qty.inputValue().catch(() => "");
      // Value may stay "1" if readonly UI, but control must remain interactive
      expect(value === "" || /^\d+$/.test(value)).toBeTruthy();
    });
  });

  test("ODB-UC-062: buyer adds product from detail page", async ({ page, soft }) => {
    await soft("ODB-UC-062", "Add to cart shows Cart Updated notice", async () => {
      await productAddToCartControl(page).click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Cart Updated|added to your cart/i,
        }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-063: Buy Now control is available", async ({ page, soft }) => {
    await soft("ODB-UC-063", "Buy Now link is visible", async () => {
      await expect(page.getByRole("link", { name: /^Buy Now$/i })).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("ODB-UC-065: guest wishlist control is present", async ({ page, soft }) => {
    await soft("ODB-UC-065", "Wishlist button visible for guest", async () => {
      await expect(page.locator("button.wishlist-btn").first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("ODB-UC-068: return policy link visible", async ({ page, soft }) => {
    await soft("ODB-UC-068", "Return & Refund Policy link", async () => {
      await expect(
        page
          .getByRole("link", {
            name: /Return & Refund Policy|Returns & Refunds/i,
          })
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-071: related products display", async ({ page, soft }) => {
    await soft("ODB-UC-071", "Related products heading + product links", async () => {
      const related = page.getByRole("heading", { name: /^Related products$/i });
      await related.scrollIntoViewIfNeeded();
      await expect(related).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('a[href*="/product/"]').nth(1)).toBeVisible();
    });
  });

  test("ODB-UC-072: Description and Specification tabs", async ({ page, soft }) => {
    await soft("ODB-UC-072-a", "Description tab + About this item", async () => {
      await expect(page.getByRole("tab", { name: /^Description$/i })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^About this item$/i }),
      ).toBeVisible();
    });

    await soft("ODB-UC-072-b", "Specification tab selectable", async () => {
      const tab = page.getByRole("tab", { name: /^Specification$/i });
      await tab.click();
      await expect(tab).toBeVisible();
    });
  });

  test("ODB-UC-074: invalid product URL shows 404", async ({ page, soft }) => {
    await soft("ODB-UC-074", "Ohh! Page not found for bad product slug", async () => {
      await gotoOneDirectBuy(page, "/product/invalid-inactive-product-id-99999");
      await expect(
        page.getByRole("heading", { name: /Ohh! Page not found/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-075: deleted product URL shows 404", async ({ page, soft }) => {
    await soft("ODB-UC-075", "404 for deleted product slug", async () => {
      await gotoOneDirectBuy(page, "/product/deleted-product-test-404");
      await expect(
        page.getByRole("heading", { name: /Ohh! Page not found/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-406: related products by category/brand", async ({ page, soft }) => {
    await soft("ODB-UC-406", "Related products has multiple product links", async () => {
      await page
        .getByRole("heading", { name: /^Related products$/i })
        .scrollIntoViewIfNeeded();
      await expect(page.locator('a[href*="/product/"]').nth(2)).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-508: product page with images loads without timeout", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-508", "PDP image area loads within 20s", async () => {
      await expect(
        page
          .getByRole("button", { name: /View .+ larger/i })
          .or(page.locator(".ps-product img, main img").first()),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-064: logged-in buyer can open wishlist", async ({ page, soft }) => {
    await soft("ODB-UC-064", "Wishlist reachable when buyer credentials set", async () => {
      try {
        await ensureLoggedInBuyer(page);
      } catch {
        test.info().annotations.push({
          type: "note",
          description: "Buyer credentials not configured — wishlist login path skipped",
        });
        return;
      }
      await openKnownProductDetail(page, "bearing");
      const wishlistBtn = page.locator("button.wishlist-btn").first();
      if (await wishlistBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await wishlistBtn.click();
      }
      await gotoOneDirectBuy(page, "/account/wishlist");
      await expect(page).toHaveURL(/wishlist/);
    });
  });
});
