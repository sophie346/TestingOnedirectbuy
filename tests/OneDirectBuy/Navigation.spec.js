import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  ONE_DIRECT_BUY_BASE_URL,
} from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-027: header navigation links open correct pages", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-027-a", "All products header link opens /shop", async () => {
      await page.getByRole("link", { name: /All products/i }).first().click();
      await expect(page).toHaveURL(/\/shop/);
    });

    await soft("ODB-UC-027-b", "Sell on OneDirectBuy link opens vendor flow", async () => {
      await gotoOneDirectBuy(page, "/");
      await page.getByRole("link", { name: /Sell on OneDirectBuy/i }).first().click();
      await expect(page).toHaveURL(/vendor|become-a-vendor|sell/i);
    });

    await soft("ODB-UC-027-c", "Track order link opens tracking page", async () => {
      await gotoOneDirectBuy(page, "/");
      await page
        .getByRole("link", { name: /Track your order|Track Order/i })
        .first()
        .click();
      await expect(page).toHaveURL(/order-track|order-tracking|track/i);
    });
  });

  test("ODB-UC-028: footer policy and support links open correctly", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-028-a", "Privacy Policy footer link", async () => {
      await page.getByRole("link", { name: /^Privacy Policy$/i }).first().click();
      await expect(page).toHaveURL(/privacy/i);
    });

    await soft("ODB-UC-028-b", "Terms / Conditions footer link", async () => {
      await gotoOneDirectBuy(page, "/");
      await page
        .getByRole("link", { name: /Terms of Service|Conditions of Use|Terms/i })
        .first()
        .click();
      await expect(page).toHaveURL(/terms|conditions/i);
    });

    await soft("ODB-UC-028-c", "Help / FAQ / Contact footer link", async () => {
      await gotoOneDirectBuy(page, "/");
      const help = page
        .getByRole("link", {
          name: /Help Center|Help|FAQs?|FAQ|Contact|Support|Customer Service/i,
        })
        .first();
      await expect(help).toBeVisible({ timeout: 10_000 });
      await help.click();
      await expect(page).toHaveURL(/help|faqs?|contact|support/i);
    });
  });

  test("ODB-UC-029: category menu opens category content", async ({ page, soft }) => {
    await soft("ODB-UC-029", "Categories control opens category content", async () => {
      const trigger = page
        .getByRole("button", { name: /Categor(y|ies)|Shop by|Browse/i })
        .or(page.getByRole("link", { name: /Categor(y|ies)|Shop by/i }))
        .first();
      await expect(trigger).toBeVisible({ timeout: 10_000 });
      await trigger.click();
      await expect(
        page.getByText(/AC FILTER|Auto Parts|Category|Shop/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test("ODB-UC-038: logo click returns user to homepage", async ({ page, soft }) => {
    await soft("ODB-UC-038", "Logo returns to homepage", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await page.locator('a[href="/"], a.ps-logo, a[href*="home"]').first().click();
      await expect(page).toHaveURL(
        new RegExp(
          `${ONE_DIRECT_BUY_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`,
        ),
      );
    });
  });

  test("ODB-UC-039: mobile menu opens and links work", async ({ page, soft }) => {
    await soft("ODB-UC-039", "Mobile menu opens and All products works", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoOneDirectBuy(page, "/");
      const menu = page
        .getByRole("button", { name: /^Menu$|Open menu|Toggle|Navigation/i })
        .or(page.locator('[aria-label*="menu" i], .menu-toggle, .hamburger, .ps-header__menu button').first())
        .first();
      await expect(menu).toBeVisible({ timeout: 10_000 });
      await menu.click();
      const allProducts = page.getByRole("link", { name: /All products/i }).first();
      await expect(allProducts).toBeVisible({ timeout: 10_000 });
      await allProducts.click();
      await expect(page).toHaveURL(/\/shop/);
    });
  });

  test("ODB-UC-040: breadcrumb navigation redirects to parent pages", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-040", "Home breadcrumb returns to homepage", async () => {
      await gotoOneDirectBuy(page, "/shop");
      await page.getByRole("link", { name: /^Home$/i }).first().click();
      await expect(page).toHaveURL(/\/($|\?)/);
    });
  });
});
