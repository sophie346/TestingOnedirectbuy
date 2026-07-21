import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  logoutBuyer,
  hasBuyerCredentials,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  loginBuyer,
  gotoAuthenticatedPage,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Authenticated Buyer Account", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-005: login with valid credentials reaches account dashboard", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-005-auth", "my-account shows dashboard + Logout", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/^Logout$/i)).toBeVisible();
    });
  });

  test("ODB-UC-009: buyer opens account details page", async ({ page, soft }) => {
    await soft("ODB-UC-009", "Account information page loads", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/user-information",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      await expect(
        page.getByText(/password|account details|profile|information/i).first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-010: buyer opens addresses page", async ({ page, soft }) => {
    await soft("ODB-UC-010", "Your Addresses heading", async () => {
      await gotoAuthenticatedPage(
        page,
        "/account/addresses",
        ONE_DIRECT_BUY_BUYER_CREDENTIALS,
      );
      await expect(
        page.getByRole("heading", { name: /Your Addresses/i }),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-014: buyer logs out successfully", async ({ page, soft }) => {
    await soft("ODB-UC-014", "Logout returns to Welcome back login", async () => {
      await logoutBuyer(page);
      await gotoOneDirectBuy(page, "/account/login");
      await expect(page.getByRole("heading", { name: /^Welcome back$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    });
  });

  test("ODB-UC-021: buyer opens account details to change password", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-021", "user-information shows password/profile copy", async () => {
      await loginBuyer(
        page,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
        ONE_DIRECT_BUY_BUYER_CREDENTIALS.password,
      );
      await gotoOneDirectBuy(page, "/account/user-information");
      await expect(
        page.getByText(/password|account details|profile|information/i).first(),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
