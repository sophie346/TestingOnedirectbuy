import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

/** Live /info/* legal & policy pages (footer + Policies hub). */
const LEGAL_PAGES = [
  {
    id: "ODB-UC-375",
    path: "/info/privacy-policy",
    title: /^Privacy Policy$/i,
  },
  {
    id: "ODB-UC-376",
    path: "/info/terms-of-service",
    title: /^Terms of Service$/i,
  },
  {
    id: "ODB-UC-377",
    path: "/info/shipping-policy",
    title: /^Shipping & Delivery Policy$/i,
  },
  {
    id: "ODB-UC-378",
    path: "/info/return-refund",
    title: /^Return & Refund Policy$/i,
  },
  {
    id: "ODB-UC-379",
    path: "/info/fee-schedule",
    title: /OneDirect Fee Schedule|Seller Fees|Fee Schedule|Pricing/i,
  },
  {
    id: "ODB-UC-380",
    path: "/info/fulfillment-terms",
    title: /OneFulfillmentCenter|Fulfillment/i,
  },
  {
    id: "ODB-UC-381",
    path: "/info/prohibited-restricted-products-policy",
    title: /Prohibited/i,
  },
];

test.describe("OneDirectBuy — Legal Pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  for (const legalPage of LEGAL_PAGES) {
    test(`${legalPage.id}: visitor can open ${legalPage.path}`, async ({
      page,
      soft,
    }) => {
      await soft(legalPage.id, `Open ${legalPage.path} with matching heading`, async () => {
        await gotoOneDirectBuy(page, legalPage.path);
        await expect(page).toHaveURL(new RegExp(legalPage.path.replace(/\//g, "\\/")));
        await expect(
          page.getByRole("heading", { name: legalPage.title }).first(),
        ).toBeVisible({ timeout: 30_000 });
      });
    });
  }

  test("ODB-UC-382: Policies & Legal hub lists policy cards", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-382", "/info/policies hub cards", async () => {
      await gotoOneDirectBuy(page, "/info/policies");
      await expect(
        page.getByRole("heading", { name: /^Policies & Legal$/i }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("link", { name: /Privacy Policy/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Shipping & Delivery Policy/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /Prohibited Products Policy/i }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-383: HTML sitemap page is available", async ({ page, soft }) => {
    await soft("ODB-UC-383", "/info/sitemap heading + XML link", async () => {
      await gotoOneDirectBuy(page, "/info/sitemap");
      await expect(page.getByRole("heading", { name: /^Sitemap$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        page.getByRole("link", { name: /sitemap.*\.xml|\/sitemap\//i }).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-384: policy pages show copyright year when available", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-384", "Privacy policy page shows © year", async () => {
      await gotoOneDirectBuy(page, "/info/privacy-policy");
      await expect(
        page.getByRole("heading", { name: /^Privacy Policy$/i }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/©\s*2026|All Rights Reserved/i).first()).toBeVisible();
    });
  });
});
