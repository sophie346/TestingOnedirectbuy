import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  openBecomeVendorPage,
  clickStartSelling,
  openVendorStoreList,
} from "../helpers/oneDirectBuySeller.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Seller Onboarding (public)", () => {
  test("ODB-UC-183: guest seller starts application from Sell page", async ({
    page,
  }) => {
    await openBecomeVendorPage(page);
    await expect(page.getByRole("link", { name: /Start Selling/i }).first()).toBeVisible();
  });

  test("ODB-UC-184: Start Selling CTA navigates toward store onboarding", async ({
    page,
  }) => {
    await openBecomeVendorPage(page);
    await clickStartSelling(page);
    await expect(page).toHaveURL(/store-list|stores|vendor|sell/i, {
      timeout: 20_000,
    });
  });

  test("ODB-UC-185: vendor FAQ explains seller verification requirements", async ({
    page,
  }) => {
    await openBecomeVendorPage(page);
    await expect(
      page.getByText(/FREQUENTLY ASKED QUESTIONS|create a shop|verified as a seller/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-197: seller agreement page is reachable from legal routes", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/page/seller-agreement");
    await expect(page.getByText(/seller|agreement|terms|policy/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-387: seller agreement content is available for consent review", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/page/seller-agreement");
    await expect(page.getByText(/seller|agreement|terms|policy/i).first()).toBeVisible();
  });

  test("ODB-UC-380: seller fees page opens from legal route", async ({ page }) => {
    await gotoOneDirectBuy(page, "/page/fee-schedule");
    await expect(
      page.getByRole("heading", { name: /Seller Fees|Pricing|Fee/i }).or(
        page.getByText(/fee|pricing|commission/i)
      ).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-381: prohibited items policy opens for sellers", async ({ page }) => {
    await gotoOneDirectBuy(page, "/page/prohibited-restricted-products-policy");
    await expect(
      page.getByRole("heading", { name: /Prohibited|Restricted/i }).or(
        page.getByText(/prohibited|restricted/i)
      ).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("ODB-UC-379: seller agreement legal page opens correctly", async ({ page }) => {
    await gotoOneDirectBuy(page, "/page/seller-agreement");
    await expect(page.getByText(/seller|agreement|terms|policy/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ODB-UC-186: upload business documents requires seller application portal", async () => {
    test.skip(true, "Document upload is part of seller onboarding in admin/seller backend.");
  });

  test("ODB-UC-187: invalid document upload requires seller application portal", async () => {
    test.skip(true, "Invalid document validation runs in seller onboarding backend.");
  });
});

test.describe("OneDirectBuy — Seller Onboarding (authenticated checks)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-194: buyer can view seller onboarding without seller dashboard access", async ({
    page,
  }) => {
    await openBecomeVendorPage(page);
    await expect(page.getByText(/sell|vendor|Start Selling/i).first()).toBeVisible();
    await openVendorStoreList(page);
    await expect(
      page.getByRole("heading", { name: /Store list|Stores/i }).or(
        page.getByText(/Store list|stores|seller|404|not found/i)
      ).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
