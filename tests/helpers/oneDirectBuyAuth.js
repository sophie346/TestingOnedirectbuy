import { expect } from "@playwright/test";
import { gotoOneDirectBuy, dismissCookieBanner } from "./oneDirectBuyNav.js";

export const ONE_DIRECT_BUY_BUYER_CREDENTIALS = {
  email: process.env.ONEDIRECTBUY_BUYER_EMAIL || "",
  password: process.env.ONEDIRECTBUY_BUYER_PASSWORD || "",
};

export const ONE_DIRECT_BUY_ADMIN_CREDENTIALS = {
  email:
    process.env.ONEDIRECTBUY_ADMIN_EMAIL ||
    process.env.ONEDIRECTBUY_BUYER_EMAIL ||
    "",
  password:
    process.env.ONEDIRECTBUY_ADMIN_PASSWORD ||
    process.env.ONEDIRECTBUY_BUYER_PASSWORD ||
    "",
};

export function hasBuyerCredentials() {
  return Boolean(
    ONE_DIRECT_BUY_BUYER_CREDENTIALS.email &&
      ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
  );
}

export function hasAdminCredentials() {
  return Boolean(
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.email &&
      ONE_DIRECT_BUY_ADMIN_CREDENTIALS.password
  );
}

export function uniqueTestEmail() {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  return `odb.playwright.${stamp}@example.com`;
}

const DEFAULT_PASSWORD = "TestPass123!";

/** Reliably type into Ant Design / React controlled inputs. */
export async function fillInputField(locator, value) {
  await expect(locator).toBeVisible({ timeout: 15_000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 30 });
  await expect(locator).toHaveValue(value, { timeout: 10_000 });
}

/** Fill the OneDirectBuy login form (email + password). */
export async function fillLoginForm(page, email, password) {
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: /Welcome back/i }),
  ).toBeVisible({ timeout: 30_000 });

  const emailInput = page
    .getByRole("textbox", { name: /^Email address$/i })
    .or(page.getByPlaceholder("you@example.com"))
    .or(page.locator("#sign-in input[type='text']"))
    .first();

  const passwordInput = page
    .getByPlaceholder("Enter your password")
    .or(page.getByRole("textbox", { name: /^Password$/i }))
    .or(page.locator("#sign-in input[type='password']"))
    .or(page.locator("input[type='password']"))
    .first();

  await fillInputField(emailInput, email);
  await fillInputField(passwordInput, password);
}

/** Fill the OneDirectBuy registration form. */
export async function fillRegisterForm(page, { name, email, password }) {
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: /Create your account/i }),
  ).toBeVisible({ timeout: 30_000 });

  await fillInputField(
    page
      .getByRole("textbox", { name: /^Full name$/i })
      .or(page.getByPlaceholder("Your name"))
      .first(),
    name,
  );
  await fillInputField(
    page
      .getByRole("textbox", { name: /^Email address$/i })
      .or(page.getByPlaceholder("you@example.com"))
      .first(),
    email,
  );
  await fillInputField(
    page
      .getByPlaceholder("Create a password")
      .or(page.locator("input[type='password']").first())
      .first(),
    password,
  );
  await fillInputField(
    page
      .getByRole("textbox", { name: /^Confirm password$/i })
      .or(page.getByPlaceholder("Re-enter password"))
      .or(page.locator("input[type='password']").nth(1))
      .first(),
    password,
  );
}

/** Account dashboard region (avoids AI chat / header false matches). */
export function accountDashboard(page) {
  return page
    .locator(
      ".ps-section--account, .ps-page--account, .ps-widget--account-dashboard, main .ps-section",
    )
    .first();
}

