import { test, expect } from "../helpers/softTest.js";
import {
  openFirstStoreDetail,
  expectProductSellerInfo,
} from "../helpers/oneDirectBuySeller.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
} from "../helpers/oneDirectBuyAuth.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Seller Messaging (storefront UI)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-323: buyer sees Contact Seller on store detail", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-323", "Contact Seller link on store", async () => {
      await openFirstStoreDetail(page);
      await expect(
        page.getByRole("link", { name: /^Contact Seller$/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-323b: Contact Seller opens Conversations assistant", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-323b", "Contact Seller → Conversations panel", async () => {
      await openFirstStoreDetail(page);
      await page.getByRole("link", { name: /^Contact Seller$/i }).click();
      await expect(
        page.getByRole("heading", { name: /^Conversations$/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-066-msg: product page exposes Sold by seller info", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-066-msg", "PDP Sold by for seller contact context", async () => {
      await expectProductSellerInfo(page);
    });
  });
});

test.describe("OneDirectBuy — Seller Messaging (authenticated buyer)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-324: buyer can open account dashboard for order messaging", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-324", "my-account dashboard for post-order contact", async () => {
      await gotoOneDirectBuy(page, "/account/my-account");
      await expect(
        page.getByText(/account dashboard|Hello|recent orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-174: buyer orders area supports post-order seller contact shell", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-174", "/account/orders loads when authenticated", async () => {
      await gotoOneDirectBuy(page, "/account/orders");
      await expect(page).toHaveURL(/\/account\/orders/);
      await expect(
        page.getByText(/order|history|empty|no order|Orders/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});

test.describe("OneDirectBuy — Seller portal messaging (backend)", () => {
  test("ODB-UC-325: seller reply to buyer requires seller portal", async () => {
    test.skip(
      true,
      "Seller messaging inbox is OneChannel Admin / seller portal — not on public storefront.",
    );
  });
});
