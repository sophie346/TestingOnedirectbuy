/**
 * Upload dashboard-ready test results JSON to a remote API.
 *
 * Reads Playwright JSON report (test-results/results.json by default),
 * builds a rich payload, and POSTs via fetch().
 *
 * Env (no hardcoded URLs/tokens):
 *   REPORT_API_URL | API_URL   — destination endpoint
 *   API_TOKEN | REPORT_UPLOAD_AUTH_TOKEN — Bearer token
 *   REPORT_JSON_PATH — override path to results.json
 *   DASHBOARD_UPLOAD=1 — enable remote upload (also runs in CI when URL+token set)
 *
 * Usage: npx tsx scripts/upload-report.ts
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { loadEnv, getEnv, getBool } = require("../lib/env");
const { PATHS } = require("../lib/constants");
const { classifyAttachments } = require("../lib/artifacts");
const { createLogger } = require("../lib/logger");
const { errorMessage } = require("../lib/errors");

loadEnv();
const log = createLogger("upload-report");

interface PlaywrightAttachment {
  name?: string;
  path?: string;
  contentType?: string;
}

interface PlaywrightResult {
  status?: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  retry?: number;
  errors?: Array<{ message?: string; stack?: string }>;
  attachments?: PlaywrightAttachment[];
}

interface PlaywrightTest {
  title?: string;
  results?: PlaywrightResult[];
  outcome?: string;
  status?: string;
  expectedStatus?: string;
}

interface PlaywrightSpec {
  title?: string;
  file?: string;
  tests?: PlaywrightTest[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
  stats?: {
    startTime?: string;
    duration?: number;
  };
}

export interface DashboardTestDetail {
  testName: string;
  file: string;
  suite: string;
  status: string;
  duration: number;
  error: string;
  retryCount: number;
  screenshotPath: string;
  videoPath: string;
  tracePath: string;
}

export interface DashboardPayload {
  repository: string;
  branch: string;
  commitSha: string;
  githubRunId: string;
  buildNumber: string;
  buildUrl: string;
  timestamp: string;
  environment: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
  tests: DashboardTestDetail[];
}

function readJsonReport(reportPath: string): PlaywrightJsonReport {
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `JSON report not found at ${reportPath}. Run tests first (npm test) so the json reporter writes results.`,
    );
  }
  const raw = fs.readFileSync(reportPath, "utf8");
  return JSON.parse(raw) as PlaywrightJsonReport;
}

function normalizeStatus(raw?: string): string {
  const s = String(raw || "").toLowerCase();
  if (s === "expected" || s === "passed" || s === "pass") return "passed";
  if (s === "unexpected" || s === "failed" || s === "fail") return "failed";
  if (s === "skipped" || s === "skip") return "skipped";
  if (s === "flaky") return "flaky";
  if (s === "timedout" || s === "interrupted") return "failed";
  return s || "unknown";
}

function flattenSuites(
  suites: PlaywrightSuite[] | undefined,
  parentSuite = "",
): DashboardTestDetail[] {
  const details: DashboardTestDetail[] = [];
  if (!suites) return details;

  for (const suite of suites) {
    const suiteName = [parentSuite, suite.title].filter(Boolean).join(" › ");

    for (const spec of suite.specs || []) {
      const file = spec.file || suite.file || "";
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const last = results[results.length - 1] || {};
        const status = normalizeStatus(test.status || test.outcome || last.status);
        const retryCount = Math.max(
          0,
          results.length > 0 ? results.length - 1 : 0,
        );
        const duration = results.reduce(
          (sum, r) => sum + (Number(r.duration) || 0),
          0,
        );
        const err =
          last.error?.message ||
          last.errors?.[0]?.message ||
          results
            .map((r) => r.error?.message || r.errors?.[0]?.message)
            .filter(Boolean)
            .pop() ||
          "";

        const allAttachments = results.flatMap((r) => r.attachments || []);
        const artifacts = classifyAttachments(allAttachments);

        details.push({
          testName: spec.title || test.title || "unknown",
          file,
          suite: suiteName || path.dirname(file) || "root",
          status,
          duration,
          error: err,
          retryCount,
          screenshotPath: artifacts.screenshotPath,
          videoPath: artifacts.videoPath,
          tracePath: artifacts.tracePath,
        });
      }
    }

    details.push(...flattenSuites(suite.suites, suiteName));
  }

  return details;
}

function buildGitMetadata() {
  const repository =
    getEnv("GITHUB_REPOSITORY") ||
    getEnv("REPO_NAME") ||
    path.basename(process.cwd());
  const branch =
    getEnv("GITHUB_REF_NAME") ||
    getEnv("GITHUB_HEAD_REF") ||
    getEnv("BRANCH_NAME") ||
    getEnv("GIT_BRANCH") ||
    "local";
  const commitSha =
    getEnv("GITHUB_SHA") || getEnv("COMMIT_SHA") || getEnv("GIT_COMMIT") || "local";
  const githubRunId = getEnv("GITHUB_RUN_ID") || "";
  const buildNumber =
    getEnv("GITHUB_RUN_NUMBER") || getEnv("BUILD_NUMBER") || githubRunId || "0";
  const serverUrl = getEnv("GITHUB_SERVER_URL", "https://github.com");
  const buildUrl =
    getEnv("BUILD_URL") ||
    (githubRunId && repository
      ? `${serverUrl}/${repository}/actions/runs/${githubRunId}`
      : "");

  return { repository, branch, commitSha, githubRunId, buildNumber, buildUrl };
}

export function buildDashboardPayload(report: PlaywrightJsonReport): DashboardPayload {
  const tests = flattenSuites(report.suites);
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;
  const flaky = tests.filter((t) => t.status === "flaky").length;
  const duration =
    Number(report.stats?.duration) ||
    tests.reduce((sum, t) => sum + t.duration, 0);
  const git = buildGitMetadata();

  return {
    ...git,
    timestamp: report.stats?.startTime || new Date().toISOString(),
    environment: getEnv("TEST_ENV") || (getBool("CI", false) ? "ci" : "local"),
    totalTests: tests.length,
    passed,
    failed,
    skipped,
    flaky,
    duration,
    tests,
  };
}

function resolveApiUrl(): string {
  const url = getEnv("REPORT_API_URL") || getEnv("API_URL");
  if (!url) {
    throw new Error(
      "Missing REPORT_API_URL (or API_URL). Set the dashboard upload endpoint in the environment.",
    );
  }
  return url;
}

function resolveApiToken(): string {
  const token = getEnv("API_TOKEN") || getEnv("REPORT_UPLOAD_AUTH_TOKEN");
  if (!token || token === "your-bearer-jwt-token-here") {
    throw new Error(
      "Missing API_TOKEN (or REPORT_UPLOAD_AUTH_TOKEN). Refusing to upload without a token.",
    );
  }
  return token;
}

async function uploadPayload(payload: DashboardPayload): Promise<void> {
  const url = resolveApiUrl();
  const token = resolveApiToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const clientName = getEnv("REPORT_UPLOAD_CLIENT_NAME");
  if (clientName) headers.clientname = clientName;

  log.info(`Uploading dashboard payload to ${url}`, {
    totalTests: payload.totalTests,
    passed: payload.passed,
    failed: payload.failed,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Dashboard upload failed: HTTP ${res.status} ${res.statusText}${
        text ? ` — ${text.slice(0, 300)}` : ""
      }`,
    );
  }

  log.info("Dashboard report uploaded successfully");
}

function shouldUploadRemote(): boolean {
  // Strictly opt-in — disabled unless DASHBOARD_UPLOAD=1 (no CI auto-upload).
  if (getEnv("DASHBOARD_UPLOAD") === "0" || getEnv("DASHBOARD_UPLOAD") === "false") {
    return false;
  }
  return getBool("DASHBOARD_UPLOAD", false);
}

async function main(): Promise<void> {
  const reportPath =
    getEnv("REPORT_JSON_PATH") ||
    getEnv("PW_JSON_REPORT_PATH") ||
    PATHS.jsonReport;

  const absolute = path.isAbsolute(reportPath)
    ? reportPath
    : path.join(process.cwd(), reportPath);

  log.info(`Reading JSON report: ${absolute}`);
  const report = readJsonReport(absolute);
  const payload = buildDashboardPayload(report);

  const outPath = path.join(PATHS.testResults, "dashboard-payload.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  log.info(`Wrote local dashboard payload: ${outPath}`);

  if (!shouldUploadRemote()) {
    log.info(
      "Skipping remote upload (set DASHBOARD_UPLOAD=1 plus REPORT_API_URL and API_TOKEN)",
    );
    return;
  }

  try {
    await uploadPayload(payload);
  } catch (err) {
    const message = errorMessage(err);
    log.error(message);
    if (getBool("REPORT_UPLOAD_STRICT", false) || getBool("DASHBOARD_UPLOAD_STRICT", false)) {
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  log.error(errorMessage(err));
  process.exitCode = 1;
});
