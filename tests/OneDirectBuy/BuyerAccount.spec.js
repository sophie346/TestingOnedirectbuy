import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy, dismissCookieBanner } from "../helpers/oneDirectBuyNav.js";
import { fillRegisterForm } from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Buyer Account (public)", () => {
  test("ODB-UC-001: register new buyer account", async ({ page }) => {
    const stamp = Date.now();
    await gotoOneDirectBuy(page, "/account/register");
    await fillRegisterForm(page, {
      name: "Test Buyer",
      email: `odb.new.${stamp}@example.com`,
      password: "TestPass123!",
    });
    await page.getByRole("button", { name: /Create your account/i }).click();
    await expect(
      page.getByText(/Registration successful|Login successful|Hello/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test("ODB-UC-003: validate required signup fields", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/register");
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: /Create your account/i }).click();
    await expect(
      page.locator(".ant-form-item-explain-error, .ant-form-item-explain").filter({
        hasText: /Please input|required|valid email/i,
      }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ODB-UC-385: terms acceptance is shown during signup", async ({ page }) => {
    await gotoOneDirectBuy(page, "/account/register");
    await expect(page.getByText(/Conditions of Use|Privacy Notice/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Conditions of Use/i }).first()).toBeVisible();
  });

  test("ODB-UC-475: guest visiting orders page does not expose order data", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await gotoOneDirectBuy(page, "/account/orders");
    await expect(
      page
        .getByText(/login|sign in|no order|empty|order history/i)
        .or(page.getByRole("link", { name: /Login/i }))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
