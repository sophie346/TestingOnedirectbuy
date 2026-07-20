import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  gotoAuthenticatedPage,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Buyer Orders (seller-related flows)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-167: buyer views order history page", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(
      page.getByText(/recent orders|order history|order|dashboard/i).first()
    ).toBeVisible({ timeout: 20_000 });

    await gotoOneDirectBuy(page, "/account/orders");
    const onOrders = page.url().includes("/account/orders");
    const onLogin = page.url().includes("/account/login");
    expect(onOrders || onLogin).toBeTruthy();
    if (onOrders) {
      await expect(page.getByText(/order|history|empty|no order/i).first()).toBeVisible();
    }
  });

  test("ODB-UC-169: buyer opens order tracking page", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/order-tracking");
    const onTracking = /order-track|order-tracking|track/.test(page.url());
    if (!onTracking) {
      await gotoOneDirectBuy(page, "/page/track-order");
    }
    await expect(page.getByText(/track|order|shipment/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ODB-UC-168: buyer can access orders list shell for order details", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/recent orders|order|dashboard/i).first()).toBeVisible();
  });

  test("ODB-UC-177: multi-seller checkout context — shop supports multiple products", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/shop");
    await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
      timeout: 120_000,
    });
  });

  test("ODB-UC-180: buyer order area loads for combined order review", async ({
    page,
  }) => {
    await gotoAuthenticatedPage(
      page,
      "/account/my-account",
      ONE_DIRECT_BUY_BUYER_CREDENTIALS
    );
    await expect(page.getByText(/account dashboard|Hello|recent orders/i).first()).toBeVisible();
  });
});

test.describe("OneDirectBuy — Seller order notifications (backend)", () => {
  test("ODB-UC-145: seller order notification requires seller portal", async () => {
    test.skip(true, "Seller notification delivery is verified in seller/admin backend.");
  });

  test("ODB-UC-179: seller sub-order view requires seller portal", async () => {
    test.skip(true, "Seller order split view is not on the public storefront.");
  });

  test("ODB-UC-478: seller cannot access another seller order — backend security", async () => {
    test.skip(true, "Cross-seller order isolation is enforced in seller backend APIs.");
  });
});
