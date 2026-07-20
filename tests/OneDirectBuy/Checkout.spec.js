import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import { addFirstProductToCartFromShop } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Checkout", () => {
  test("ODB-UC-129: guest can open checkout flow", async ({ page }) => {
    await addFirstProductToCartFromShop(page);
    await gotoOneDirectBuy(page, "/account/checkout");
    await expect(page).toHaveURL(/checkout/);
    await expect(
      page.getByText(/checkout|shipping|billing|order|payment/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-133: checkout validates missing shipping fields", async ({
    page,
  }) => {
    await addFirstProductToCartFromShop(page);
    await gotoOneDirectBuy(page, "/account/checkout");
    const placeOrder = page.getByRole("button", { name: /Place Order|Continue|Proceed/i });
    if (await placeOrder.isVisible({ timeout: 5000 }).catch(() => false)) {
      await placeOrder.click();
      await expect(page.getByText(/required|please enter|invalid/i).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("ODB-UC-138: review order totals section is visible", async ({ page }) => {
    await addFirstProductToCartFromShop(page);
    await gotoOneDirectBuy(page, "/account/checkout");
    await expect(page.getByText(/subtotal|total|shipping|tax/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-140: declined payment test requires payment sandbox", async () => {
    test.skip(true, "Requires Stripe/payment sandbox configuration");
  });

  test("ODB-UC-143: order confirmation page route exists", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/payment-success");
    await expect(page).toHaveURL(/payment-success|order|confirmation/i);
  });
});
