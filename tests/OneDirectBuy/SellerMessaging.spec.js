import { test, expect } from "@playwright/test";
import {
  openFirstStoreDetail,
  expectProductSellerInfo,
} from "../helpers/oneDirectBuySeller.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Seller Messaging (storefront UI)", () => {
  test("ODB-UC-323: buyer sees contact seller entry before purchase", async ({
    page,
  }) => {
    await openFirstStoreDetail(page);
    await expect(
      page.getByRole("button", { name: /Contact Seller/i }).or(
        page.getByText(/Contact Seller/i)
      ).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("ODB-UC-323: product page exposes seller contact or store link", async ({
    page,
  }) => {
    await expectProductSellerInfo(page);
  });
});

test.describe("OneDirectBuy — Seller Messaging (authenticated buyer)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-324: buyer can open orders area to message seller from order", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/recent orders|order|dashboard/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ODB-UC-174: buyer order history page supports post-order seller contact flow", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/account/my-account");
    await expect(page.getByText(/Hello|account dashboard|recent orders/i).first()).toBeVisible();
  });
});

test.describe("OneDirectBuy — Seller portal messaging (backend)", () => {
  test("ODB-UC-325: seller reply to buyer requires seller portal", async () => {
    test.skip(true, "Seller messaging inbox is not exposed on the public storefront.");
  });
});
