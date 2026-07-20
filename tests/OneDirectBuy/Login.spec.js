import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillLoginForm,
  loginBuyer,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Login", () => {
  test("ODB-UC-005: login form accepts email and password input", async ({ page }) => {
    test.skip(!ONE_DIRECT_BUY_BUYER_CREDENTIALS.password, "Set ONEDIRECTBUY_BUYER_PASSWORD in .env");

    await gotoOneDirectBuy(page, "/account/login");
    await fillLoginForm(
      page,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
    );

    const passwordInput = page.locator("#sign-in input[type='password']").first();
    await expect(passwordInput).toHaveValue(ONE_DIRECT_BUY_BUYER_CREDENTIALS.password);
  });

  test("ODB-UC-005: buyer logs in with configured credentials", async ({ page }) => {
    test.skip(!ONE_DIRECT_BUY_BUYER_CREDENTIALS.password, "Set ONEDIRECTBUY_BUYER_PASSWORD in .env");

    await loginBuyer(
      page,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
    );
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/Hello|account dashboard|recent orders/i).first()).toBeVisible();
  });
});
