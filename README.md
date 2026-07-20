# Testing-OneDirectBuy

Playwright E2E automation for **OneDirectBuy**.

## Setup

```bash
npm ci
npx playwright install
copy .env.example .env
```

Edit `.env` with credentials. Never commit `.env`.

## Run

```bash
npm test                 # full suite
npm run test:smoke       # Login.spec.js
npm run test:cart        # Cart.spec.js
npm run test:headed      # headed browser
npm run test:ui          # Playwright UI mode
```

## Structure

```
tests/
  OneDirectBuy/      # specs + seller.csv
  helpers/           # auth, nav, seller, address helpers
  fixtures/          # uiAwareTest.js
lib/                 # shared framework utilities
reporters/           # custom Playwright reporters
```

## CI

GitHub Actions (`.github/workflows/playwright.yml`) runs on push/PR to `main`, `master`, or `develop`.

**Control which specs run:** edit `ci-tests.config.json` — set `"enabled": false` to skip a file in the default `regression` suite. Suites:

| Suite | Command | What runs |
|-------|---------|-----------|
| `regression` (push default) | `npm run test:regression` | files with `enabled: true` |
| `smoke` | `npm run test:smoke` | files listed in `suites.smoke` |
| `all` | `npm run test:all` | every file in `tests[]` |

Reports are written to `reports/<timestamp>/` (HTML, JSON, JUnit, summary). CI uploads the `reports/` folder as a workflow artifact.
