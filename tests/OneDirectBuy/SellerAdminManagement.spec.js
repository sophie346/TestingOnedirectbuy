import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import {
  loginAdmin,
  hasAdminCredentials,
} from "../helpers/oneDirectBuyAuth.js";
import {
  openStoresPage,
  searchStores,
  openBecomeVendorPage,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Admin seller management (storefront)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasAdminCredentials()) {
      test.skip(
        true,
        "Set ONEDIRECTBUY_ADMIN_EMAIL/PASSWORD (or buyer credentials fallback)",
      );
      return;
    }
    await loginAdmin(page);
  });

  test("ODB-UC-364: admin searches seller listing from stores page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-364", "Search vendor on /stores", async () => {
      await searchStores(page, "auto");
      await expect(
        page
          .locator('a[href*="/store/"]')
          .or(page.getByText(/no store|no result|0 store/i))
          .first(),
      ).toBeVisible({ timeout: 60_000 });
    });
  });

  test("ODB-UC-365: admin searches products from shop catalog", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-365", "Search result heading for keyword", async () => {
      await gotoOneDirectBuy(page, "/search?keyword=filter");
      await expect(
        page
          .getByRole("heading", { name: /Search result for/i })
          .or(page.getByText(/search result|products found|No product found/i))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-476: logged-in user sees Sell page but buyer account chrome", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-476", "Sell landing + my-account (no seller admin)", async () => {
      await openBecomeVendorPage(page);
      await expect(
        page.getByRole("link", { name: /^Start Selling Today$/i }),
      ).toBeVisible();
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});

test.describe("OneDirectBuy — Admin seller workflows (OneChannel backend)", () => {
  test("ODB-UC-182: admin views full multi-seller order requires admin backend", async () => {
    test.skip(true, "Multi-seller order admin view is in OneChannelAdmin backend.");
  });

  test("ODB-UC-188: admin review seller application requires admin backend portal", async () => {
    test.skip(
      true,
      "Seller application review is handled in OneChannelAdmin, not the storefront.",
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
});

test.describe("OneDirectBuy — Buyer-visible store directory (no admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-364-guest: guest can open and search store list", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-364-guest", "Public Store list + Search vendor", async () => {
      await openStoresPage(page);
      await expect(page.getByRole("heading", { name: /^Store list$/i })).toBeVisible();
      await expect(page.getByPlaceholder(/Search vendor/i)).toBeVisible();
    });
  });
});
