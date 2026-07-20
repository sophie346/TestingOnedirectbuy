import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

const LEGAL_PAGES = [
  { id: "ODB-UC-375", path: "/page/privacy-policy", title: /Privacy Policy/i },
  { id: "ODB-UC-376", path: "/page/terms-of-service", title: /Terms|Conditions of Use/i },
  { id: "ODB-UC-377", path: "/page/shipping-delivery-policy", title: /Shipping|Delivery/i },
  { id: "ODB-UC-378", path: "/page/return-refund-policy", title: /Return|Refund/i },
  { id: "ODB-UC-379", path: "/page/fee-schedule", title: /Seller Fees|Pricing|Fee/i },
  { id: "ODB-UC-380", path: "/page/seller-agreement", title: /Seller Agreement|Seller/i },
  { id: "ODB-UC-381", path: "/page/prohibited-restricted-products-policy", title: /Prohibited|Restricted/i },
];

test.describe("OneDirectBuy — Legal Pages", () => {
  for (const legalPage of LEGAL_PAGES) {
    test(`${legalPage.id}: visitor can open legal page at ${legalPage.path}`, async ({
      page,
    }) => {
      await gotoOneDirectBuy(page, legalPage.path);
      await expect(page).toHaveURL(new RegExp(legalPage.path.replace(/\//g, "\\/")));
      await expect(
        page.getByRole("heading", { name: legalPage.title }).or(page.getByText(legalPage.title)).first()
      ).toBeVisible({ timeout: 15_000 });
    });
  }

  test("ODB-UC-384: policy pages show effective or updated dates when available", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/page/privacy-policy");
    await expect(
      page.getByText(/effective|updated|last modified|©|202/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
