import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

/** Full desktop chrome — matches a real shopper on a wide monitor. */
const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-026: homepage loads successfully without broken layout", async ({
    page,
    soft,
  }) => {
    await gotoOneDirectBuy(page, "/");

    await soft("ODB-UC-026-a", "Homepage title contains OneDirectBuy", async () => {
      await expect(page).toHaveTitle(/OneDirectBuy/i);
    });

    await soft("ODB-UC-026-b", "H1 marketplace heading visible", async () => {
      await expect(
        page.getByRole("heading", {
          name: /OneDirectBuy.*Auto Parts Marketplace/i,
        }),
      ).toBeVisible();
    });

    await soft(
      "ODB-UC-026-c",
      "Hero: Find Parts That Fit Your Vehicle",
      async () => {
        await expect(
          page.getByRole("heading", {
            name: /Find Parts That Fit Your Vehicle/i,
          }),
        ).toBeVisible();
      },
    );

    await soft("ODB-UC-026-d", "Store benefits row (all five)", async () => {
      const benefits = [
        /Free Delivery/i,
        /90 Days Return/i,
        /Secure Payment/i,
        /24\/7 Support/i,
        /Gift Service/i,
      ];
      for (const name of benefits) {
        await expect(page.getByRole("heading", { name })).toBeVisible();
      }
    });

    await soft("ODB-UC-026-e", "Header search chrome (category + box + button)", async () => {
      await expect(
        page.getByRole("combobox", { name: /Product category/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /Search products/i }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Search$/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Select Vehicle/i }),
      ).toBeVisible();
    });

    await soft("ODB-UC-026-f", "Header account / wishlist / cart shortcuts", async () => {
      await expect(page.getByRole("link", { name: /Favorites/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Cart/i }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Login$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Register$/i })).toBeVisible();
    });

    await soft("ODB-UC-026-g", "Shop by Department control visible", async () => {
      await expect(
        page
          .locator(".menu__toggle[role='button']")
          .filter({ hasText: /Shop by Department/i })
          .or(page.getByRole("button", { name: /Shop by Department/i }))
          .first(),
      ).toBeVisible();
    });

    await soft("ODB-UC-026-h", "Best Seller Brands section after scroll", async () => {
      await page
        .getByRole("heading", { name: /Best Seller Brands/i })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("heading", { name: /Best Seller Brands/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-506: homepage loads within accepted performance limit", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-506", "Homepage loads within 15s at full width", async () => {
      const start = Date.now();
      await gotoOneDirectBuy(page, "/");
      await expect(
        page.getByRole("heading", { name: /Free Delivery/i }),
      ).toBeVisible();
      expect(Date.now() - start).toBeLessThan(15_000);
    });
  });
});
