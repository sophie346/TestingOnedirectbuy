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

## Deploy

| Role | URL |
|------|-----|
| UI | https://onetest.onechanneladmin.com |
| Backend / API | https://dev-onetest.onechanneladmin.com |

Same GKE Deployment (`onetest`). See **[DEPLOY.md](./DEPLOY.md)**.

```bash
gcloud builds submit --config=cloudbuild.yaml --project=gentle-epoch-277301 .
kubectl apply -f <onechanneladmin-latest>/deploymentsAll/ui/deployment-onetest.yaml
```

## CI

GitHub Actions (`.github/workflows/playwright.yml`) runs on push/PR to `main`, `master`, or `develop`.

- **Browser:** Chromium only (no Firefox/WebKit)
- **Speed:** `CI_FAST=1` — 4 workers, 1 retry, no video, traces only on retry, lean reporters
- **Soft pass:** `CI_SOFT_PASS=1` — UI mismatches are recorded in `ISSUES.md` with markers (`[MISSING-ELEMENT]`, `[STRICT-MODE]`, …); the Actions check stays **green**
- **Reports:** `reports/<timestamp>/` (HTML + `ISSUES.md` + summary) uploaded as one artifact
- Set `CI_SOFT_PASS=0` if you want hard failures to fail the job

**Control which specs run:** edit `ci-tests.config.json` — set `"enabled": false` to skip a file in the default `regression` suite.

| Suite | Command | What runs |
|-------|---------|-----------|
| `regression` (push default) | `npm run test:regression` | files with `enabled: true` |
| `smoke` | `npm run test:smoke` | files listed in `suites.smoke` |
| `all` | `npm run test:all` | every file in `tests[]` |
