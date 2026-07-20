import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  logoutBuyer,
  fillLoginForm,
  fillRegisterForm,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  loginBuyer,
  gotoAuthenticatedPage,
} from "../helpers/oneDirectBuyAuth.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Authenticated Buyer Account", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-005: login with valid credentials reaches account dashboard", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/account dashboard|Hello|recent orders/i).first()).toBeVisible();
    await expect(page.getByText(/^Logout$/i)).toBeVisible();
  });

  test("ODB-UC-009: buyer opens account details page", async ({ page }) => {
    await gotoAuthenticatedPage(
      page,
      "/account/user-information",
      ONE_DIRECT_BUY_BUYER_CREDENTIALS
    );
    await expect(
      page.getByText(/password|account details|profile/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("ODB-UC-010: buyer opens addresses page to add shipping address", async ({
    page,
  }) => {
    await gotoAuthenticatedPage(
      page,
      "/account/addresses",
      ONE_DIRECT_BUY_BUYER_CREDENTIALS
    );
    await expect(page.getByRole("heading", { name: /Your Addresses/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ODB-UC-014: buyer logs out successfully", async ({ page }) => {
    await logoutBuyer(page);
    await gotoOneDirectBuy(page, "/account/login");
    await expect(page.getByRole("heading", { name: /Log In Your Account/i })).toBeVisible();
  });

  test("ODB-UC-021: buyer opens account details to change password", async ({
    page,
  }) => {
    await loginBuyer(
      page,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
    );
    await gotoOneDirectBuy(page, "/account/user-information");
    await expect(
      page.getByText(/password|account details|profile/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("OneDirectBuy — Buyer Account (credential flows)", () => {
  test("ODB-UC-006: invalid login handling rejects wrong password", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/login");
    await fillLoginForm(
      page,
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      "WrongPassword999!"
    );
    await page.getByRole("button", { name: /^Login$/i }).click();
    await expect(page).toHaveURL(/\/account\/login/, { timeout: 15_000 });
  });

  test("ODB-UC-007: forgot password link is available on login page", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/login");
    await expect(page.getByRole("link", { name: /Forgot password/i })).toBeVisible();
  });

  test("ODB-UC-015: logged-out user sees login form", async ({ page }) => {
    await page.context().clearCookies();
    await gotoOneDirectBuy(page, "/account/login");
    await expect(page.getByRole("heading", { name: /Log In Your Account/i })).toBeVisible();
  });

  test("ODB-UC-002: prevent duplicate registration with existing email", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/register");
    await fillRegisterForm(page, {
      name: "Duplicate Test",
      email: ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
      password: "TestPass123!",
    });
    await page.getByRole("button", { name: /Create your account/i }).click();
    await expect(
      page
        .locator(".ant-notification-notice")
        .filter({ hasText: /already|exists|in use|failed/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
