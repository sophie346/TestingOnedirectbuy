import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Homepage", () => {
  test("ODB-UC-026: homepage loads successfully without broken layout", async ({
    page,
    soft,
  }) => {
    await gotoOneDirectBuy(page, "/");

    await soft("ODB-UC-026-a", "Homepage title contains OneDirectBuy", async () => {
      await expect(page).toHaveTitle(/OneDirectBuy/i);
    });

    await soft("ODB-UC-026-b", "Free Delivery heading visible", async () => {
      await expect(page.getByRole("heading", { name: /Free Delivery/i })).toBeVisible();
    });

    await soft("ODB-UC-026-c", "Secure Payment heading visible", async () => {
      await expect(page.getByRole("heading", { name: /Secure Payment/i })).toBeVisible();
    });

    await soft("ODB-UC-026-d", "Search button visible", async () => {
      await expect(page.getByRole("button", { name: /^Search$/i })).toBeVisible();
    });
  });

  test("ODB-UC-506: homepage loads within accepted performance limit", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-506", "Homepage loads within 15s", async () => {
      const start = Date.now();
      await gotoOneDirectBuy(page, "/");
      await expect(page.getByRole("heading", { name: /Free Delivery/i })).toBeVisible();
      const loadMs = Date.now() - start;
      expect(loadMs).toBeLessThan(15_000);
    });
  });
});
