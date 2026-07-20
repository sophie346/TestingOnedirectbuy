import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";

test.describe("OneDirectBuy — Auto Parts Fitment", () => {
  test.beforeEach(async ({ page }) => {
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-091: buyer opens vehicle selector", async ({ page }) => {
    const vehicleButton = page.getByRole("button", {
      name: /Vehicle|Select Your Vehicle|Open vehicle selector/i,
    });
    await expect(vehicleButton.first()).toBeVisible({ timeout: 15_000 });
    await vehicleButton.first().click();
    await expect(
      page
        .getByRole("dialog")
        .or(page.locator("[class*='vehicle'], [class*='garage']"))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ODB-UC-109: buyer searches by OEM part number", async ({ page }) => {
    await gotoOneDirectBuy(page, "/search?keyword=60431");
    await expect(page.getByRole("heading", { name: /Search result for/i })).toBeVisible();
  });
});
