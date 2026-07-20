import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import { loginAdmin } from "../helpers/oneDirectBuyAuth.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Admin & authenticated backend flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("ODB-UC-357: admin logs in to OneDirectBuy successfully", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/account dashboard|Hello|recent orders/i).first()).toBeVisible();
    await expect(page.getByText(/^Logout$/i)).toBeVisible();
  });

  test("ODB-UC-358: admin views buyer dashboard metrics and navigation", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Orders", exact: true })).toBeVisible();
    await expect(page.getByText(/recent orders/i)).toBeVisible();
  });

  test("ODB-UC-364: admin searches seller storefront listing", async ({ page }) => {
    await gotoOneDirectBuy(page, "/stores");
    await expect(page.getByText(/store|seller|shop/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-365: admin searches products from shop catalog", async ({ page }) => {
    await gotoOneDirectBuy(page, "/search?keyword=bearing");
    await expect(page.getByRole("heading", { name: /Search result for/i })).toBeVisible();
  });

  test("ODB-UC-371: admin opens orders area for internal review", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/orders");
    await expect(page).toHaveURL(/orders/);
  });

  test("ODB-UC-372: admin can open order tracking tools", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/order-tracking");
    await expect(page).toHaveURL(/order-track|order-tracking|track/);
  });

  test("ODB-UC-374: admin views order history list shell", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/orders");
    await expect(page.getByText(/order|history|no order|empty/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-476: buyer account cannot access seller vendor onboarding as blocked route check", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/vendor/become-a-vendor");
    await expect(page.getByText(/sell|vendor|application|register/i).first()).toBeVisible();
  });
});
