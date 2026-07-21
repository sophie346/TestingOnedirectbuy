/**
 * Helpers for the gated buyer purchase journey.
 * Soft-check product UI; hard-abort on infra / failed preconditions to avoid cascade noise.
 */
import { expect } from "@playwright/test";
import {
  ensureLoggedInBuyer,
  hasBuyerCredentials,
  fillInputField,
} from "./oneDirectBuyAuth.js";
import {
  gotoOneDirectBuy,
  dismissCookieBanner,
  waitForCartReady,
  waitForShopProducts,
  ONE_DIRECT_BUY_BASE_URL,
} from "./oneDirectBuyNav.js";
import {
  fillAddressForm,
  clickSaveAddress,
  testAddressData,
} from "./oneDirectBuyAddress.js";
import { MARKERS, isInfraError } from "./softCheck.js";

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertSiteReachable(page) {
  try {
    await page.goto(ONE_DIRECT_BUY_BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
  } catch (err) {
    if (isInfraError(err)) throw err;
    throw err;
  }
  const url = page.url();
  if (/chrome-error:\/\//i.test(url)) {
    throw new Error(`Site unreachable (chrome-error): ${url}`);
  }
  await dismissCookieBanner(page);
}

/**
 * Soft step that stops the journey when it fails (no cascade soft noise).
 * @param {(id: string, title: string, fn: () => Promise<void>, opts?: object) => Promise<boolean>} soft
 * @param {string} id
 * @param {string} title
 * @param {() => Promise<void>} fn
 * @param {{ severity?: string }} [opts]
 */
export async function requireSoft(soft, id, title, fn, opts = {}) {
  const ok = await soft(id, title, fn, {
    severity: opts.severity || "critical",
    ...opts,
  });
  if (!ok) {
    await soft(
      `${id}-blocked`,
      `Journey stopped after failed step: ${title}`,
      async () => {
        throw new Error(
          `Required step ${id} failed — remaining journey steps were not executed.`,
        );
      },
      {
        severity: "minor",
        marker: MARKERS.BLOCKED,
        category: "infra",
      },
    );
  }
  return ok;
}

/**
 * @param {import('@playwright/test').Page} page
 */
/**
 * Empty the shopping cart if it has lines (keeps checkout shipping/payment reliable).
 * @param {import('@playwright/test').Page} page
 */
export async function clearCart(page) {
  await gotoOneDirectBuy(page, "/account/shopping-cart");
  await waitForCartReady(page);
  if (await page.getByText(/Your cart is empty/i).isVisible({ timeout: 3_000 }).catch(() => false)) {
    return;
  }

  for (let i = 0; i < 20; i++) {
    const remove = page
      .getByRole("button", { name: /remove|delete/i })
      .or(page.locator('button[aria-label*="emove" i], a[aria-label*="emove" i], .ps-cart__remove, .ps-product__remove'))
      .or(page.locator(".ps-cart-item button, .ps-shopping-cart button").filter({ hasText: /^×$|^x$/i }))
      .first();

    if (!(await remove.isVisible({ timeout: 2_000 }).catch(() => false))) {
      // Fallback: click visible × icons in cart rows
      const xBtn = page.locator(".ps-shopping-cart, main").locator("button, a").filter({ hasText: /^[×x]$/ }).first();
      if (!(await xBtn.isVisible({ timeout: 1_000 }).catch(() => false))) break;
      await xBtn.click({ force: true });
    } else {
      await remove.click({ force: true });
    }
    await page.waitForTimeout(800);
    if (await page.getByText(/Your cart is empty/i).isVisible({ timeout: 2_000 }).catch(() => false)) {
      return;
    }
  }
}

export async function loginForPurchase(page) {
  if (!hasBuyerCredentials()) {
    throw new Error(
      "Set ONEDIRECTBUY_BUYER_EMAIL and ONEDIRECTBUY_BUYER_PASSWORD in .env",
    );
  }
  await ensureLoggedInBuyer(page);
  await gotoOneDirectBuy(page, "/account/my-account");
  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 15_000 });
  // Give Firebase/header a moment to hydrate after account shell loads.
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await dismissCookieBanner(page);
  await expect(
    page
      .locator(".ps-widget--account-dashboard")
      .getByText(/^Logout$/i)
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  // Fresh cart so shipping rates / payment stay reliable.
  await clearCart(page);
}

/**
 * Dismiss Ant Design / modal error dialogs (e.g. out-of-stock on ATC).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} dialog text if any
 */
