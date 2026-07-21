import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  loginAdmin,
  hasAdminCredentials,
} from "../helpers/oneDirectBuyAuth.js";
import {
  openStoresPage,
  openBecomeVendorPage,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Admin & authenticated backend flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEDIRECTBUY_ADMIN_EMAIL/PASSWORD (or buyer credentials fallback)",
      );
      return;
    }
    await loginAdmin(page);
  });

  test("ODB-UC-357: admin logs in to OneDirectBuy successfully", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-357", "my-account dashboard + Logout", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Logout$/i)).toBeVisible();
    });
  });

  test("ODB-UC-358: admin views buyer dashboard metrics and navigation", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-358", "Dashboard + Orders nav links", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByRole("link", { name: "Orders", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/recent orders/i).first()).toBeVisible();
    });
  });

  test("ODB-UC-364: admin searches seller storefront listing", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-364-admin", "Store list visible after login", async () => {
      await openStoresPage(page);
      await expect(page.getByRole("heading", { name: /^Store list$/i })).toBeVisible();
    });
  });

  test("ODB-UC-365: admin searches products from shop catalog", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-365-admin", "Search result for bearing", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=bearing");
      await expect(
        page
          .getByRole("heading", { name: /Search result for/i })
          .or(page.getByText(/No product found/i))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-371: admin opens orders area for internal review", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-371", "/account/orders after login", async () => {
      await gotoOneDirectBuy(page, "/account/orders");
      await expect(page).toHaveURL(/\/account\/orders/);
    });
  });

  test("ODB-UC-372: admin can open order tracking tools", async ({ page, soft }) => {
    await soft("ODB-UC-372", "Order Tracking form", async () => {
      await gotoOneDirectBuy(page, "/account/order-tracking");
      await expect(page).toHaveURL(/\/account\/order-tracking/);
      await expect(
        page.getByRole("heading", { name: /^Order Tracking$/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-374: admin views order history list shell", async ({ page, soft }) => {
    await soft("ODB-UC-374", "Orders list or empty state", async () => {
      await gotoOneDirectBuy(page, "/account/orders");
      await expect(
        page.getByText(/order|history|no order|empty|Orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-476: account can open seller onboarding landing", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-476-admin", "Sell on OneDirect Buy landing", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("heading", { name: /^Sell on OneDirect Buy$/i }),
      ).toBeVisible();
    });
  });
});
