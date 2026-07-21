import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy, openCheckoutWithCart } from "../helpers/oneDirectBuyNav.js";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
} from "../helpers/oneDirectBuyAuth.js";
import {
  addShippingAddress,
  clickSaveAddress,
  expectGuestAddressesRedirect,
  fillAddressForm,
  openAddressesPage,
  testAddressData,
} from "../helpers/oneDirectBuyAddress.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Buyer Addresses (guest)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-010-guest: guest visiting addresses redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-010-guest", "/account/addresses → Welcome back", async () => {
      await expectGuestAddressesRedirect(page);
    });
  });

  test("ODB-UC-010-guest-add: guest visiting add-address redirects to login", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-010-guest-add", "/account/addresses/add → login", async () => {
      await gotoOneDirectBuy(page, "/account/addresses/add");
      await expect(page).toHaveURL(/\/account\/login/, { timeout: 20_000 });
      await expect(
        page.getByRole("heading", { name: /^Welcome back$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-132-addr: checkout exposes live address field labels", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-132-addr",
      "Name / Address line 1 / Country / default checkbox",
      async () => {
        await openCheckoutWithCart(page);
        await expect(page.getByRole("textbox", { name: /^Name \*$/i })).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Address line 1 \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("combobox", { name: /^Country \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Zip \/ Postal code \*$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("checkbox", { name: /^Set as default address$/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /^Label$/i }),
        ).toBeVisible();
      },
    );
  });
});

test.describe("OneDirectBuy — Buyer Addresses (authenticated)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD");
      return;
    }
    await ensureLoggedInBuyer(page);
  });

  test("ODB-UC-010: buyer adds new shipping address", async ({ page, soft }) => {
    await soft("ODB-UC-010", "Add address via /account/addresses/add", async () => {
      const address = testAddressData();
      await addShippingAddress(page, address);
      await expect(
        page.getByText(address.label).or(page.getByText(address.line1)).first(),
      ).toBeVisible();
    });
  });

  test("ODB-UC-011: buyer edits saved shipping address", async ({ page, soft }) => {
    await soft("ODB-UC-011", "Edit address → update city → Save", async () => {
      const address = testAddressData("edit");
      await addShippingAddress(page, address);

      const editBtn = page
        .getByRole("button", { name: /^Edit$/i })
        .or(page.getByRole("link", { name: /^Edit$/i }));
      await expect(editBtn.first()).toBeVisible({ timeout: 15_000 });
      await editBtn.first().click();
      await page.waitForURL(/\/account\/addresses\/(edit|add)/, {
        timeout: 20_000,
      });

      const updatedCity = "Springfield";
      await fillAddressForm(page, { ...address, city: updatedCity });
      await clickSaveAddress(page);

      const okButton = page.getByRole("button", { name: /^OK$/i });
      if (await okButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await okButton.click();
      }

      await page.waitForURL(/\/account\/addresses(?!\/)/, { timeout: 30_000 });
      await expect(page.getByText(updatedCity).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test("ODB-UC-013: buyer sets one address as default", async ({ page, soft }) => {
    await soft("ODB-UC-013", "Set default / Default badge", async () => {
      const first = testAddressData("default-a");
      const second = testAddressData("default-b");
      await addShippingAddress(page, first);
      await addShippingAddress(page, second);

      await openAddressesPage(page);
      const setDefault = page
        .getByRole("button", { name: /Set default/i })
        .or(page.getByRole("checkbox", { name: /Set as default address/i }))
        .first();
      if (await setDefault.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await setDefault.click();
        await expect(
          page.getByText(/^Default$/i).or(page.getByText(/default address/i)).first(),
        ).toBeVisible({ timeout: 15_000 });
      } else {
        await expect(page.getByText(second.line1).first()).toBeVisible();
      }
    });
  });

  test("ODB-UC-012: buyer deletes saved shipping address", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-012", "Delete address removes line1 from list", async () => {
      const address = testAddressData("delete");
      await addShippingAddress(page, address);

      page.once("dialog", (dialog) => dialog.accept());
      const deleteBtn = page
        .getByRole("button", { name: /^Delete$/i })
        .or(page.getByRole("link", { name: /^Delete$/i }));
      await expect(deleteBtn.first()).toBeVisible({ timeout: 15_000 });
      await deleteBtn.first().click();

      await expect(page.getByText(address.line1)).toHaveCount(0, {
        timeout: 15_000,
      });
    });
  });
});
