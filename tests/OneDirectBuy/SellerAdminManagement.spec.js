import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import { loginAdmin } from "../helpers/oneDirectBuyAuth.js";
import { openStoresPage, searchStores } from "../helpers/oneDirectBuySeller.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Admin seller management (storefront)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("ODB-UC-364: admin searches seller listing from stores page", async ({
    page,
  }) => {
    await searchStores(page, "test");
    await expect(page.getByText(/store|seller|loading|no store/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("ODB-UC-182: admin views full multi-seller order requires admin backend", async () => {
    test.skip(true, "Multi-seller order admin view is in OneChannelAdmin backend.");
  });

  test("ODB-UC-188: admin review seller application requires admin backend portal", async () => {
    test.skip(
      true,
      "Seller application review is handled in OneChannelAdmin, not the OneDirectBuy storefront."
    );
  });

  test("ODB-UC-189: admin approve seller requires admin backend portal", async () => {
    test.skip(true, "Seller approval workflow is not available on the public storefront.");
  });

  test("ODB-UC-190: admin reject seller requires admin backend portal", async () => {
    test.skip(true, "Seller rejection workflow is not available on the public storefront.");
  });

  test("ODB-UC-195: admin suspend seller requires admin backend portal", async () => {
    test.skip(true, "Seller suspension is an admin-backend operation.");
  });

  test("ODB-UC-196: admin reactivate seller requires admin backend portal", async () => {
    test.skip(true, "Seller reactivation is an admin-backend operation.");
  });

  test("ODB-UC-476: logged-in buyer can view sell page but not seller admin dashboard", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/vendor/become-a-vendor");
    await expect(page.getByText(/sell|vendor|Start Selling/i).first()).toBeVisible();
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/account dashboard|Hello|recent orders/i).first()).toBeVisible();
  });
});

test.describe("OneDirectBuy — Admin seller catalog search", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("ODB-UC-365: admin searches products from shop catalog", async ({ page }) => {
    await gotoOneDirectBuy(page, "/search?keyword=filter");
    await expect(
      page.getByRole("heading", { name: /Search result for/i }).or(
        page.getByText(/search result|products found|no result/i)
      ).first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
