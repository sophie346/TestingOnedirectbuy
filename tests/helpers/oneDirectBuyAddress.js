import { expect } from "@playwright/test";
import {
  fillInputField,
  gotoAuthenticatedPage,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "./oneDirectBuyAuth.js";
import { gotoOneDirectBuy } from "./oneDirectBuyNav.js";

export function testAddressData(suffix = Date.now()) {
  return {
    name: "Playwright Test User",
    label: `Test Home ${suffix}`,
    line1: "100 Michigan Avenue",
    city: "Chicago",
    state: "Illinois",
    zip: "60601",
    country: "United States",
  };
}

export async function fillAddressForm(page, data) {
  await fillInputField(
    page.getByRole("textbox", { name: /^Name \*?$/i }),
    data.name
  );
  if (data.label) {
    await fillInputField(
      page.getByRole("textbox", { name: /Label \(Home \/ Office\)/i }),
      data.label
    );
  }
  await fillInputField(
    page.getByRole("textbox", { name: /Address Line 1 \*?/i }),
    data.line1
  );

  const countrySelect = page.getByRole("combobox", { name: /Country/i });
  if (await countrySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await countrySelect.selectOption({ label: data.country });
  } else {
    await fillInputField(page.locator('input[name="country"]'), data.country);
  }

  const stateSelect = page.getByRole("combobox", { name: /State \/ Province/i });
  if (await stateSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await stateSelect.selectOption({ label: data.state });
  } else {
    await fillInputField(page.locator('input[name="state"]'), data.state);
  }

  await fillInputField(
    page.getByRole("textbox", { name: /^City \*?$/i }),
    data.city
  );
  await fillInputField(
    page.getByRole("textbox", { name: /^Zip \*?$/i }),
    data.zip
  );
}

export async function addShippingAddress(page, data) {
  await gotoAuthenticatedPage(
    page,
    "/account/addresses/add",
    ONE_DIRECT_BUY_BUYER_CREDENTIALS
  );
  await expect(page.getByRole("heading", { name: /Shipping Address/i })).toBeVisible({
    timeout: 20_000,
  });
  await fillAddressForm(page, data);
  await page.getByRole("button", { name: /Save Address/i }).click();
  const okButton = page.getByRole("button", { name: /^OK$/i });
  if (await okButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await okButton.click();
  }
  await page.waitForURL(/\/account\/addresses/, { timeout: 30_000 });
  await expect(page.getByText(data.line1).first()).toBeVisible({
    timeout: 15_000,
  });
}