/** Assert the session is authenticated. */
export async function expectLoggedIn(page) {
  const successNotice = page.locator(".ant-notification-notice").filter({
    hasText: /Login successful|Registration successful/i,
  });
  if (await successNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  if (!page.url().includes("/account/my-account")) {
    await gotoOneDirectBuy(page, "/account/my-account");
  }

  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 15_000 });

  // Site may still show header Login while account sidebar is authenticated.
  const dash = accountDashboard(page);
  await expect(
    dash
      .getByText(/^Hello\b/i)
      .or(dash.getByText(/account dashboard/i))
      .or(dash.getByRole("heading", { name: /Hello|Dashboard|My Account/i }))
      .or(page.getByRole("heading", { name: /^Hello\b/i }))
      .first(),
  ).toBeVisible({ timeout: 30_000 });

  await expect(
    page
      .locator(".ps-widget--account-dashboard")
      .getByText(/^Logout$/i)
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

const ACCOUNT_SIDEBAR_LINKS = {
  "/account/orders": /Orders/i,
  "/account/addresses": /Address/i,
  "/account/user-information": /Account Information/i,
  "/account/wishlist": /Wishlist/i,
};

/** Navigate to a protected page and re-login if Firebase auth has not hydrated yet. */
export async function gotoAuthenticatedPage(page, path, credentials) {
  await loginBuyer(page, credentials.email, credentials.password);

  const normalizedPath = path.replace(/\/$/, "") || path;
  const sidebarPattern = ACCOUNT_SIDEBAR_LINKS[normalizedPath];

  if (sidebarPattern) {
    await gotoOneDirectBuy(page, "/account/my-account");
    const sidebarLink = page
      .locator(".ps-widget--account-dashboard a, aside.ps-widget--account-dashboard a")
      .filter({ hasText: sidebarPattern })
      .first();
    if (await sidebarLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await sidebarLink.click();
      await expect(page).toHaveURL(new RegExp(normalizedPath.replace(/\//g, "\\/")), {
        timeout: 30_000,
      });
      return;
    }
  }

  await gotoOneDirectBuy(page, path);
  if (page.url().includes("/account/login")) {
    await loginBuyer(page, credentials.email, credentials.password);
    await gotoOneDirectBuy(page, path);
  }
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 15_000 });
}

/** Click the account sidebar logout control (not the hidden header dropdown link). */
export async function clickLogout(page) {
  await gotoOneDirectBuy(page, "/account/my-account");
  const sidebarLogout = page
    .locator(".ps-widget--account-dashboard .ps-widget__content")
    .getByText(/^Logout$/i)
    .first();
  await expect(sidebarLogout).toBeVisible({ timeout: 15_000 });
  await sidebarLogout.scrollIntoViewIfNeeded();
  await sidebarLogout.click();
}

/**
 * Register a new buyer account on OneDirectBuy.
 * @returns {{ email: string; password: string; name: string }}
 */
export async function registerBuyer(page, overrides = {}) {
  const email = overrides.email || uniqueTestEmail();
  const password = overrides.password || DEFAULT_PASSWORD;
  const name = overrides.name || "Playwright Test Buyer";

  await gotoOneDirectBuy(page, "/account/register");
  await fillRegisterForm(page, { name, email, password });
  await page.getByRole("button", { name: /Create your account/i }).click();
  await expectLoggedIn(page);
  return { email, password, name };
}

/** Log in with email and password. */
export async function loginBuyer(page, email, password) {
  await gotoOneDirectBuy(page, "/account/login");
  await fillLoginForm(page, email, password);
  await page
    .getByRole("button", { name: /^Sign in$/i })
    .or(page.getByRole("button", { name: /^Login$/i }))
    .first()
    .click();
  await expectLoggedIn(page);
}

/** Log out from the account menu. */
export async function logoutBuyer(page) {
  await clickLogout(page);
  await expect(page).toHaveURL(/\/account\/login|\//, { timeout: 15_000 });
}

/** Ensure a logged-in buyer using configured credentials. */
export async function ensureLoggedInBuyer(page) {
  if (!hasBuyerCredentials()) {
    throw new Error(
      "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD in .env"
    );
  }
  await loginBuyer(
    page,
    ONE_DIRECT_BUY_BUYER_CREDENTIALS.email,
    ONE_DIRECT_BUY_BUYER_CREDENTIALS.password
  );
  return ONE_DIRECT_BUY_BUYER_CREDENTIALS;
}

/** Log in as admin (same storefront login; admin role verified on dashboard). */
export async function loginAdmin(page) {
  if (!hasAdminCredentials()) {
    throw new Error(
      "Set ONEDIRECTBUY_ADMIN_EMAIL and ONEDIRECTBUY_ADMIN_PASSWORD in .env"
    );
  }
  await loginBuyer(
    page,
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.email,
    ONE_DIRECT_BUY_ADMIN_CREDENTIALS.password
  );
  return ONE_DIRECT_BUY_ADMIN_CREDENTIALS;
}