export async function dismissErrorModal(page) {
  const ok = page.getByRole("button", { name: /^OK$/i });
  let text = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const modal = page.locator(
      ".ant-modal-content:visible, .ant-modal-confirm:visible, .ant-modal-body:visible, [role='dialog']:visible",
    );
    const modalVisible = await modal
      .first()
      .isVisible({ timeout: 1_500 })
      .catch(() => false);
    const okVisible = await ok.first().isVisible({ timeout: 1_000 }).catch(() => false);
    if (!modalVisible && !okVisible) break;

    if (modalVisible && !text) {
      text = (await modal.first().innerText().catch(() => "")) || "";
    } else if (okVisible && !text) {
      // Confirm body often sits next to OK
      text =
        (await page.locator(".ant-modal-confirm-content, .ant-modal-body").first().innerText().catch(() => "")) ||
        "";
    }

    if (okVisible) {
      await ok.first().click({ force: true });
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ productHref: string; stockMismatch?: string }>}
 */
export async function addProductAndOpenCart(page) {
  // "bearing" SKUs often show IN STOCK but ATC returns out of stock — use a keyword
  // that still has addable inventory for the purchase journey.
  const keyword = process.env.ONEDIRECTBUY_ATC_KEYWORD || "filter";
  /** @type {string} */
  let stockMismatch = "";

  /**
   * @param {number} maxTries
   */
  async function tryAddButtons(maxTries) {
    const listingAdds = page.getByRole("button", { name: /^Add To Cart$/i });
    const listingCount = await listingAdds.count();
    for (let i = 0; i < Math.min(listingCount, maxTries); i++) {
      await dismissCookieBanner(page);
      await dismissErrorModal(page);
      const btn = listingAdds.nth(i);
      if (!(await btn.isVisible({ timeout: 3_000 }).catch(() => false))) continue;
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true });

      const notice = page.locator(".ant-notification-notice").filter({
        hasText: /Cart Updated|added to your cart/i,
      });
      if (await notice.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // Backend cart write can lag behind the toast.
        await page.waitForTimeout(1500);
        return true;
      }

      const modalText = await dismissErrorModal(page);
      if (/out of stock/i.test(modalText)) {
        if (!stockMismatch) {
          stockMismatch = modalText.replace(/\s+/g, " ").trim();
        }
      }
    }
    return false;
  }

  async function openSearchAndAdd() {
    await gotoOneDirectBuy(page, `/search?keyword=${encodeURIComponent(keyword)}`);
    await expect(
      page.getByRole("heading", { name: /Search result for/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\d+\s+record/i)).toBeVisible({ timeout: 30_000 });
    await dismissCookieBanner(page);
    return tryAddButtons(6);
  }

  let added = await openSearchAndAdd();

  if (!added) {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);
    await dismissCookieBanner(page);
    added = await tryAddButtons(8);
  }

  await dismissErrorModal(page);
  await gotoOneDirectBuy(page, "/account/shopping-cart");
  await waitForCartReady(page);

  let empty = await page
    .getByText(/Your cart is empty/i)
    .isVisible({ timeout: 3_000 })
    .catch(() => false);

  if (empty) {
    // Retry once — logged-in cart sync is occasionally delayed / dropped.
    added = await openSearchAndAdd();
    await dismissErrorModal(page);
    await gotoOneDirectBuy(page, "/account/shopping-cart");
    await waitForCartReady(page);
    empty = await page
      .getByText(/Your cart is empty/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  if (empty) {
    const hint = stockMismatch
      ? ` Also: UI showed In stock but ATC returned: ${stockMismatch}`
      : "";
    throw new Error(
      `Cart is empty after add-to-cart — no in-stock product could be added.${hint}`,
    );
  }

  await expect(page.getByText(/^Cart\b/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Subtotal/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("link", { name: /^Proceed to checkout$/i }),
  ).toBeVisible({ timeout: 15_000 });

  return { productHref: "/product/", stockMismatch };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function proceedToCheckout(page) {
  await dismissCookieBanner(page);
  const cta = page.getByRole("link", { name: /^Proceed to checkout$/i });
  if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/account\/checkout/, { timeout: 30_000 }),
      cta.click(),
    ]);
  } else {
    await gotoOneDirectBuy(page, "/account/checkout");
  }

  await expect(
    page.getByRole("heading", { name: /^Checkout Information$/i }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Your order/i).first()).toBeVisible({
    timeout: 15_000,
  });
  const total = page
    .getByText(/Total due\s*:?\s*\$\s*\d/i)
    .or(page.getByRole("heading", { name: /Total\s*\$/i }))
    .or(page.getByText(/Subtotal\s*:?\s*\$\s*\d/i))
    .first();
  await expect(total).toBeVisible({ timeout: 15_000 });
  const totalText = (await total.innerText().catch(() => "")).replace(/\s+/g, " ");
  if (/\$\s*0(\.00)?\b/.test(totalText) && !/\$\s*[1-9]/.test(totalText)) {
    throw new Error(`Checkout total is zero — cart did not carry into checkout: ${totalText}`);
  }
}

