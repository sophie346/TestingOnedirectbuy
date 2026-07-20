/**
 * Lightweight structured logger for framework scripts and reporters.
 * Levels: debug | info | warn | error
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel() {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

function stamp() {
  return new Date().toISOString();
}

function write(level, scope, message, meta) {
  if (LEVELS[level] < resolveLevel()) return;
  const prefix = `[${stamp()}] [${level.toUpperCase()}]${scope ? ` [${scope}]` : ""}`;
  const line =
    meta !== undefined
      ? `${prefix} ${message} ${typeof meta === "string" ? meta : JSON.stringify(meta)}`
      : `${prefix} ${message}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * @param {string} [scope]
 */
function createLogger(scope = "") {
  return {
    debug: (message, meta) => write("debug", scope, message, meta),
    info: (message, meta) => write("info", scope, message, meta),
    warn: (message, meta) => write("warn", scope, message, meta),
    error: (message, meta) => write("error", scope, message, meta),
  };
}

module.exports = {
  createLogger,
  logger: createLogger("framework"),
};
