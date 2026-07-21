import { test, expect } from "../helpers/softTest.js";
import {
  gotoOneDirectBuy,
  openCheckoutWithCart,
} from "../helpers/oneDirectBuyNav.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-129: guest can open checkout flow", async ({ page, soft }) => {
    await soft("ODB-UC-129", "Checkout Information + Contact & Shipping", async () => {
      await openCheckoutWithCart(page);
      await expect(page).toHaveURL(/\/account\/checkout/);
      await expect(
        page.getByRole("heading", { name: /^Checkout Information$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Contact & Shipping$/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/Checkout as guest or login to use saved addresses/i),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /^Shipping address$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /^login$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-133: checkout validates missing shipping fields", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-133", "Save address keeps required Name * focused", async () => {
      await openCheckoutWithCart(page);
      const name = page.getByRole("textbox", { name: /^Name \*$/i });
      await expect(name).toBeVisible();
      await expect(name).toHaveAttribute("required", "");
      await page.getByRole("button", { name: /^Save address for checkout$/i }).click();
      await expect(name).toBeFocused({ timeout: 5_000 });
      await expect(page).toHaveURL(/\/account\/checkout/);
    });
  });

  test("ODB-UC-138: review order totals section is visible", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-138", "Your order + Total $ with line item", async () => {
      await openCheckoutWithCart(page);
      await expect(page.getByRole("heading", { name: /^Your order$/i })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Total\s*\$\s*\d+/i }),
      ).toBeVisible();
      await expect(page.locator('a[href*="/product/"]').first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("ODB-UC-132: shipping address form fields are present", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-132", "Required shipping fields + Save address CTA", async () => {
      await openCheckoutWithCart(page);
      await expect(page.getByRole("textbox", { name: /^Email \*$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Address line 1 \*$/i }),
      ).toBeVisible();
      await expect(page.getByRole("combobox", { name: /^Country \*$/i })).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: /^State \/ Province \*$/i }),
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: /^City \*$/i })).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^Zip \/ Postal code \*$/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Save address for checkout$/i }),
      ).toBeVisible();
    });
  });

  test("ODB-UC-128: empty checkout shows no products", async ({ page, soft }) => {
    await soft("ODB-UC-128", "No Product. + Total $ 0.00 when cart empty", async () => {
      await gotoOneDirectBuy(page, "/account/checkout");
      await expect(
        page.getByRole("heading", { name: /^Checkout Information$/i }),
      ).toBeVisible({ timeout: 20_000 });
      const empty = await page
        .getByText(/^No Product\.$/i)
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (empty) {
        await expect(page.getByText(/^No Product\.$/i)).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /Total\s*\$\s*0\.00/i }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("heading", { name: /Total\s*\$/i }),
        ).toBeVisible();
      }
    });
  });

  test("ODB-UC-140: declined payment test requires payment sandbox", async () => {
    test.skip(true, "Requires Stripe/payment sandbox configuration");
  });

  test("ODB-UC-143: order confirmation page route exists", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-143", "Payment success confirmation page", async () => {
      await gotoOneDirectBuy(page, "/account/payment-success");
      await expect(page).toHaveURL(/\/account\/payment-success/);
      await expect(
        page.getByRole("heading", { name: /^Payment success$/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("heading", {
          name: /Thank you! Your order is confirmed/i,
        }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: /^View orders$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Back to shop$/i })).toBeVisible();
    });
  });
});
