import { test, expect } from "@playwright/test";
import { gotoOneDirectBuy } from "../helpers/oneDirectBuyNav.js";

test.describe("OneDirectBuy — Homepage", () => {
  test("ODB-UC-026: homepage loads successfully without broken layout", async ({
    page,
  }) => {
    await gotoOneDirectBuy(page, "/");
    await expect(page).toHaveTitle(/OneDirectBuy/i);
    await expect(page.getByRole("heading", { name: /Free Delivery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Secure Payment/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Search$/i })).toBeVisible();
  });

  test("ODB-UC-506: homepage loads within accepted performance limit", async ({
    page,
  }) => {
    const start = Date.now();
    await gotoOneDirectBuy(page, "/");
    await expect(page.getByRole("heading", { name: /Free Delivery/i })).toBeVisible();
    const loadMs = Date.now() - start;
    expect(loadMs).toBeLessThan(15_000);
  });
});