/**
 * Fill shipping on checkout (guest or logged-in form).
 * Checkout unlocks: address + ZIP → shipping rates → payment (Stripe).
 * @param {import('@playwright/test').Page} page
 */
export async function fillCheckoutShipping(page) {
  await dismissCookieBanner(page);
  const data = {
    ...testAddressData(`j${Date.now()}`),
    email: process.env.ONEDIRECTBUY_BUYER_EMAIL || "buyer@example.com",
  };

  const emailField = page.getByRole("textbox", { name: /^Email \*$/i });
  if (await emailField.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const current = await emailField.inputValue().catch(() => "");
    if (!current) {
      await fillInputField(emailField, data.email);
    }
  }

  // Always fill shipping fields — "saved address" radios are easy to false-match.
  await fillAddressForm(page, data);
  await clickSaveAddress(page);

  // Shipping methods appear after a valid US ZIP is saved.
  const shippingMethod = page
    .getByRole("radio")
    .or(page.locator('input[type="radio"]'))
    .or(page.getByText(/standard|express|economy|shipping/i))
    .first();

  const ratesReady = page.getByText(/Enter a complete US ZIP code/i);
  for (let i = 0; i < 15; i++) {
    if (!(await ratesReady.isVisible({ timeout: 1_000 }).catch(() => false))) {
      break;
    }
    await page.waitForTimeout(500);
  }

  // Pick first available shipping rate if present.
  const rateOption = page
    .locator(".ps-checkout, main")
    .getByRole("radio")
    .first();
  if (await rateOption.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await rateOption.check({ force: true }).catch(async () => {
      await rateOption.click({ force: true });
    });
  } else if (await shippingMethod.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await shippingMethod.click({ force: true }).catch(() => {});
  }

  await expect(
    page.getByRole("heading", { name: /^Checkout Information$/i }),
  ).toBeVisible({ timeout: 15_000 });

  // After save, the form is replaced by a selected address card + shipping rates.
  const savedCard = page
    .getByText(/Selected/i)
    .or(page.getByText(/Ship to/i))
    .or(page.getByText(data.line1))
    .first();
  await expect(savedCard).toBeVisible({ timeout: 20_000 });

  // Prefer the cheapest / first rate if none selected yet.
  const fastest = page.getByText(/^Fastest$/i).or(page.getByText(/USPS|FedEx|Ground/i)).first();
  if (await fastest.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await fastest.click({ force: true }).catch(() => {});
  }

  // Wait until payment unlocks (Pay now) when rates are available.
  const payBtn = page.getByRole("button", { name: /^Pay now$/i });
  await payBtn.isVisible({ timeout: 20_000 }).catch(() => false);
}

/**
 * Fill Stripe sandbox card fields (Payment Element / Card Element iframes).
 * Uses common test card 4242 4242 4242 4242.
 * @param {import('@playwright/test').Page} page
 */
