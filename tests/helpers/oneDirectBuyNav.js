import { expect } from "@playwright/test";

export const ONE_DIRECT_BUY_BASE_URL =
  process.env.ONEDIRECTBUY_BASE_URL || "https://onedirectbuy.com";

const DEFAULT_TIMEOUT = 15_000;

/** Dismiss cookie consent banner when shown. */
export async function dismissCookieBanner(page) {
  const dialog = page.getByRole("dialog", { name: /We value your privacy/i });
  const acceptAll = page.getByRole("button", { name: /Accept all/i });
  const rejectOptional = page.getByRole("button", { name: /Reject optional/i });

  if (await dialog.isVisible({ timeout: 8000 }).catch(() => false)) {
    if (await acceptAll.isVisible().catch(() => false)) {
      await acceptAll.click({ force: true });
    } else if (await rejectOptional.isVisible().catch(() => false)) {
      await rejectOptional.click({ force: true });
    }
    await expect(dialog).toBeHidden({ timeout: 10_000 }).catch(() => {});
  } else if (await acceptAll.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptAll.click({ force: true });
  }
}

/**
 * AI assistant / chat can mount over the page and mark the main tree
 * aria-hidden, which makes getByRole miss Menu/Vehicle/etc.
 */
export async function dismissAssistantOverlay(page) {
  // Prefer explicit conversation closers — avoid generic "Close" which can
  // match unrelated dialogs/toasts.
  const closers = [
    page.getByRole("button", { name: /^Close conversations$/i }),
    page.getByRole("button", { name: /^Dismiss suggestions$/i }),
    page.getByRole("button", { name: /^Close assistant$/i }),
  ];
  for (const btn of closers) {
    const target = btn.first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}

/** Navigate to a OneDirectBuy path and dismiss cookies. */
export async function gotoOneDirectBuy(page, path = "/") {
  const url = path.startsWith("http")
    ? path
    : `${ONE_DIRECT_BUY_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (!/no healthy upstream|503|502 bad gateway/i.test(bodyText)) {
      break;
    }
    await page.waitForTimeout(2000 * (attempt + 1));
  }

  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
}

/** Wait until the shop listing has loaded products. */
export async function waitForShopProducts(page) {
  await dismissCookieBanner(page);
  const countLabel = page.getByText(/[1-9]\d*\s+Products found/i);
  const productOrAdd = page
    .locator("button.add-to-cart")
    .or(
      page.locator(
        '.ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"], main a[href*="/product/"]',
      ),
    )
    .first();

  // Prefer a non-zero count label; fall back to visible product cards/controls.
  const hasCount = await countLabel
    .isVisible({ timeout: 30_000 })
    .catch(() => false);
  if (!hasCount) {
    await expect(productOrAdd).toBeVisible({ timeout: 120_000 });
  } else {
    await expect(productOrAdd).toBeVisible({ timeout: 60_000 });
  }
}

/** Sort control on shop/search listing (not the header Product category combobox). */
export function shopSortSelect(page) {
  return page
    .getByRole("combobox", { name: /Sort items/i })
    .or(page.getByLabel(/Sort items/i))
    .or(page.locator('select[aria-label="Sort items"]'))
    .first();
}

/** Run a header keyword search like a shopper (type + Search). */
export async function searchProducts(page, keyword) {
  await dismissCookieBanner(page);
  const box = page.getByRole("textbox", { name: /Search products/i });
  await expect(box).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await box.fill(keyword);
  await Promise.all([
    page.waitForURL(/\/search\?/, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Search$/i }).click(),
  ]);
  await dismissCookieBanner(page);
}

/** Open the first in-stock product detail page from the shop listing. */
export async function openFirstProductFromShop(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);
  const productLink = page.locator('a[href*="/product/"]').first();
  await productLink.click();
  await page.waitForURL(/\/product\//, { timeout: DEFAULT_TIMEOUT });
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: DEFAULT_TIMEOUT,
  });
}

/** Open a known in-stock PDP via search (faster / more stable than shop scan). */
export async function openKnownProductDetail(page, keyword = "bearing") {
  await gotoOneDirectBuy(page, `/search?keyword=${encodeURIComponent(keyword)}`);
  await expect(
    page.getByRole("heading", { name: /Search result for/i }),
  ).toBeVisible({ timeout: 30_000 });
  const productLink = page
    .locator(
      '.ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"], main a[href*="/product/"]',
    )
    .first();
  await expect(productLink).toBeVisible({ timeout: 60_000 });
  await Promise.all([
    page.waitForURL(/\/product\//, { timeout: 30_000 }),
    productLink.click(),
  ]);
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });
}

/** PDP Add to cart control (live site uses a link, not always a button). */
export function productAddToCartControl(page) {
  return page
    .getByRole("link", { name: /^Add to cart$/i })
    .or(page.getByRole("button", { name: /^Add To Cart$|^Add to cart$/i }))
    .first();
}

async function waitForCartAddSuccess(page) {
  // Toast is the fastest signal on shop-grid add.
  const addedNotice = page.locator(".ant-notification-notice").filter({
    hasText: /Cart Updated|added to your cart|successfully added/i,
  });
  if (
    await addedNotice
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false)
  ) {
    return true;
  }

  // Header badge: live UI uses "1 Cart", "2 Cart", …
  if (
    await page
      .getByRole("link", { name: /[1-9]\d*\s*Cart/i })
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false)
  ) {
    return true;
  }

  if (/shopping-cart/i.test(page.url())) {
    return true;
  }

  return false;
}

/** Add the first available product to cart from the shop page. */
export async function addFirstProductToCartFromShop(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);
  await dismissCookieBanner(page);

  // Fast path: shop-grid Add To Cart (class add-to-cart).
  const shopAdds = page.locator("button.add-to-cart:not([disabled])");
  const shopCount = await shopAdds.count();
  for (let index = 0; index < Math.min(shopCount, 5); index++) {
    const btn = shopAdds.nth(index);
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ force: true });
    if (await waitForCartAddSuccess(page)) {
      return;
    }
  }

  // Fallback: open PDP and add from there.
  const productLinks = page.locator(
    '.ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"], main a[href*="/product/"]',
  );
  const totalLinks = await productLinks.count();

  for (let index = 0; index < Math.min(totalLinks, 5); index++) {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);

    await productLinks.nth(index).click();
    await page.waitForURL(/\/product\//, { timeout: DEFAULT_TIMEOUT });
    await dismissCookieBanner(page);

    if (
      await page
        .getByText(/^Out of stock$/i)
        .isVisible({ timeout: 1500 })
        .catch(() => false)
    ) {
      continue;
    }

    const addControl = productAddToCartControl(page);
    if (!(await addControl.isVisible({ timeout: 5000 }).catch(() => false))) {
      continue;
    }

    await addControl.click({ force: true });
    if (await waitForCartAddSuccess(page)) {
      return;
    }
  }

  throw new Error(
    "Could not add a product to cart after trying multiple products",
  );
}

/** Wait until cart page finishes loading (empty or with lines). */
export async function waitForCartReady(page) {
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
  await expect(page.getByText(/Loading your cart/i))
    .toBeHidden({ timeout: 30_000 })
    .catch(() => {});
  await expect(
    page
      .getByRole("heading", { name: /^Cart$/i })
      .or(page.getByText(/Your cart is empty/i))
      .first(),
  ).toBeVisible({ timeout: 20_000 });
}

/** Open cart via header cart link or direct URL. */
export async function openCart(page) {
  await dismissCookieBanner(page);
  // Prefer direct navigation — more reliable than header click after toast.
  await gotoOneDirectBuy(page, "/account/shopping-cart");
  await waitForCartReady(page);
}

/** First cart line "Remove item" control (page can have multiple lines). */
export function cartRemoveItemButton(page) {
  return page
    .locator("button.ps-cart-line__remove")
    .or(page.getByRole("button", { name: /^Remove item$/i }))
    .first();
}

/** First cart line quantity spinbutton. */
export function cartQuantityInput(page) {
  return page
    .locator(".ps-cart-line")
    .getByRole("spinbutton", { name: /^Quantity$/i })
    .or(page.getByRole("spinbutton", { name: /^Quantity$/i }))
    .first();
}

/** First cart line increase-quantity control. */
export function cartIncreaseQtyButton(page) {
  return page
    .locator(".ps-cart-line")
    .getByRole("button", { name: /^Increase quantity$/i })
    .or(page.getByRole("button", { name: /^Increase quantity$/i }))
    .first();
}

/** Add a shop product then open /account/checkout. */
export async function openCheckoutWithCart(page) {
  await addFirstProductToCartFromShop(page);
  await gotoOneDirectBuy(page, "/account/checkout");
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: /^Checkout Information$/i }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Desktop: open the "Shop by Department" mega-menu (div.menu__toggle[role=button]). */
export async function openShopByDepartment(page) {
  await dismissCookieBanner(page);
  const trigger = page
    .locator(".menu__toggle[role='button']")
    .filter({ hasText: /Shop by Department/i })
    .or(page.getByRole("button", { name: /Shop by Department/i }))
    .first();

  await expect(trigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await trigger.hover().catch(() => {});
  await trigger.click();

  const categoryLink = page.locator('a[href*="/category/exterior"]').first();
  if (!(await categoryLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await trigger.click({ force: true });
  }

  await expect(
    page
      .getByRole("link", {
        name: /^(Exterior|Interior|Lighting|Performance)$/i,
      })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
}

/** Open Shop by Department and navigate into Exterior like a shopper. */
export async function openDepartmentCategory(page, categoryName = "Exterior") {
  await openShopByDepartment(page);
  const link = page
    .getByRole("link", { name: new RegExp(`^${categoryName}$`, "i") })
    .first();
  await link.click();
  await page.waitForURL(new RegExp(`/category/`, "i"), {
    timeout: DEFAULT_TIMEOUT,
  });
  await dismissCookieBanner(page);
}

/** Mobile bottom bar: open Menu drawer (Home / Shop / Vendor / Blogs). */
export async function openMobileNav(page) {
  await dismissCookieBanner(page);
  const menu = page.getByRole("button", { name: /^Menu$/i });
  await expect(menu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await menu.click();
  await expect(page.getByRole("heading", { name: /^Menu$/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page
      .getByRole("link", { name: /^Shop$/i })
      .or(page.getByRole("menuitem", { name: /^Shop$/i })),
  ).toBeVisible({ timeout: 10_000 });
}

/** Click site logo (`a.ps-logo`) back to homepage. */
export async function clickLogoHome(page) {
  await dismissCookieBanner(page);
  const logo = page.locator("a.ps-logo").first();
  await expect(logo).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await logo.click();
  await page.waitForURL(/\/?$/, { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissCookieBanner(page);
}
