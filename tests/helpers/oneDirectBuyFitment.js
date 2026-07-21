/**
 * Vehicle fitment helpers for OneDirectBuy "Select Vehicle" / garage flow.
 */
import { expect } from "@playwright/test";
import { dismissCookieBanner, gotoOneDirectBuy } from "./oneDirectBuyNav.js";

const DEFAULT_TIMEOUT = 15_000;

/** Header "Select Vehicle" control (desktop). */
export function selectVehicleButton(page) {
  return page.getByRole("button", { name: /^Select Vehicle$/i }).first();
}

/** Open My Vehicles garage panel from header. */
export async function openMyVehiclesPanel(page) {
  await dismissCookieBanner(page);
  const trigger = selectVehicleButton(page);
  await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true", {
    timeout: 10_000,
  });
  await expect(
    page.getByRole("heading", { name: /^My Vehicles$/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** From My Vehicles, open Add New Vehicle form (Manual entry). */
export async function openAddNewVehicleForm(page) {
  await openMyVehiclesPanel(page);
  const addBtn = page.getByRole("button", { name: /^Add Vehicle$/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await addBtn.click();
  await expect(
    page.getByRole("heading", { name: /^Add New Vehicle$/i }),
  ).toBeVisible({ timeout: 10_000 });
  const manual = page.getByRole("tab", { name: /^Manual entry$/i });
  if (await manual.isVisible().catch(() => false)) {
    await manual.click();
  }
  await expect(page.getByRole("combobox", { name: /^Select year$/i })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Pick cascading Year → Make → Model (first available options).
 * @returns {{ year: string, make: string, model: string }}
 */
export async function fillVehicleYearMakeModel(page, preferred = {}) {
  const yearCombo = page.getByRole("combobox", { name: /Select year|^\d{4}$/i }).first();
  await yearCombo.click();
  const yearOpt = preferred.year
    ? page.getByRole("option", { name: new RegExp(`^${preferred.year}$`) })
    : page.getByRole("option").filter({ hasText: /^\d{4}$/ }).first();
  const yearName = preferred.year || (await yearOpt.innerText()).trim();
  await page.getByRole("option", { name: new RegExp(`^${yearName}$`) }).click();

  const makeCombo = page.getByRole("combobox", { name: /^Select make$/i });
  await expect(makeCombo).toBeEnabled({ timeout: 10_000 });
  await makeCombo.click();
  const makeOpt = preferred.make
    ? page.getByRole("option", { name: new RegExp(preferred.make, "i") }).first()
    : page.getByRole("option").first();
  const makeName = (await makeOpt.innerText()).trim();
  await makeOpt.click();

  const modelCombo = page.getByRole("combobox", { name: /^Select model$/i });
  await expect(modelCombo).toBeEnabled({ timeout: 10_000 });
  await modelCombo.click();
  const modelOpt = preferred.model
    ? page.getByRole("option", { name: new RegExp(preferred.model, "i") }).first()
    : page.getByRole("option").first();
  const modelName = (await modelOpt.innerText()).trim();
  await modelOpt.click();

  return { year: yearName, make: makeName, model: modelName };
}

/** Switch to VIN lookup tab inside Add New Vehicle. */
export async function openVinLookupTab(page) {
  await openAddNewVehicleForm(page);
  await page.getByRole("tab", { name: /^Look up by VIN$/i }).click();
  await expect(
    page.getByRole("textbox", { name: /VIN \(17 characters\)/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /^Look up VIN$/i })).toBeVisible();
}

/** Mobile bottom bar Vehicle button opens the same garage flow. */
export async function openVehicleFromMobileBar(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoOneDirectBuy(page, "/");
  const vehicle = page.getByRole("button", { name: /^Vehicle$/i });
  await expect(vehicle).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await vehicle.click();
  await expect(
    page
      .getByRole("heading", { name: /^My Vehicles$/i })
      .or(page.getByRole("heading", { name: /^Add New Vehicle$/i }))
      .or(page.getByRole("button", { name: /^Add Vehicle$/i })),
  ).toBeVisible({ timeout: 10_000 });
}
