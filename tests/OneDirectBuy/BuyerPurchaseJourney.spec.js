/**
 * Single gated buyer journey:
 * login → add product → cart → checkout → place order → verify orders.
 *
 * Soft-checks product/UI failures only. Infra and failed preconditions stop
 * the journey so ISSUES.json does not fill with cascade noise.
 */
import { test, expect } from "../helpers/softTest.js";
import { hasBuyerCredentials } from "../helpers/oneDirectBuyAuth.js";
import {
  assertSiteReachable,
  requireSoft,
  loginForPurchase,
  addProductAndOpenCart,
  proceedToCheckout,
  fillCheckoutShipping,
  attemptPlaceOrder,
  assertOrderInAccount,
} from "../helpers/buyerPurchaseJourney.js";
import { MARKERS } from "../helpers/softCheck.js";

const DESKTOP = { width: 1920, height: 1080 };

test.describe("OneDirectBuy — Buyer purchase journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("JOURNEY-BUY-01: login → cart → checkout → order", async ({
    page,
    soft,
  }) => {
    test.setTimeout(6 * 60_000);

    if (!hasBuyerCredentials()) {
      test.skip(
        true,
        "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD in .env",
      );
      return;
    }

    /** @type {{ productHref: string; stockMismatch?: string }} */
    let cartState = { productHref: "" };
    /** @type {{ placed: boolean; detail: string; orderHint: string }} */
    let orderState = { placed: false, detail: "", orderHint: "" };

    // --- 0. Site reachable (infra) ---
    const siteOk = await soft(
      "J01-0",
      "Site is reachable",
      async () => {
        await assertSiteReachable(page);
      },
      { severity: "critical" },
    );
    if (!siteOk) {
      await soft(
        "J01-0-blocked",
        "Journey aborted — site unreachable (infra, not product)",
        async () => {
          throw new Error(
            "DNS/network failure — do not report remaining steps as product bugs.",
          );
        },
        { severity: "minor", marker: MARKERS.BLOCKED, category: "infra" },
      );
      return;
    }

    // --- 1. Login ---
    if (
      !(await requireSoft(soft, "J01-1", "Buyer logs in and reaches account", async () => {
        await loginForPurchase(page);
      }))
    ) {
      return;
    }

    // --- 2. Add product + cart ---
    if (
      !(await requireSoft(
        soft,
        "J01-2",
        "Add product to cart; cart shows line item + checkout CTA",
        async () => {
          cartState = await addProductAndOpenCart(page);
          expect(cartState.productHref).toBeTruthy();
        },
      ))
    ) {
      return;
    }

    // Advisory: UI said In stock but ATC returned out of stock (real product bug).
    if (cartState.stockMismatch) {
      await soft(
        "J01-2b",
        "Product shown In stock but Add to cart reports out of stock",
        async () => {
          throw new Error(cartState.stockMismatch);
        },
        { severity: "major" },
      );
    }

    // --- 3. Checkout page with cart contents ---
    if (
      !(await requireSoft(
        soft,
        "J01-3",
        "Proceed to checkout with product and non-zero total",
        async () => {
          await proceedToCheckout(page);
        },
      ))
    ) {
      return;
    }

    // --- 4. Shipping ---
    if (
      !(await requireSoft(
        soft,
        "J01-4",
        "Fill or select shipping address on checkout",
        async () => {
          await fillCheckoutShipping(page);
        },
      ))
    ) {
      return;
    }

    // --- 5. Place order with Stripe sandbox test card 4242… ---
    const payOk = await soft(
      "J01-5",
      "Place order with Stripe sandbox card reaches confirmation",
      async () => {
        orderState = await attemptPlaceOrder(page);
        if (!orderState.placed) {
          throw new Error(orderState.detail);
        }
      },
      { severity: "critical" },
    );

    // --- 6. Orders list (only if order was placed) ---
    if (payOk && orderState.placed) {
      await soft(
        "J01-6",
        "Order appears in account Orders",
        async () => {
          await assertOrderInAccount(page, orderState.orderHint);
        },
        { severity: "critical" },
      );
    } else {
      await soft(
        "J01-6-skipped",
        "Skipped order-history check — place order did not complete",
        async () => {
          throw new Error(
            "Blocked: payment/confirmation step did not succeed. Configure Stripe test mode or a pay bypass, then re-run.",
          );
        },
        { severity: "minor", marker: MARKERS.BLOCKED, category: "infra" },
      );
    }
  });
});