async function fillStripeSandboxCard(page) {
  const cardNumber =
    process.env.ONEDIRECTBUY_STRIPE_TEST_CARD || "4242424242424242";
  const cardExp = process.env.ONEDIRECTBUY_STRIPE_TEST_EXP || "12 / 34";
  const cardCvc = process.env.ONEDIRECTBUY_STRIPE_TEST_CVC || "123";
  const cardZip = process.env.ONEDIRECTBUY_STRIPE_TEST_ZIP || "34746";

  // Ensure Stripe payment method is selected.
  const stripeRadio = page
    .getByRole("radio", { name: /Visa|Master Card|Stripe|Card/i })
    .or(page.getByText(/Visa\s*\/\s*Master Card\s*\(Stripe\)/i))
    .first();
  if (await stripeRadio.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await stripeRadio.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  /** Type into a Stripe field with retries (Elements often need slow keystrokes). */
  async function typeInto(locator, value) {
    await locator.click({ force: true });
    await locator.fill("").catch(() => {});
    await locator.pressSequentially(value, { delay: 40 });
  }

  // 1) Accessible placeholders on page (rare) or shadow hosts
  const pageCard = page.getByPlaceholder(/Card number/i);
  if (await pageCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await typeInto(pageCard, cardNumber);
    const exp = page.getByPlaceholder(/MM\s*\/\s*YY|Expiry|Exp\.?/i);
    if (await exp.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await typeInto(exp, cardExp);
    }
    const cvc = page.getByPlaceholder(/CVC|CVV|Security/i);
    if (await cvc.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await typeInto(cvc, cardCvc);
    }
    return true;
  }

  // 2) Stripe named / titled iframes (Card Element)
  const numberFrame = page.frameLocator(
    'iframe[title*="card number" i], iframe[name*="cardnumber" i], iframe[title*="Secure card number" i]',
  );
  const numberInput = numberFrame
    .locator(
      'input[name="cardnumber"], input[autocomplete="cc-number"], input[placeholder*="Card number" i]',
    )
    .first();
  if (await numberInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await typeInto(numberInput, cardNumber);

    const expFrame = page.frameLocator(
      'iframe[title*="expir" i], iframe[name*="exp" i], iframe[title*="Secure expiration" i]',
    );
    const expInput = expFrame
      .locator(
        'input[name="exp-date"], input[autocomplete="cc-exp"], input[placeholder*="MM" i]',
      )
      .first();
    if (await expInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeInto(expInput, cardExp);
    }

    const cvcFrame = page.frameLocator(
      'iframe[title*="CVC" i], iframe[title*="security" i], iframe[name*="cvc" i]',
    );
    const cvcInput = cvcFrame
      .locator(
        'input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder*="CVC" i]',
      )
      .first();
    if (await cvcInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeInto(cvcInput, cardCvc);
    }

    const zipFrame = page.frameLocator(
      'iframe[title*="ZIP" i], iframe[title*="postal" i]',
    );
    const zipInput = zipFrame
      .locator('input[name="postal"], input[autocomplete="postal-code"]')
      .first();
    if (await zipInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await typeInto(zipInput, cardZip);
    }
    return true;
  }

  // 3) Payment Element — single / nested stripe iframes
  const stripeFrames = page.locator(
    'iframe[src*="stripe"], iframe[src*="elements"], iframe[name*="__privateStripeFrame"]',
  );
  const frameCount = await stripeFrames.count();
  for (let i = 0; i < frameCount; i++) {
    const frame = page.frameLocator(
      `iframe[src*="stripe"], iframe[src*="elements"], iframe[name*="__privateStripeFrame"]`,
    ).nth(i);
    const input = frame
      .locator(
        'input[name="number"], input[name="cardnumber"], input[autocomplete="cc-number"], [placeholder*="Card number" i]',
      )
      .first();
    if (await input.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await typeInto(input, cardNumber);
      const exp = frame
        .locator(
          'input[name="expiry"], input[name="exp-date"], input[autocomplete="cc-exp"], [placeholder*="MM" i]',
        )
        .first();
      if (await exp.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await typeInto(exp, cardExp);
      }
      const cvc = frame
        .locator(
          'input[name="cvc"], input[autocomplete="cc-csc"], [placeholder*="CVC" i]',
        )
        .first();
      if (await cvc.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await typeInto(cvc, cardCvc);
      }
      return true;
    }
  }

  // 4) Last resort: walk all child frames
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const input = frame.locator(
      'input[name="cardnumber"], input[name="number"], input[autocomplete="cc-number"]',
    );
    if (await input.first().isVisible({ timeout: 400 }).catch(() => false)) {
      await input.first().click();
      await input.first().pressSequentially(cardNumber, { delay: 40 });
      const exp = frame.locator(
        'input[name="exp-date"], input[name="expiry"], input[autocomplete="cc-exp"]',
      );
      if (await exp.first().isVisible({ timeout: 800 }).catch(() => false)) {
        await exp.first().pressSequentially(cardExp, { delay: 40 });
      }
      const cvc = frame.locator(
        'input[name="cvc"], input[autocomplete="cc-csc"]',
      );
      if (await cvc.first().isVisible({ timeout: 800 }).catch(() => false)) {
        await cvc.first().pressSequentially(cardCvc, { delay: 40 });
      }
      return true;
    }
  }

  return false;
}

/**
 * Attempt to place order / pay with Stripe sandbox test card.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ placed: boolean; detail: string; orderHint: string }>}
 */
