import { test, expect } from "../helpers/softTest.js";
import {
  clickLogoHome,
  gotoOneDirectBuy,
  openDepartmentCategory,
  openMobileNav,
  openShopByDepartment,
  ONE_DIRECT_BUY_BASE_URL,
} from "../helpers/oneDirectBuyNav.js";

/** Full-width desktop first; mobile covered in ODB-UC-039. */
const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-027: header navigation links open correct pages", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-027-a", "All products → /shop (Shop All Products)", async () => {
      const link = page.getByRole("link", { name: /^All products$/i }).first();
      await expect(link).toHaveAttribute("href", /\/shop/);
      await Promise.all([
        page.waitForURL(/\/shop/, { timeout: 20_000 }),
        link.click(),
      ]);
      await expect(
        page.getByRole("heading", { name: /Shop All Products/i }),
      ).toBeVisible({ timeout: 20_000 });
    });

    await soft(
      "ODB-UC-027-b",
      "Sell on OneDirectBuy → /vendor/become-a-vendor",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const link = page
          .getByRole("link", { name: /^Sell on OneDirectBuy$/i })
          .first();
        await expect(link).toHaveAttribute("href", /become-a-vendor/);
        await Promise.all([
          page.waitForURL(/\/vendor\/become-a-vendor/, { timeout: 20_000 }),
          link.click(),
        ]);
      },
    );

    await soft(
      "ODB-UC-027-c",
      "Track your order → /account/order-tracking",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const link = page
          .getByRole("link", { name: /^Track your order$/i })
          .first();
        await expect(link).toHaveAttribute("href", /order-tracking/);
        await Promise.all([
          page.waitForURL(/\/account\/order-tracking/, { timeout: 20_000 }),
          link.click(),
        ]);
      },
    );
  });

  test("ODB-UC-028: footer policy and support links open correctly", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-028-a", "Privacy Policy → /info/privacy-policy", async () => {
      await page
        .getByRole("link", { name: /^Privacy Policy$/i })
        .first()
        .scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForURL(/\/info\/privacy-policy/, { timeout: 20_000 }),
        page.getByRole("link", { name: /^Privacy Policy$/i }).first().click(),
      ]);
      await expect(
        page.getByRole("heading", { name: /^Privacy Policy$/i }),
      ).toBeVisible();
    });

    await soft(
      "ODB-UC-028-b",
      "Terms of Service → /info/terms-of-service",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await page
          .getByRole("link", { name: /^Terms of Service$/i })
          .first()
          .scrollIntoViewIfNeeded();
        await Promise.all([
          page.waitForURL(/\/info\/terms-of-service/, { timeout: 20_000 }),
          page.getByRole("link", { name: /^Terms of Service$/i }).first().click(),
        ]);
      },
    );

    await soft(
      "ODB-UC-028-c",
      "Contact Us → /info/contact-us (stable support path)",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await page
          .getByRole("link", { name: /^Contact Us$/i })
          .first()
          .scrollIntoViewIfNeeded();
        await Promise.all([
          page.waitForURL(/\/info\/contact-us|contact/i, { timeout: 20_000 }),
          page.getByRole("link", { name: /^Contact Us$/i }).first().click(),
        ]);
      },
    );

    await soft(
      "ODB-UC-028-d",
      "Help Center opens in-page assistant (Conversations)",
      async () => {
        await gotoOneDirectBuy(page, "/");
        const help = page.getByRole("link", { name: /^Help Center$/i }).first();
        await help.scrollIntoViewIfNeeded();
        await help.click();
        await expect(
          page
            .getByRole("heading", { name: /Conversations/i })
            .or(page.getByRole("button", { name: /Open assistant|Speak with Assistant/i })),
        ).toBeVisible({ timeout: 10_000 });
      },
    );
  });

  test("ODB-UC-029: Shop by Department → Exterior category page", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-029-a",
      "Shop by Department expands category links",
      async () => {
        await openShopByDepartment(page);
        await expect(
          page.getByRole("link", { name: /^Exterior$/i }).first(),
        ).toBeVisible();
      },
    );

    await soft(
      "ODB-UC-029-b",
      "Shopper opens Exterior → /category/exterior",
      async () => {
        await gotoOneDirectBuy(page, "/");
        await openDepartmentCategory(page, "Exterior");
        await expect(page).toHaveURL(/\/category\/exterior/i);
        await expect(page).toHaveTitle(/Exterior/i);
      },
    );
  });

  test("ODB-UC-038: logo click returns user to homepage", async ({ page, soft }) => {
    await soft("ODB-UC-038", "From /shop, ps-logo returns home", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await clickLogoHome(page);
      await expect(page).toHaveURL(
        new RegExp(
          `${ONE_DIRECT_BUY_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`,
        ),
      );
      await expect(
        page
          .getByRole("heading", {
            name: /Find Parts That Fit Your Vehicle/i,
          })
          .first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-039: mobile menu opens and Shop link works", async ({
    page,
    soft,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOneDirectBuy(page, "/");

    await soft(
      "ODB-UC-039-a",
      "Mobile bottom bar: Menu / Categories / Vehicle / Search / Cart",
      async () => {
        for (const name of [
          /^Menu$/i,
          /^Categories$/i,
          /^Vehicle$/i,
          /^Search$/i,
          /^Cart$/i,
        ]) {
          await expect(page.getByRole("button", { name })).toBeVisible();
        }
      },
    );

    await soft("ODB-UC-039-b", "Menu drawer → Shop → /shop", async () => {
      await openMobileNav(page);
      const shopLink = page
        .getByRole("link", { name: /^Shop$/i })
        .or(page.getByRole("menuitem", { name: /^Shop$/i }))
        .first();
      await Promise.all([
        page.waitForURL(/\/shop/, { timeout: 20_000 }),
        shopLink.click(),
      ]);
    });
  });

  test("ODB-UC-040: breadcrumb Home on shop returns to homepage", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-040", "Home breadcrumb from /shop", async () => {
      await gotoOneDirectBuy(page, "/shop");
      const home = page
        .getByRole("navigation", { name: /Breadcrumb/i })
        .getByRole("link", { name: /^Home$/i })
        .or(page.getByRole("link", { name: /^Home$/i }));
      await home.first().click();
      await expect(page).toHaveURL(/\/($|\?)/);
      await expect(
        page.getByRole("heading", {
          name: /Find Parts That Fit Your Vehicle/i,
        }),
      ).toBeVisible();
    });
  });
});
