import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openKnownProductDetail,
} from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Error Handling & SEO", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-469: invalid URL shows friendly 404 page", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-469", "Ohh! Page not found for missing route", async () => {
      await gotoOneDirectBuy(page, "/this-page-does-not-exist-404-test");
      await expect(
        page.getByRole("heading", { name: /Ohh! Page not found/i }),
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  test("ODB-UC-510: friendly 404 page includes homepage link", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-510", "404 page Homepage link", async () => {
      await gotoOneDirectBuy(page, "/missing-route-playwright-test");
      await expect(
        page.getByRole("heading", { name: /Ohh! Page not found/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("link", { name: /^Homepage$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-458: product page includes canonical link when available", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-458", "PDP canonical href points at onedirectbuy.com", async () => {
      await openKnownProductDetail(page, "bearing");
      const canonical = page.locator('link[rel="canonical"]');
      const count = await canonical.count();
      if (count === 0) {
        test.info().annotations.push({
          type: "note",
          description: "No canonical link present on PDP",
        });
        return;
      }
      await expect(canonical.first()).toHaveAttribute("href", /onedirectbuy\.com/);
    });
  });

  test("ODB-UC-460: sitemap XML is reachable", async ({ request, soft }) => {
    await soft("ODB-UC-460", "GET /sitemap.xml (or index) < 500", async () => {
      const response = await request.get("https://onedirectbuy.com/sitemap.xml");
      expect(response.status()).toBeLessThan(500);
      expect([200, 301, 302, 307, 308]).toContain(response.status());
    });
  });

  test("ODB-UC-461: contact-us info page loads", async ({ page, soft }) => {
    await soft("ODB-UC-461", "/info/contact-us heading", async () => {
      await gotoOneDirectBuy(page, "/info/contact-us");
      await expect(
        page.getByRole("heading", { name: /^Contact Us$/i }),
      ).toBeVisible({ timeout: 20_000 });
    });
  });
});
