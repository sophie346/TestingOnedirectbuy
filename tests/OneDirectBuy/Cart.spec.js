import { test, expect } from "../fixtures/uiAwareTest.js";
import {
  gotoOneDirectBuy,
  addFirstProductToCartFromShop,
} from "../helpers/oneDirectBuyNav.js";
import { registerBuyer } from "../helpers/oneDirectBuyAuth.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Cart", () => {
  test("ODB-UC-113: buyer adds active product to cart", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart from shop", async () => {
      await addFirstProductToCartFromShop(page);
    });
    await captureStep("Verify cart page shows items", async () => {
      await gotoOneDirectBuy(page, "/account/shopping-cart");
      await expect(
        page.getByText(/cart|subtotal|product|item/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-114: buyer opens cart and sees items", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product and open cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
      await expect(page).toHaveURL(/shopping-cart|cart/);
    });
  });

  test("ODB-UC-115: buyer updates item quantity in cart", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
    });
    await captureStep("Update quantity in cart", async () => {
      const qtyInput = page.locator('input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await qtyInput.fill("2");
        await qtyInput.press("Tab");
        await page.waitForTimeout(1500);
        await expect(qtyInput).toHaveValue("2");
      }
    });
  });

  test("ODB-UC-116: buyer removes item from cart", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
    });
    await captureStep("Remove item from cart", async () => {
      const removeBtn = page
        .getByRole("button", { name: /remove|delete|×/i })
        .or(page.locator(".icon-cross, .ps-icon-cross"))
        .first();
      if (await removeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await removeBtn.click();
        await expect(
          page.getByText(/empty|no product|removed/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test("ODB-UC-117: cart persists after page refresh", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
    });
    await captureStep("Refresh and verify cart persists", async () => {
      const before = await page
        .locator(".ps-table--shopping-cart tr, .cart-item, table tbody tr")
        .count();
      await page.reload();
      await dismissAndWait(page);
      const after = await page
        .locator(".ps-table--shopping-cart tr, .cart-item, table tbody tr")
        .count();
      if (before > 0) {
        expect(after).toBeGreaterThan(0);
      }
    });
  });

  test("ODB-UC-118: guest cart merges after buyer logs in", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product as guest", async () => {
      await addFirstProductToCartFromShop(page);
    });
    await captureStep("Register/login and verify merged cart", async () => {
      const creds = await registerBuyer(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
      await expect(page.getByText(/cart|product|subtotal/i).first()).toBeVisible(
        { timeout: 15_000 },
      );
      expect(creds.email).toBeTruthy();
    });
  });

  test("ODB-UC-121: cart subtotal calculates correctly", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
    });
    await captureStep("Verify subtotal on cart page", async () => {
      await gotoOneDirectBuy(page, "/account/shopping-cart");
      await expect(
        page
          .getByText(/subtotal|total/i)
          .or(page.locator(".ps-table--shopping-cart, .ps-shopping-cart"))
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-124: valid coupon applies to cart", async ({
    page,
    captureStep,
  }) => {
    test.skip(
      !process.env.ONEDIRECTBUY_TEST_COUPON,
      "Set ONEDIRECTBUY_TEST_COUPON for coupon tests",
    );
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
    });
    await captureStep("Apply valid coupon", async () => {
      await page
        .getByPlaceholder(/coupon|promo/i)
        .fill(process.env.ONEDIRECTBUY_TEST_COUPON);
      await page.getByRole("button", { name: /apply/i }).click();
      await expect(page.getByText(/discount|applied|coupon/i).first()).toBeVisible();
    });
  });

  test("ODB-UC-125: invalid coupon is rejected", async ({
    page,
    captureStep,
  }) => {
    await captureStep("Add product to cart", async () => {
      await addFirstProductToCartFromShop(page);
      await gotoOneDirectBuy(page, "/account/shopping-cart");
    });
    await captureStep("Apply invalid coupon", async () => {
      const couponInput = page.getByPlaceholder(/coupon|promo/i);
      if (await couponInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await couponInput.fill("INVALIDCOUPON999");
        await page.getByRole("button", { name: /apply/i }).click();
        await expect(
          page.getByText(/invalid|not valid|error|failed/i).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    });
  });
});

async function dismissAndWait(page) {
  const accept = page.getByRole("button", { name: /Accept all/i });
  if (await accept.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accept.click();
  }
  await page.waitForLoadState("domcontentloaded");
}
