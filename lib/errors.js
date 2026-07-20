/**
 * Safe error helpers for framework code (scripts / reporters).
 */

/**
 * @param {unknown} err
 * @returns {string}
 */
function errorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * @param {unknown} err
 * @returns {{ message: string; stack?: string }}
 */
function serializeError(err) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

/**
 * Run an async function and never throw — log via callback instead.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {(err: unknown) => void} onError
 * @returns {Promise<T|undefined>}
 */
async function swallowAsync(fn, onError) {
  try {
    return await fn();
  } catch (err) {
    onError(err);
    return undefined;
  }
}

module.exports = {
  errorMessage,
  serializeError,
  swallowAsync,
};
