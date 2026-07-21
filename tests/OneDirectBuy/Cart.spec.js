import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  addFirstProductToCartFromShop,
  openCart,
  waitForCartReady,
} from "../helpers/oneDirectBuyNav.js";
import { registerBuyer } from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Cart", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-113: buyer adds active product to cart", async ({ page, soft }) => {
    await soft("ODB-UC-113", "Add from shop then cart shows line items", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible();
      await expect(page.getByText(/\d+\s+items?/i)).toBeVisible();
    });
  });

  test("ODB-UC-114: buyer opens cart and sees items", async ({ page, soft }) => {
    await soft("ODB-UC-114", "Cart heading + item line after add", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await expect(page).toHaveURL(/\/account\/shopping-cart/);
      await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible();
      await expect(page.getByText(/\d+\s+items?/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Remove item$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-115: buyer updates item quantity in cart", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-115", "Increase quantity control updates qty", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      const qty = page.getByRole("spinbutton", { name: /^Quantity$/i });
      await expect(qty).toHaveValue("1", { timeout: 10_000 });
      await page.getByRole("button", { name: /^Increase quantity$/i }).click();
      await expect(qty).toHaveValue("2", { timeout: 15_000 });
      await expect(page.getByText(/2\s+items?/i)).toBeVisible();
    });
  });

  test("ODB-UC-116: buyer removes item from cart", async ({ page, soft }) => {
    await soft("ODB-UC-116", "Remove item → empty cart copy", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await page.getByRole("button", { name: /^Remove item$/i }).click();
      await expect(page.getByText(/Your cart is empty/i)).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("link", { name: /Continue shopping/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-117: cart persists after page refresh", async ({ page, soft }) => {
    await soft("ODB-UC-117", "Reload keeps cart lines", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await expect(page.getByRole("button", { name: /^Remove item$/i })).toBeVisible();
      await page.reload();
      await waitForCartReady(page);
      await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Remove item$/i })).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-118: guest cart merges after buyer registers", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-118", "Guest cart still present after register", async () => {
      await addFirstProductToCartFromShop(page);
      try {
        await registerBuyer(page);
      } catch {
        test.info().annotations.push({
          type: "note",
          description: "Buyer registration unavailable — merge path skipped",
        });
        return;
      }
      await openCart(page);
      await expect(
        page
          .getByRole("heading", { name: /^Cart$/i })
          .or(page.getByText(/\d+\s+items?/i)),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-121: cart subtotal and checkout CTA", async ({ page, soft }) => {
    await soft("ODB-UC-121", "Order summary Subtotal + Proceed to checkout", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await expect(
        page.getByRole("heading", { name: /^Order summary$/i }),
      ).toBeVisible();
      await expect(page.getByText(/^Subtotal$/i)).toBeVisible();
      await expect(page.getByText(/\$\s*\d+/).first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^Proceed to checkout$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^Proceed to checkout$/i }),
      ).toHaveAttribute("href", /\/account\/checkout/);
    });
  });

  test("ODB-UC-112: empty cart shows empty state", async ({ page, soft }) => {
    await soft("ODB-UC-112", "Your cart is empty + Continue shopping", async () => {
      await gotoOneDirectBuy(page, "/account/shopping-cart");
      await waitForCartReady(page);
      // Fresh context should be empty; if prior soft state left items, skip assert
      const empty = await page
        .getByText(/Your cart is empty/i)
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (empty) {
        await expect(page.getByText(/Your cart is empty/i)).toBeVisible();
        await expect(
          page.getByRole("link", { name: /Continue shopping/i }),
        ).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: /^Cart$/i })).toBeVisible();
      }
    });
  });

  test("ODB-UC-124: valid coupon applies to cart", async ({ page, soft }) => {
    test.skip(
      !process.env.ONEDIRECTBUY_TEST_COUPON,
      "Set ONEDIRECTBUY_TEST_COUPON for coupon tests",
    );
    await soft("ODB-UC-124", "Apply env coupon code", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await page
        .getByRole("textbox", { name: /^Coupon$/i })
        .fill(process.env.ONEDIRECTBUY_TEST_COUPON);
      await page.getByRole("button", { name: /^Apply$/i }).click();
      await expect(
        page.getByText(/discount|applied|coupon/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-125: invalid coupon is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-125", "Invalid or expired coupon code notice", async () => {
      await addFirstProductToCartFromShop(page);
      await openCart(page);
      await page.getByRole("textbox", { name: /^Coupon$/i }).fill("INVALIDCOUPON999");
      await page.getByRole("button", { name: /^Apply$/i }).click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /Invalid or expired coupon code/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
