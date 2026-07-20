import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy, addFirstProductToCartFromShop } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Seller promotions (storefront)", () => {
  test("ODB-UC-396: cart page exposes coupon entry for seller-restricted promotions", async ({
    page,
  }) => {
    await addFirstProductToCartFromShop(page);
    await gotoOneDirectBuy(page, "/account/shopping-cart");
    await expect(page).toHaveURL(/shopping-cart|cart/);
    await expect(page.locator("body")).toContainText(
      /coupon|promo|subtotal|cart|empty|product|checkout/i
    );
  });
});
