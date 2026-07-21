import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy, searchProducts } from "../helpers/oneDirectBuyNav.js";
import {
  fillVehicleYearMakeModel,
  openAddNewVehicleForm,
  openMyVehiclesPanel,
  openVehicleFromMobileBar,
  openVinLookupTab,
  selectVehicleButton,
} from "../helpers/oneDirectBuyFitment.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Auto Parts Fitment", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await gotoOneDirectBuy(page, "/");
  });

  test("ODB-UC-091: buyer opens vehicle selector (My Vehicles)", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-091-a",
      "Hero promotes Find Parts That Fit Your Vehicle",
      async () => {
        await expect(
          page.getByRole("heading", {
            name: /Find Parts That Fit Your Vehicle/i,
          }),
        ).toBeVisible();
      },
    );

    await soft(
      "ODB-UC-091-b",
      "Select Vehicle expands My Vehicles garage panel",
      async () => {
        await openMyVehiclesPanel(page);
        await expect(
          page.getByText(/Select a vehicle to see compatible parts/i),
        ).toBeVisible();
        await expect(
          page.getByText(/No saved vehicles yet|Vehicles are saved on this device/i).first(),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: /^Add Vehicle$/i }),
        ).toBeVisible();
      },
    );
  });

  test("ODB-UC-092: buyer opens Add New Vehicle manual entry form", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-092",
      "Add Vehicle → Add New Vehicle with Year/Make/Model",
      async () => {
        await openAddNewVehicleForm(page);
        await expect(
          page.getByText(/Find parts guaranteed to fit/i),
        ).toBeVisible();
        await expect(page.getByText(/^Year$/i).first()).toBeVisible();
        await expect(page.getByText(/^Make$/i).first()).toBeVisible();
        await expect(page.getByText(/^Model$/i).first()).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /Trim \(optional\)/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: /Engine \(optional\)/i }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: /^Find Parts$/i })).toBeDisabled();
        await expect(
          page.getByRole("button", { name: /^Save Vehicle$/i }),
        ).toBeDisabled();
      },
    );
  });

  test("ODB-UC-093: cascading Year → Make → Model enables Find Parts", async ({
    page,
    soft,
  }) => {
    await soft(
      "ODB-UC-093",
      "Select year, make, model then Find Parts is enabled",
      async () => {
        await openAddNewVehicleForm(page);
        const picked = await fillVehicleYearMakeModel(page, { year: "2020" });
        expect(picked.year).toBeTruthy();
        expect(picked.make).toBeTruthy();
        expect(picked.model).toBeTruthy();

        await expect(
          page.getByRole("button", { name: /^Find Parts$/i }),
        ).toBeEnabled({ timeout: 10_000 });
        await expect(
          page.getByRole("button", { name: /^Save Vehicle$/i }),
        ).toBeEnabled({ timeout: 10_000 });
      },
    );
  });

  test("ODB-UC-094: Look up by VIN tab shows VIN field", async ({ page, soft }) => {
    await soft("ODB-UC-094", "VIN tab: 17-char input + Look up VIN", async () => {
      await openVinLookupTab(page);
      const vin = page.getByRole("textbox", { name: /VIN \(17 characters\)/i });
      await vin.fill("1FTFW1E50MFA00000");
      await expect(page.getByRole("button", { name: /^Look up VIN$/i })).toBeEnabled({
        timeout: 5_000,
      });
    });
  });

  test("ODB-UC-109: buyer searches by OEM / SKU part number", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-109", "Search keyword 60431 (SKU) shows results", async () => {
      await searchProducts(page, "60431");
      await expect(
        page.getByRole("heading", { name: /Search result for/i }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page
          .getByText(/60431|SKU|bearing|product/i)
          .or(page.locator('a[href*="/product/"]'))
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test("ODB-UC-110: mobile Vehicle bar opens fitment garage", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-110", "390px bottom Vehicle → My Vehicles / Add", async () => {
      await openVehicleFromMobileBar(page);
      await expect(selectVehicleButton(page).or(page.getByRole("button", { name: /^Vehicle$/i })).first()).toBeVisible();
    });
  });
});
