# GitHub Actions secrets & variables

Do **not** commit `.env`. Local `.env` is gitignored. CI reads from GitHub **Secrets** / **Variables**.

## Required Secrets
Repo → **Settings → Secrets and variables → Actions → Secrets**

| Secret | Example / notes |
|--------|-----------------|
| `ONEDIRECTBUY_BUYER_EMAIL` | Buyer (or admin) login email |
| `ONEDIRECTBUY_BUYER_PASSWORD` | Matching password |
| `ONEDIRECTBUY_ADMIN_EMAIL` | Optional; falls back to buyer if unset |
| `ONEDIRECTBUY_ADMIN_PASSWORD` | Optional; falls back to buyer if unset |
| `ONEDIRECTBUY_SELLER_EMAIL` | Optional (seller specs) |
| `ONEDIRECTBUY_SELLER_PASSWORD` | Optional |
| `ONEDIRECTBUY_TEST_COUPON` | Optional (coupon specs) |

Minimum for the purchase journey + auth specs: **buyer email + password**.

## Optional Variables
Repo → **Settings → Secrets and variables → Actions → Variables**

| Variable | Default in workflow |
|----------|---------------------|
| `ONEDIRECTBUY_BASE_URL` | `https://onedirectbuy.com` |
| `ONEDIRECTBUY_ATC_KEYWORD` | `filter` |
| `ONEDIRECTBUY_STRIPE_TEST_CARD` | `4242424242424242` |
| `ONEDIRECTBUY_STRIPE_TEST_EXP` | `12 / 34` |
| `ONEDIRECTBUY_STRIPE_TEST_CVC` | `123` |
| `ONEDIRECTBUY_STRIPE_TEST_ZIP` | `34746` |

Stripe sandbox values are public test data and are already defaulted in `.github/workflows/playwright.yml`.

## Suites
- **smoke** — `BuyerPurchaseJourney` + Login + Homepage (`workflow_dispatch` or `CI_TEST_SUITE=smoke`)
- **regression** — all `enabled: true` files in `ci-tests.config.json` (default on push/PR)
- **all** — every listed file

## After push
1. Add the **Secrets** above (buyer at minimum).
2. Push / open PR → workflow **Playwright Tests** runs.
3. Or **Actions → Playwright Tests → Run workflow** → choose `smoke` first.
4. Download **test-reports** artifact → `ISSUES.json` → prefer `productIssues` for developers.
