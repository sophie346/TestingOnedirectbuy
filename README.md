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

- **Browser:** Chromium only (no Firefox/WebKit)
- **Speed:** `CI_FAST=1` — 4 workers, 1 retry, no video, traces only on retry, lean reporters
- **Reports:** written directly to `reports/<timestamp>/` and uploaded as one artifact

**Control which specs run:** edit `ci-tests.config.json` — set `"enabled": false` to skip a file in the default `regression` suite.

| Suite | Command | What runs |
|-------|---------|-----------|
| `regression` (push default) | `npm run test:regression` | files with `enabled: true` |
| `smoke` | `npm run test:smoke` | files listed in `suites.smoke` |
| `all` | `npm run test:all` | every file in `tests[]` |
