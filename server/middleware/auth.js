/**
 * Optional API token gate. When API_TOKEN is unset, all requests are allowed.
 */
function optionalAuth(req, res, next) {
  const { API_TOKEN } = require("../config");
  if (!API_TOKEN) return next();

  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const token = bearer || req.headers["x-api-token"] || "";

  if (token !== API_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

module.exports = { optionalAuth };
