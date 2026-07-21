import { expect } from "@playwright/test";
import {
  fillInputField,
  gotoAuthenticatedPage,
  ONE_DIRECT_BUY_BUYER_CREDENTIALS,
} from "./oneDirectBuyAuth.js";
import { gotoOneDirectBuy, dismissCookieBanner } from "./oneDirectBuyNav.js";

export function testAddressData(suffix = Date.now()) {
  return {
    name: "Playwright Test User",
    label: `Test Home ${suffix}`,
    // Kissimmee FL — near OneDirectBuy ship-from; Chicago ZIPs often return no rates.
    line1: "8 W Darlington Ave",
    line2: "",
    city: "Kissimmee",
    state: "Florida",
    zip: "34746",
    country: "United States",
  };
}

/** Guest or logged-out visit to address book → login. */
export async function expectGuestAddressesRedirect(page) {
  await gotoOneDirectBuy(page, "/account/addresses");
  await expect(page).toHaveURL(/\/account\/login/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /^Welcome back$/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Open authenticated address list (`Your Addresses`). */
export async function openAddressesPage(page) {
  await gotoAuthenticatedPage(
    page,
    "/account/addresses",
    ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  );
  await expect(
    page.getByRole("heading", { name: /Your Addresses/i }),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Fill shipping/address form fields (account add/edit or checkout-style labels).
 * Live labels: Name *, Label, Address line 1 *, Country *, State / Province *, City *, Zip / Postal code *
 */
export async function fillAddressForm(page, data) {
  await dismissCookieBanner(page);

  await fillInputField(
    page
      .getByRole("textbox", { name: /^Name \*$/i })
      .or(page.getByRole("textbox", { name: /^Name$/i }))
      .first(),
    data.name,
  );

  if (data.label != null) {
    const labelField = page
      .getByRole("textbox", { name: /^Label$/i })
      .or(page.getByPlaceholder(/Home,\s*Office/i))
      .or(page.getByRole("textbox", { name: /Label \(Home \/ Office\)/i }));
    if (await labelField.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await fillInputField(labelField.first(), data.label);
    }
  }

  await fillInputField(
    page.getByRole("textbox", { name: /^Address line 1 \*$/i }),
    data.line1,
  );

  if (data.line2) {
    const line2 = page.getByRole("textbox", { name: /^Address line 2$/i });
    if (await line2.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fillInputField(line2, data.line2);
    }
  }

  const countrySelect = page.getByRole("combobox", { name: /^Country \*$/i });
  if (await countrySelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await countrySelect.selectOption({ label: data.country });
  } else {
    await fillInputField(page.locator('input[name="country"]'), data.country);
  }

  const stateSelect = page.getByRole("combobox", {
    name: /^State \/ Province \*$/i,
  });
  if (await stateSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await stateSelect.selectOption({ label: data.state });
    // City options often load after state selection.
    await page.waitForTimeout(800);
  } else {
    await fillInputField(page.locator('input[name="state"]'), data.state);
  }

  const cityCombo = page
    .getByRole("combobox", { name: /^City \*$/i })
    .or(page.getByRole("combobox", { name: /^City$/i }))
    .or(page.getByLabel(/^City/i));
  const cityText = page
    .getByRole("textbox", { name: /^City \*$/i })
    .or(page.getByRole("textbox", { name: /^City$/i }));

  if (await cityCombo.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    const combo = cityCombo.first();
    // Prefer exact label; fall back to first non-placeholder option.
    try {
      await combo.selectOption({ label: data.city });
    } catch {
      const options = await combo.locator("option").allTextContents();
      const pick =
        options.find((o) => new RegExp(`^${data.city}$`, "i").test(o.trim())) ||
        options.find((o) =>
          /kissimmee|chicago|orlando|miami|new york|los angeles/i.test(o),
        ) ||
        options.find((o) => o && !/select/i.test(o));
      if (pick) {
        await combo.selectOption({ label: pick });
      } else {
        throw new Error(`City combobox has no usable option (wanted ${data.city})`);
      }
    }
  } else if (await cityText.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await fillInputField(cityText.first(), data.city);
  } else {
    await fillInputField(page.locator('input[name="city"]'), data.city);
  }

  await fillInputField(
    page
      .getByRole("textbox", { name: /^Zip \/ Postal code \*$/i })
      .or(page.getByRole("textbox", { name: /^Zip \*$/i }))
      .or(page.getByRole("textbox", { name: /^Zip \/ Postal code$/i }))
      .or(page.getByRole("textbox", { name: /^Zip$/i }))
      .first(),
    data.zip,
  );
}

/** Click primary save CTA on address forms. */
export async function clickSaveAddress(page) {
  const save = page
    .getByRole("button", { name: /^Save Address$/i })
    .or(page.getByRole("button", { name: /^Save address$/i }))
    .or(page.getByRole("button", { name: /^Save address for checkout$/i }));
  await expect(save.first()).toBeVisible({ timeout: 10_000 });
  await save.first().click();
}

/** Add a shipping address via /account/addresses/add. */
export async function addShippingAddress(page, data) {
  await gotoAuthenticatedPage(
    page,
    "/account/addresses/add",
    ONE_DIRECT_BUY_BUYER_CREDENTIALS,
  );
  await expect(
    page
      .getByRole("heading", { name: /Shipping Address|Add address|Add Address/i })
      .or(page.getByRole("textbox", { name: /^Name \*$/i })),
  ).toBeVisible({ timeout: 30_000 });

  await fillAddressForm(page, data);
  await clickSaveAddress(page);

  const okButton = page.getByRole("button", { name: /^OK$/i });
  if (await okButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await okButton.click();
  }

  await page.waitForURL(/\/account\/addresses(?!\/add)/, { timeout: 30_000 });
  await expect(
    page.getByText(data.line1).or(page.getByText(data.label)).first(),
  ).toBeVisible({ timeout: 15_000 });
}
