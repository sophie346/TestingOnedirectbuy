/**
 * Vehicle fitment helpers for OneDirectBuy "Select Vehicle" / garage flow.
 *
 * Live UI (verified on onedirectbuy.com):
 * - Year/Make/Model are <button role="combobox"> with visible text
 *   "Select year" → after pick shows "2020"
 *   Make starts as "Select year first" (disabled), then "Select make"
 *   Model starts as "Select make first" (disabled), then "Select model"
 */
import { expect } from "@playwright/test";
import {
  dismissAssistantOverlay,
  dismissCookieBanner,
  gotoOneDirectBuy,
} from "./oneDirectBuyNav.js";

const DEFAULT_TIMEOUT = 20_000;

/** Header "Select Vehicle" (desktop). */
export function selectVehicleButton(page) {
  return page.getByRole("button", { name: /^Select Vehicle$/i }).first();
}

/**
 * Mobile bottom-nav "Vehicle" control.
 * Prefer DOM class — accessible name can be hidden while the AI chat overlay
 * marks the main tree aria-hidden, and label text often includes newlines.
 */
export function mobileVehicleBarButton(page) {
  return page
    .locator("button.navigation__item")
    .filter({ hasText: /Vehicle/i })
    .or(
      page.locator("button").filter({
        hasText: /^\s*Vehicle\s*$/i,
      }),
    )
    .first();
}

/** True when the garage sheet/panel is open. */
function garageOpenLocator(page) {
  return page
    .getByRole("heading", { name: /^My Vehicles$/i })
    .or(page.getByRole("button", { name: /^Add Vehicle$/i }))
    .or(page.getByText(/No saved vehicles yet/i))
    .or(page.getByText(/Select a vehicle to see compatible parts/i));
}

/**
 * Year control — prefer role=combobox, fall back to button / text filter.
 * Do NOT rely on accessible-name alone; Playwright sometimes misses it.
 */
export function yearCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select year|\d{4})$/i })
    .or(page.getByRole("button", { name: /^(Select year|\d{4})$/i }))
    .first();
}

export function makeCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select make|Select year first)$/i })
    .or(
      page.getByRole("button", {
        name: /^(Select make|Select year first)$/i,
      }),
    )
    .first();
}

export function modelCombobox(page) {
  return page
    .locator('[role="combobox"]')
    .filter({ hasText: /^(Select model|Select make first)$/i })
    .or(
      page.getByRole("button", {
        name: /^(Select model|Select make first)$/i,
      }),
    )
    .first();
}

/** Open My Vehicles garage from desktop header. */
export async function openMyVehiclesPanel(page) {
  await dismissCookieBanner(page);
  const trigger = selectVehicleButton(page);
  await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true", {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: /^My Vehicles$/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Open Add New Vehicle → Manual entry until Year control is ready. */
export async function openAddNewVehicleForm(page) {
  await openMyVehiclesPanel(page);

  const addBtn = page.getByRole("button", { name: /^Add Vehicle$/i });
  await expect(addBtn).toBeVisible({ timeout: 15_000 });
  await addBtn.click();

  await expect(
    page.getByRole("heading", { name: /^Add New Vehicle$/i }),
  ).toBeVisible({ timeout: 15_000 });

  const manual = page.getByRole("tab", { name: /^Manual entry$/i });
  if (await manual.isVisible().catch(() => false)) {
    const selected = await manual.getAttribute("aria-selected");
    if (selected !== "true") {
      await manual.click();
    }
  }

  await expect(
    page.getByText(/Find parts guaranteed to fit/i),
  ).toBeVisible({ timeout: 15_000 });

  const year = yearCombobox(page);
  await year.scrollIntoViewIfNeeded().catch(() => {});
  await expect(year).toBeVisible({ timeout: DEFAULT_TIMEOUT });
}

/**
 * Cascading Year → Make → Model (first available options unless preferred).
 * @returns {Promise<{ year: string, make: string, model: string }>}
 */
export async function fillVehicleYearMakeModel(page, preferred = {}) {
  const yearCombo = yearCombobox(page);
  await expect(yearCombo).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await yearCombo.click();

  const yearOpt = preferred.year
    ? page.getByRole("option", { name: new RegExp(`^${preferred.year}$`) })
    : page.getByRole("option").filter({ hasText: /^\d{4}$/ }).first();
  await expect(yearOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const yearName = preferred.year || (await yearOpt.innerText()).trim();
  await page.getByRole("option", { name: new RegExp(`^${yearName}$`) }).click();

  // After year pick, make becomes enabled with name "Select make"
  const makeReady = page
    .locator('[role="combobox"]')
    .filter({ hasText: /^Select make$/i })
    .or(page.getByRole("button", { name: /^Select make$/i }))
    .first();
  await expect(makeReady).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  await makeReady.click();

  const makeOpt = preferred.make
    ? page.getByRole("option", { name: new RegExp(preferred.make, "i") }).first()
    : page.getByRole("option").first();
  await expect(makeOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const makeName = (await makeOpt.innerText()).trim();
  await makeOpt.click();

  const modelReady = page
    .locator('[role="combobox"]')
    .filter({ hasText: /^Select model$/i })
    .or(page.getByRole("button", { name: /^Select model$/i }))
    .first();
  await expect(modelReady).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  await modelReady.click();

  const modelOpt = preferred.model
    ? page.getByRole("option", { name: new RegExp(preferred.model, "i") }).first()
    : page.getByRole("option").first();
  await expect(modelOpt).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  const modelName = (await modelOpt.innerText()).trim();
  await modelOpt.click();

  return { year: yearName, make: makeName, model: modelName };
}

/** Add New Vehicle → Look up by VIN tab. */
export async function openVinLookupTab(page) {
  await openAddNewVehicleForm(page);
  await page.getByRole("tab", { name: /^Look up by VIN$/i }).click();
  await expect(
    page.getByRole("textbox", { name: /VIN \(17 characters\)/i }),
  ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await expect(
    page.getByRole("button", { name: /^Look up VIN$/i }),
  ).toBeVisible();
}

/** Mobile bottom-bar Vehicle → garage panel. */
export async function openVehicleFromMobileBar(page) {
  // Mobile chrome is CSS-width based; reload after resize so layout settles.
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoOneDirectBuy(page, "/");
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);

  const vehicle = mobileVehicleBarButton(page);
  await expect(vehicle).toBeVisible({ timeout: DEFAULT_TIMEOUT });

  const garage = garageOpenLocator(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await garage.first().isVisible().catch(() => false)) break;
    await dismissAssistantOverlay(page);
    await vehicle.click({ force: true });
    if (await garage.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
      break;
    }
  }

  await expect(garage.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
}