export async function attemptPlaceOrder(page) {
  await dismissCookieBanner(page);

  const payLocked = page.getByText(
    /Select a shipping method above to enable payment/i,
  );
  if (await payLocked.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const rateOption = page
      .locator(".ps-checkout, main")
      .getByRole("radio")
      .first();
    if (await rateOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rateOption.check({ force: true }).catch(async () => {
        await rateOption.click({ force: true });
      });
      await page.waitForTimeout(1500);
    }
  }

  const payBtn = page
    .getByRole("button", {
      name: /Place order|Pay now|Complete order|Confirm (and )?pay|Submit order|Proceed to payment|Pay \$/i,
    })
    .first();

  // If rates failed, try editing ZIP once more before giving up on Pay now.
  const noQuotes = page.getByText(/No shipping quotes for this ZIP/i);
  if (await noQuotes.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const edit = page.getByRole("button", { name: /edit/i }).or(page.locator('[aria-label*="dit" i]')).first();
    if (await edit.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await edit.click({ force: true });
      await page.waitForTimeout(500);
    }
    const zip = page
      .getByRole("textbox", { name: /Zip/i })
      .first();
    if (await zip.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fillInputField(zip, process.env.ONEDIRECTBUY_STRIPE_TEST_ZIP || "34746");
      await clickSaveAddress(page);
      await page.waitForTimeout(2000);
      const rate = page.getByText(/^Fastest$/i).or(page.getByText(/USPS|FedEx|Ground/i)).first();
      if (await rate.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await rate.click({ force: true }).catch(() => {});
      }
    }
  }

  if (!(await payBtn.isVisible({ timeout: 30_000 }).catch(() => false))) {
    const hint = await page
      .getByText(/No shipping quotes|Select a shipping method above to enable payment/i)
      .first()
      .innerText()
      .catch(() => "");
    return {
      placed: false,
      detail:
        hint ||
        "No Pay now button — shipping method missing, payment locked.",
      orderHint: "",
    };
  }

  await expect(payBtn).toBeVisible({ timeout: 5_000 });

  const cardFilled = await fillStripeSandboxCard(page);
  if (!cardFilled) {
    return {
      placed: false,
      detail:
        "Stripe card iframe/fields not found — cannot fill sandbox card 4242…",
      orderHint: "",
    };
  }

  await page.waitForTimeout(800);
  await payBtn.click();

  // Payment can take a few seconds in sandbox.
  const successUrl = page
    .waitForURL(/payment-success|order-success|\/account\/orders/i, {
      timeout: 60_000,
    })
    .then(() => true)
    .catch(() => false);

  const successHeading = page
    .getByRole("heading", {
      name: /Payment success|Thank you|order is confirmed|Order confirmed/i,
    })
    .first()
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);

  const success = (await successUrl) || (await successHeading);

  if (success) {
    const body = await page.locator("body").innerText().catch(() => "");
    const orderMatch = body.match(
      /Order\s*(?:#|number|ID)?\s*[:#]?\s*([A-Z0-9-]{6,})/i,
    );
    return {
      placed: true,
      detail: `Reached confirmation at ${page.url()}`,
      orderHint: orderMatch ? orderMatch[1] : "",
    };
  }

  const noticeText = await page
    .locator(".ant-notification-notice-message, .ant-modal-confirm-content")
    .first()
    .innerText()
    .catch(() => "");

  return {
    placed: false,
    detail: [
      `Still at ${page.url()} after Pay now with Stripe test card 4242…`,
      noticeText ? `Notice: ${noticeText.slice(0, 160)}` : "No error toast.",
    ]
      .filter(Boolean)
      .join(" "),
    orderHint: "",
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [orderHint]
 */
export async function assertOrderInAccount(page, orderHint = "") {
  // Checkout often runs as guest contact email even after an earlier login —
  // re-authenticate before asserting Orders.
  if (hasBuyerCredentials()) {
    await loginForPurchase(page);
  }

  await gotoOneDirectBuy(page, "/account/orders");

  if (/\/account\/login/i.test(page.url())) {
    await loginForPurchase(page);
    await gotoOneDirectBuy(page, "/account/orders");
  }

  await expect(page).not.toHaveURL(/\/account\/login$/, { timeout: 15_000 });

  const heading = page
    .getByRole("heading", { name: /Orders|My Orders|Order History/i })
    .or(page.getByText(/Recent orders|Your orders/i))
    .or(page.locator(".ps-widget--account-dashboard").getByText(/^Orders$/i))
    .first();
  await expect(heading).toBeVisible({ timeout: 30_000 });

  if (orderHint) {
    await expect(page.getByText(orderHint).first()).toBeVisible({
      timeout: 20_000,
    });
  } else {
    const anyOrder = page
      .getByText(/Order\s*#|Order ID|Total|\$\d/i)
      .or(page.locator("table tbody tr"))
      .first();
    await expect(anyOrder).toBeVisible({ timeout: 20_000 });
  }
}
