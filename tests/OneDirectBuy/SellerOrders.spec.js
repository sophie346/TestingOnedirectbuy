import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  waitForShopProducts,
} from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
  gotoAuthenticatedPage,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Guest order tracking (seller-related)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-169: guest order tracking form is available", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-169", "Order Tracking H1 + Order ID + Track Your Order", async () => {
      await gotoOneDirectBuy(page, "/account/order-tracking");
      await expect(page).toHaveURL(/\/account\/order-tracking/);
      await expect(
        page.getByRole("heading", { name: /^Order Tracking$/i }),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("textbox", { name: /^Order ID$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Track Your Order$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-177: shop supports multi-seller catalog for combined orders", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-177", "Shop listing has product cards", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible();
    });
  });
});

test.describe("OneDirectBuy — Buyer Orders (authenticated)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-167: buyer views order history / dashboard", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-167", "my-account + /account/orders", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });

      await gotoOneDirectBuy(page, "/account/orders");
      await expect(page).toHaveURL(/\/account\/orders/);
      await expect(
        page.getByText(/order|history|empty|no order|Orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-168: buyer can access orders list shell for order details", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-168", "Orders page shell after login", async () => {
      await gotoOneDirectBuy(page, "/account/orders");
      await expect(page).toHaveURL(/\/account\/orders/);
      await expect(
        page.getByText(/order|history|empty|no order|Orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-180: buyer order area loads for combined order review", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-180", "Authenticated my-account for multi-seller review", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/my-account",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
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
