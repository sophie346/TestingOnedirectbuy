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
}

/** Wait until the shop listing has loaded products. */
export async function waitForShopProducts(page) {
  await dismissCookieBanner(page);
  const productLink = page.locator('a[href*="/product/"]');
  await expect(productLink.first()).toBeVisible({ timeout: 120_000 });
}

/** Open the first in-stock product detail page from the shop listing. */
export async function openFirstProductFromShop(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);
  const productLink = page.locator('a[href*="/product/"]').first();
  await productLink.click();
  await page.waitForURL(/\/product\//, { timeout: DEFAULT_TIMEOUT });
  await dismissCookieBanner(page);
  await expect(
    page.locator("h1, .ps-product__title, [role='alert']").first()
  ).toBeVisible({
    timeout: DEFAULT_TIMEOUT,
  });
}

async function waitForCartAddSuccess(page) {
  const addedNotice = page.locator(".ant-notification-notice").filter({
    hasText: /Cart Updated|added to your cart/i,
  });
  if (await addedNotice.isVisible({ timeout: 12_000 }).catch(() => false)) {
    return true;
  }

  const cartBadge = page.locator('a[href*="/shopping-cart"]');
  if (
    await cartBadge
      .filter({ hasText: /[1-9]/ })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    return true;
  }

  return false;
}

/** Add the first available product to cart from the shop page. */
export async function addFirstProductToCartFromShop(page) {
  await gotoOneDirectBuy(page, "/shop");
  await waitForShopProducts(page);

  for (let index = 0; index < 4; index++) {
    if (index > 0) {
      await gotoOneDirectBuy(page, "/shop");
      await waitForShopProducts(page);
    }

    const shopAddButton = page
      .locator(".ps-product, .ps-shop-items, main")
      .getByRole("button", { name: /Add To Cart/i })
      .nth(index);

    if (!(await shopAddButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      break;
    }

    await shopAddButton.click();
    if (await waitForCartAddSuccess(page)) {
      return;
    }
  }

  const productLinks = page.locator(
    '.ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"]'
  );
  const linkCount = await productLinks.count();
  const links =
    linkCount > 0 ? productLinks : page.locator('a[href*="/product/"]');
  const totalLinks = await links.count();

  for (let index = 0; index < Math.min(totalLinks, 6); index++) {
    await gotoOneDirectBuy(page, "/shop");
    await waitForShopProducts(page);

    const productLink = (
      linkCount > 0
        ? page.locator(
            '.ps-product a[href*="/product/"], .ps-shop-items a[href*="/product/"]'
          )
        : page.locator('a[href*="/product/"]')
    ).nth(index);

    await productLink.click();
    await page.waitForURL(/\/product\//, { timeout: DEFAULT_TIMEOUT });
    await dismissCookieBanner(page);

    if (await page.getByText(/^Out of stock$/i).isVisible({ timeout: 2000 }).catch(() => false)) {
      continue;
    }

    const addControl = page
      .getByRole("link", { name: /Add to cart/i })
      .or(page.getByRole("button", { name: /Add To Cart|Add to cart/i }))
      .first();

    if (!(await addControl.isVisible({ timeout: 5000 }).catch(() => false))) {
      continue;
    }

    await addControl.click();
    if (await waitForCartAddSuccess(page)) {
      return;
    }

    await page.waitForTimeout(1500);
    return;
  }

  throw new Error("Could not add a product to cart after trying multiple products");
}

/** Open cart via header shortcut or direct URL. */
export async function openCart(page) {
  await dismissCookieBanner(page);
  const cartButton = page.getByRole("button", { name: /^Cart$/i });
  if (await cartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cartButton.click();
  } else {
    await gotoOneDirectBuy(page, "/account/shopping-cart");
  }
}
