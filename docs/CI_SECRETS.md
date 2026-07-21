# GitHub Actions secrets & variables

Do **not** commit `.env`. Local `.env` is gitignored. CI reads from GitHub **Secrets** / **Variables**.

## Current CI mode (no buyer secrets required)

Guest / public specs run. Buyer-auth specs are **`enabled: false`** until you add secrets:

- `BuyerPurchaseJourney.spec.js`
- `BuyerAccountAuthenticated.spec.js`
- `BuyerAddress.spec.js`
- `AdminBackend.spec.js`

## Buyer secrets (add later, then re-enable specs)

| Secret | Purpose |
|--------|---------|
| `ONEDIRECTBUY_BUYER_EMAIL` | Buyer login |
| `ONEDIRECTBUY_BUYER_PASSWORD` | Buyer password |
| `ONEDIRECTBUY_ADMIN_EMAIL` | Optional admin (falls back to buyer) |
| `ONEDIRECTBUY_ADMIN_PASSWORD` | Optional |
| `ONEDIRECTBUY_SELLER_EMAIL` | Optional seller specs |
| `ONEDIRECTBUY_SELLER_PASSWORD` | Optional |
| `ONEDIRECTBUY_TEST_COUPON` | Optional coupon specs |

After adding secrets: set `"enabled": true` on the disabled entries in `ci-tests.config.json` / `flows.config.json`.

## Optional Variables

| Variable | Default in workflow |
|----------|---------------------|
| `ONEDIRECTBUY_BASE_URL` | `https://onedirectbuy.com` |
| `ONEDIRECTBUY_ATC_KEYWORD` | `filter` |
| `ONEDIRECTBUY_STRIPE_TEST_CARD` | `4242424242424242` |
| `ONEDIRECTBUY_STRIPE_TEST_EXP` | `12 / 34` |
| `ONEDIRECTBUY_STRIPE_TEST_CVC` | `123` |
| `ONEDIRECTBUY_STRIPE_TEST_ZIP` | `34746` |

## Suites
- **smoke** — Login + Homepage
- **regression** — all `enabled: true` files (default on push/PR)
- **all** — every listed file (including disabled buyer ones if suite is `all` — prefer re-enable + regression)

## After push
1. Push / open PR → guest specs run without buyer secrets.
2. Or **Actions → Playwright Tests → Run workflow** → `smoke` / `regression`.
3. Download **test-reports** → `ISSUES.json` → prefer `productIssues` for developers.
