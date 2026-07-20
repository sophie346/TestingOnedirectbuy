/**
 * Environment loading and typed accessors.
 * Never hardcode credentials here — read from process.env / `.env` only.
 */

const fs = require("fs");
const path = require("path");
const { createLogger } = require("./logger");

const log = createLogger("env");

let loaded = false;

/**
 * Load `.env` once (idempotent). Safe to call from config, setup, and scripts.
 * @param {{ path?: string; override?: boolean }} [options]
 */
function loadEnv(options = {}) {
  if (loaded && !options.override) {
    return process.env;
  }

  const envPath = options.path || path.resolve(process.cwd(), ".env");
  try {
    // Lazy require so scripts work even if dotenv is mid-install.
    // eslint-disable-next-line global-require
    require("dotenv").config({
      path: envPath,
      override: Boolean(options.override),
    });
    if (fs.existsSync(envPath)) {
      log.debug(`Loaded environment from ${envPath}`);
    } else {
      log.debug(`.env not found at ${envPath}; using process.env only`);
    }
  } catch (err) {
    log.warn(`Failed to load dotenv: ${err instanceof Error ? err.message : String(err)}`);
  }

  applyAliases();
  loaded = true;
  return process.env;
}

/**
 * Map generic aliases onto product-specific vars without overwriting explicit values.
 */
function applyAliases() {
  const pairs = [
    ["BASE_URL", "PLAYWRIGHT_BASE_URL"],
    ["USERNAME", "TEST_LOGIN_EMAIL"],
    ["PASSWORD", "TEST_LOGIN_PASSWORD"],
    ["HEADLESS", "PW_HEADLESS"],
    ["API_TOKEN", "REPORT_UPLOAD_AUTH_TOKEN"],
    ["API_URL", "REPORT_API_URL"],
  ];

  for (const [alias, target] of pairs) {
    if (process.env[alias] && !process.env[target]) {
      process.env[target] = process.env[alias];
    }
  }

  // HEADLESS=true/false → PW_HEADLESS / PW_HEADED
  const headless = String(process.env.HEADLESS || "").toLowerCase();
  if (headless === "true" || headless === "1") {
    process.env.PW_HEADLESS = process.env.PW_HEADLESS || "1";
  } else if (headless === "false" || headless === "0") {
    process.env.PW_HEADED = process.env.PW_HEADED || "1";
  }
}

/**
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string}
 */
function getEnv(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and set values.`,
    );
  }
  return value;
}

/**
 * @param {string} name
 * @param {boolean} [defaultValue=false]
 */
function getBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || String(raw).toLowerCase() === "true";
}

/**
 * @param {string} name
 * @param {number} defaultValue
 */
function getNumber(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function isCI() {
  return getBool("CI", false);
}

/**
 * Active logical environment: local | ci | staging | production
 */
function getTestEnvironment() {
  if (process.env.TEST_ENV) return String(process.env.TEST_ENV).toLowerCase();
  if (isCI()) return "ci";
  return "local";
}

/**
 * Resolve whether browsers should run headless.
 */
function resolveHeadless() {
  if (getBool("PW_HEADED", false)) return false;
  if (getBool("PW_HEADLESS", false)) return true;
  if (getBool("HEADLESS", false)) return true;
  return isCI();
}

/**
 * Worker count: PW_WORKERS wins; default remains 1 (serial-safe for shared apps).
 * Set PW_WORKERS=2+ in CI or locally when the suite is known parallel-safe.
 */
function resolveWorkers() {
  if (process.env.PW_WORKERS !== undefined && process.env.PW_WORKERS !== "") {
    return getNumber("PW_WORKERS", 1) || 1;
  }
  return 1;
}

module.exports = {
  loadEnv,
  applyAliases,
  getEnv,
  requireEnv,
  getBool,
  getNumber,
  isCI,
  getTestEnvironment,
  resolveHeadless,
  resolveWorkers,
};
