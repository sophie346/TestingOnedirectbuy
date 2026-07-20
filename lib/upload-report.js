/**
 * POST Playwright HTML report to the testing reports upload endpoint.
 * Matches marketplace multer: upload.single("htmlFile") — field name must be htmlFile, body is HTML.
 */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const DEFAULT_URL =
  process.env.REPORT_UPLOAD_URL ||
  "https://dev.onechanneladmin.com/marketplace/testingreports/upload";

const PLACEHOLDER_TOKENS = new Set([
  "",
  "your-bearer-jwt-token-here",
  "changeme",
  "replace-me",
]);

const DEFAULT_CLIENT_NAME = process.env.REPORT_UPLOAD_CLIENT_NAME || "oneauto";

/** Multer field name in testingReportsApis: upload.single("htmlFile") */
const DEFAULT_HTML_FIELD_NAME =
  process.env.REPORT_UPLOAD_FIELD_NAME || "htmlFile";

const REPORT_UPLOAD_DEBUG =
  process.env.REPORT_UPLOAD_DEBUG === "1" ||
  process.env.REPORT_UPLOAD_DEBUG === "true";

/**
 * @param {string} [token]
 */
function isConfiguredUploadToken(token = process.env.REPORT_UPLOAD_AUTH_TOKEN) {
  const value = String(token || "").trim();
  return value.length > 0 && !PLACEHOLDER_TOKENS.has(value);
}

/**
 * Whether HTML report upload should run.
 * Strictly opt-in via REPORT_UPLOAD=1 (CI no longer auto-uploads).
 */
function isReportUploadEnabled() {
  if (
    process.env.REPORT_UPLOAD === "0" ||
    process.env.REPORT_UPLOAD === "false"
  ) {
    return false;
  }
  return (
    (process.env.REPORT_UPLOAD === "1" ||
      process.env.REPORT_UPLOAD === "true") &&
    isConfiguredUploadToken()
  );
}

/**
 * @param {string} body
 * @param {number} [maxLen]
 */
function summarizeHttpErrorBody(body, maxLen = 240) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.includes("Cloudflare") || text.includes("cf-error-details")) {
    const ray = text.match(/Cloudflare Ray ID:\s*([a-f0-9]+)/i);
    return ray
      ? `(Cloudflare blocked this request; Ray ID ${ray[1]})`
      : "(Cloudflare blocked this request)";
  }
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

/**
 * @param {Record<string, string>} headers
 */
function redactHeadersForLog(headers) {
  const out = { ...headers };
  if (out.Authorization) {
    out.Authorization = "Bearer <redacted>";
  }
  return out;
}

/**
 * @param {{ url: string; method: string; fieldName: string; fileBytes: number; filename: string; mimeType: string; headers: Record<string, string> }} p
 */
function traceUploadBeforeFetch(p) {
  if (!REPORT_UPLOAD_DEBUG) return;
  console.log("[upload-report] trace (before fetch)");
  console.log("  URL:", p.url);
  console.log("  Method:", p.method);
  console.log("  Multipart file field:", p.fieldName);
  console.log("  Filename:", p.filename);
  console.log("  MIME:", p.mimeType);
  console.log("  File size (bytes):", p.fileBytes);
  console.log("  Headers:", redactHeadersForLog(p.headers));
}

/**
 * @param {string} sourceDir absolute path to folder to zip
 * @param {string} zipPath absolute path for output .zip
 */
async function zipDirectory(sourceDir, zipPath) {
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/**
 * Build auth + client headers for the upload request.
 * @param {{ headers?: Record<string, string> }} [options]
 */
function buildUploadHeaders(options = {}) {
  const token = String(process.env.REPORT_UPLOAD_AUTH_TOKEN || "").trim();
  const mergedHeaders = {
    clientname: DEFAULT_CLIENT_NAME,
    ...(options.headers || {}),
  };
  if (token && !mergedHeaders.Authorization) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }
  return mergedHeaders;
}

/**
 * POST multipart/form-data with file bytes (Blob), not a path string.
 * @param {string} filePath absolute path to file to read
 * @param {{ url?: string; fieldName?: string; filename?: string; mimeType?: string; headers?: Record<string, string>; name?: string; description?: string; _id?: string }} [options]
 */
async function uploadMultipartFile(filePath, options = {}) {
  const url = options.url || DEFAULT_URL;
  const fieldName = options.fieldName || DEFAULT_HTML_FIELD_NAME;
  const buffer = await fs.promises.readFile(filePath);
  const filename = options.filename || path.basename(filePath);
  const mimeType = options.mimeType || "application/octet-stream";

  const form = new FormData();
  const name =
    options.name ?? process.env.REPORT_UPLOAD_NAME ?? "Playwright HTML Report";
  const description =
    options.description ?? process.env.REPORT_UPLOAD_DESCRIPTION ?? "";
  const templateId = options._id ?? process.env.REPORT_UPLOAD_TEMPLATE_ID;
  if (templateId) {
    form.append("_id", String(templateId));
  }
  form.append("name", String(name));
  form.append("description", String(description));

  const blob = new Blob([buffer], { type: mimeType });
  form.append(fieldName, blob, filename);

  const mergedHeaders = buildUploadHeaders(options);

  traceUploadBeforeFetch({
    url,
    method: "POST",
    fieldName,
    fileBytes: buffer.length,
    filename,
    mimeType,
    headers: mergedHeaders,
  });

  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: mergedHeaders,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = summarizeHttpErrorBody(text);
    throw new Error(
      `Report upload failed: HTTP ${res.status} ${res.statusText}${detail ? ` ${detail}` : ""}`.trim(),
    );
  }
}

/**
 * @deprecated Prefer uploadMultipartFile; kept for callers that upload a pre-built zip path.
 * @param {string} zipPath
 * @param {{ url?: string; fieldName?: string; headers?: Record<string, string> }} [options]
 */
async function uploadZip(zipPath, options = {}) {
  const fieldName =
    options.fieldName || process.env.REPORT_UPLOAD_FIELD_NAME || "file";
  await uploadMultipartFile(zipPath, {
    ...options,
    fieldName,
    filename: path.basename(zipPath),
    mimeType: "application/zip",
  });
}

/**
 * Upload Playwright HTML report: reads `index.html` from the report folder and POSTs it to match
 * `upload.single("htmlFile")` with HTML body validation on the server.
 * @param {string} reportDir absolute path to playwright HTML report directory
 * @param {{ url?: string; fieldName?: string; name?: string; description?: string; _id?: string }} [options]
 */
async function zipAndUploadReport(reportDir, options = {}) {
  const stat = await fs.promises.stat(reportDir).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(
      `Report directory not found or not a directory: ${reportDir}`,
    );
  }

  const indexHtml = path.join(reportDir, "index.html");
  await fs.promises.access(indexHtml).catch(() => {
    throw new Error(`Playwright HTML report not found: ${indexHtml}`);
  });

  await uploadMultipartFile(indexHtml, {
    ...options,
    fieldName: options.fieldName || DEFAULT_HTML_FIELD_NAME,
    filename: "index.html",
    mimeType: "text/html",
  });
}

module.exports = {
  zipDirectory,
  uploadZip,
  uploadMultipartFile,
  zipAndUploadReport,
  isConfiguredUploadToken,
  isReportUploadEnabled,
  summarizeHttpErrorBody,
  DEFAULT_URL,
};
