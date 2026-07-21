import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  openBecomeVendorPage,
  clickStartSelling,
  openVendorStoreList,
  openSellerApplication,
} from "../helpers/oneDirectBuySeller.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
} from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Seller Onboarding (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-183: guest seller starts application from Sell page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-183", "Sell landing + Start Selling Today CTA", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("link", { name: /^Start Selling Today$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Frequently Asked Questions$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-184: Start Selling CTA opens seller application", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-184", "CTA → /vendor/seller-application", async () => {
      await openBecomeVendorPage(page);
      await clickStartSelling(page);
      await expect(page).toHaveURL(/\/vendor\/seller-application/);
      await expect(
        page.getByRole("heading", { name: /Apply to sell on OneDirect Buy/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-185: vendor FAQ explains seller verification", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-185", "FAQ + Seller Requirements on landing", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("heading", { name: /^Seller Requirements$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /How long does the approval process take/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(/Valid business registration or tax ID/i),
      ).toBeVisible();
    });
  });

  test("ODB-UC-191: seller application form fields are present", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-191", "Application contact + business fields", async () => {
      await openSellerApplication(page);
      await expect(page.getByText(/Your business/i)).toBeVisible();
      await expect(page.getByText(/^Contact$/i).first()).toBeVisible();
      await expect(page.getByText(/Business or brand name/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Continue to review/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Back to Become a Vendor/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-380: seller fees page opens from legal route", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-380", "/info/fee-schedule OneDirect Fee Schedule", async () => {
      await gotoOneDirectBuy(page, "/info/fee-schedule");
      await expect(
        page.getByRole("heading", { name: /OneDirect Fee Schedule|Fee Schedule/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-381: prohibited items policy opens for sellers", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-381", "Prohibited products policy heading", async () => {
      await gotoOneDirectBuy(page, "/info/prohibited-restricted-products-policy");
      await expect(
        page.getByRole("heading", { name: /Prohibited/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-379: seller-related terms reachable via Terms of Service", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-379", "/info/terms-of-service loads", async () => {
      await gotoOneDirectBuy(page, "/info/terms-of-service");
      await expect(
        page.getByRole("heading", { name: /^Terms of Service$/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-197: seller agreement content reachable via Terms of Service", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-197", "Terms of Service stands in for seller agreement", async () => {
      await gotoOneDirectBuy(page, "/info/terms-of-service");
      await expect(
        page.getByRole("heading", { name: /^Terms of Service$/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-387: seller agreement version/timestamp requires seller portal", async () => {
    test.skip(
      true,
      "Agreement version + timestamp are recorded in OneChannel seller onboarding, not the public storefront.",
    );
  });

  test("ODB-UC-186: upload business documents requires seller application portal", async () => {
    test.skip(
      true,
      "Document upload is deferred until after approval (OneChannel Admin).",
    );
  });

  test("ODB-UC-187: invalid document upload requires seller application portal", async () => {
    test.skip(true, "Invalid document validation runs in seller onboarding backend.");
  });
});

test.describe("OneDirectBuy — Seller Onboarding (authenticated checks)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-194: buyer can view seller onboarding without seller dashboard", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-194", "Logged-in buyer sees Sell page + Store list", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("link", { name: /^Start Selling Today$/i }),
      ).toBeVisible();
      await openVendorStoreList(page);
      await expect(page.getByRole("heading", { name: /^Store list$/i })).toBeVisible({
        timeout: 30_000,
      });
    });
  });
});
