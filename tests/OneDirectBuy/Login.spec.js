import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  fillLoginForm,
  loginBuyer,
  hasBuyerCredentials,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-015: logged-out user sees login form", async ({ page, soft }) => {
    await soft("ODB-UC-015", "Welcome back + Sign in controls", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await expect(page.getByRole("heading", { name: /^Welcome back$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toBeVisible();
      await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
      await expect(page.getByRole("checkbox", { name: /^Remember me$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Continue with Google$/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^Create one$/i })).toBeVisible();
    });
  });

  test("ODB-UC-007: forgot password link is available on login page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-007", "Forgot password? link present", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await expect(
        page.getByRole("link", { name: /Forgot password\?/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-005: login form accepts email and password input", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-005-a", "Email/password fields accept typed values", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      const email = "probe@example.com";
      const password = "ProbePass123!";
      await fillLoginForm(page, email, password);
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toHaveValue(email);
      await expect(page.getByPlaceholder("Enter your password")).toHaveValue(password);
    });
  });

  test("ODB-UC-006: invalid login is rejected", async ({ page, soft }) => {
    await soft("ODB-UC-006", "Sign-in failed notice for bad credentials", async () => {
      await gotoOneDirectBuy(page, "/account/login");
      await fillLoginForm(page, "nobody-invalid@example.com", "WrongPassword999!");
      await page.getByRole("button", { name: /^Sign in$/i }).click();
      await expect(
        page.locator(".ant-notification-notice").filter({
          hasText: /Sign-in failed|email or password is incorrect/i,
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/account\/login/);
    });
  });

  test("ODB-UC-005: buyer logs in with configured credentials", async ({
    page,
    soft,
  }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
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
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
