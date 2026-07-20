import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillLoginForm,
  loginBuyer,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Login", () => {
  test("ODB-UC-005: login form accepts email and password input", async ({
    page,
    soft,
  }) => {
    if (!ONE_DIRECT_BUY_BUYER_CREDENTIALS.password) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_PASSWORD in .env / GitHub secrets");
      return;
    }

    await soft("ODB-UC-005-a", "Login form accepts email and password", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await fillLoginForm(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      const passwordInput = page.locator("#sign-in input[type='password']").first();
      await expect(passwordInput).toHaveValue(ONE_DIRECT_BUY_BUYER_CREDENTIALS.password);
    });
  });

  test("ODB-UC-005: buyer logs in with configured credentials", async ({
    page,
    soft,
  }) => {
    if (!ONE_DIRECT_BUY_BUYER_CREDENTIALS.password) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_PASSWORD in .env / GitHub secrets");
      return;
    }

    await soft("ODB-UC-005-b", "Buyer can log in and reach my-account", async () => {
      await loginBuyer(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/Hello|account dashboard|recent orders/i).first(),
      ).toBeVisible();
    });
  });
});
