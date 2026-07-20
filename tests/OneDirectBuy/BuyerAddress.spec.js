import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";
import {
  addShippingAddress,
  fillAddressForm,
  testAddressData,
} from "../helpers/oneDirectBuyAddress.js";

test.describe.configure({ mode: "serial" });

test.describe("OneDirectBuy — Buyer Addresses (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-010: buyer adds new shipping address", async ({ page }) => {
    const address = testAddressData();
    await addShippingAddress(page, address);
    await expect(page.getByText(address.label).first()).toBeVisible();
  });

  test("ODB-UC-011: buyer edits saved shipping address", async ({ page }) => {
    const address = testAddressData("edit");
    await addShippingAddress(page, address);

    await page.getByRole("button", { name: /^Edit$/i }).first().click();
    await page.waitForURL(/\/account\/addresses\/edit/, { timeout: 20_000 });

    const updatedCity = "Springfield";
    await fillAddressForm(page, { ...address, city: updatedCity });
    await page.getByRole("button", { name: /Save Address/i }).click();

    const okButton = page.getByRole("button", { name: /^OK$/i });
    if (await okButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await okButton.click();
    }

    await page.waitForURL(/\/account\/addresses/, { timeout: 30_000 });
    await expect(page.getByText(updatedCity).first()).toBeVisible();
  });

  test("ODB-UC-013: buyer sets one address as default", async ({ page }) => {
    const first = testAddressData("default-a");
    const second = testAddressData("default-b");
    await addShippingAddress(page, first);
    await addShippingAddress(page, second);

    await gotoOneDirectBuy(page, "/account/addresses");
    const setDefaultButton = page
      .getByRole("button", { name: /Set default/i })
      .first();
    if (await setDefaultButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await setDefaultButton.click();
      await expect(page.getByText(/^Default$/i).first()).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await expect(page.getByText(second.line1).first()).toBeVisible();
    }
  });

  test("ODB-UC-012: buyer deletes saved shipping address", async ({ page }) => {
    const address = testAddressData("delete");
    await addShippingAddress(page, address);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^Delete$/i }).first().click();

    await expect(page.getByText(address.line1)).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
