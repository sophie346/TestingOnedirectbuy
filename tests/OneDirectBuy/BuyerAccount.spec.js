import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy, dismissCookieBanner } from "../helpers/oneDirectBuyNav.js";
import {
  fillRegisterForm,
  uniqueTestEmail,
  hasBuyerCredentials,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Buyer Account (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-385: terms acceptance is shown during signup", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-385", "Conditions of Use + Privacy Notice on register", async () => {
      await gotoOneDirectBuy(page, "/account/register");
      await expect(
        page.getByRole("heading", { name: /^Create your account$/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/Passwords must be at least 6 characters/i),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Conditions of Use/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Privacy Notice/i }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^Sign in$/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Continue with Google$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-003: register form fields are present", async ({ page, soft }) => {
    await soft("ODB-UC-003", "Full name / email / passwords / Create CTA", async () => {
      await gotoOneDirectBuy(page, "/account/register");
      await dismissCookieBanner(page);
      await expect(page.getByRole("textbox", { name: /^Full name$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Email address$/i }),
      ).toBeVisible();
      await expect(page.getByPlaceholder("Create a password")).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Confirm password$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Create your account/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-001: register new buyer account", async ({ page, soft }) => {
    await soft("ODB-UC-001", "Create account with unique email reaches account", async () => {
      const email = uniqueTestEmail();
      await gotoOneDirectBuy(page, "/account/register");
      await fillRegisterForm(page, {
        name: "Test Buyer",
        email,
        password: "TestPass123!",
      });
      await page.getByRole("button", { name: /Create your account/i }).click();
      await expect(
        page
          .locator(".ant-notification-notice")
          .filter({ hasText: /Registration successful|Login successful/i })
          .or(page.getByText(/Hello|account dashboard|recent orders/i).first()),
      ).toBeVisible({ timeout: 45_000 });
    });
  });

  test("ODB-UC-002: prevent duplicate registration with existing email", async ({
    page,
    soft,
  }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Needs ONEDIRECTBUY_BUYER_EMAIL for duplicate signup");
      return;
    }

    await soft("ODB-UC-002", "Existing email shows already/exists notice", async () => {
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
          .filter({ hasText: /already|exists|in use|failed|email/i })
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });
  });

  test("ODB-UC-475: guest visiting orders redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-475", "/account/orders as guest → login, no order table", async () => {
      await page.context().clearCookies();
      await gotoOneDirectBuy(page, "/account/orders");
      await expect(page).toHaveURL(/\/account\/login/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /^Welcome back$/i })).toBeVisible();
      await expect(page.locator("table")).toHaveCount(0);
    });
  });
});
