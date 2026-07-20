const fs = require("fs/promises");
const path = require("path");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * @typedef {{
 *   stepIndex: number;
 *   stepName: string;
 *   url: string;
 *   title: string;
 *   screenshotPath: string;
 *   pageData: Record<string, unknown>;
 * }} StepCapture
 */

/**
 * @typedef {{
 *   uiIssues: Array<{ severity: string; step: string; issue: string; suggestion: string }>;
 *   enhancements: Array<{ step: string; enhancement: string; rationale: string }>;
 *   recommendedFlow: Array<{ order: number; step: string; action: string; notes?: string }>;
 *   summary: string;
 * }} UiAnalysisResult
 */

/**
 * @param {string} imagePath
 */
async function imageToDataUrl(imagePath) {
  const buffer = await fs.readFile(imagePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * @param {StepCapture[]} steps
 * @param {{ testFile: string; testTitle?: string }} context
 * @returns {Promise<UiAnalysisResult>}
 */
async function analyzeUiCaptures(steps, context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it to enable UI analysis after test files run.",
    );
  }

  if (!steps.length) {
    throw new Error("No UI captures found to analyze.");
  }

  const systemPrompt = `You are a senior QA engineer and UX reviewer reviewing Playwright end-to-end test captures.
Analyze screenshots and page reference data for UI bugs, accessibility problems, confusing UX, missing feedback states, and test-flow gaps.
Return ONLY valid JSON (no markdown fences) matching this schema:
{
  "summary": "string",
  "uiIssues": [{ "severity": "critical|major|minor", "step": "string", "issue": "string", "suggestion": "string" }],
  "enhancements": [{ "step": "string", "enhancement": "string", "rationale": "string" }],
  "recommendedFlow": [{ "order": 1, "step": "string", "action": "string", "notes": "string" }]
}
Focus on actionable Playwright test steps and real UI problems visible in the captures.`;

  const stepSummaries = steps.map((step) => ({
    stepIndex: step.stepIndex,
    stepName: step.stepName,
    url: step.url,
    title: step.title,
    pageData: step.pageData,
  }));

  /** @type {Array<Record<string, unknown>>} */
  const userContent = [
    {
      type: "text",
      text: `Test file: ${context.testFile}
Test title: ${context.testTitle || "n/a"}
Review each step screenshot and page data. Suggest an improved E2E flow order and extra assertions.

Step metadata:
${JSON.stringify(stepSummaries, null, 2)}`,
    },
  ];

  for (const step of steps) {
    const dataUrl = await imageToDataUrl(step.screenshotPath);
    userContent.push({
      type: "text",
      text: `--- Step ${step.stepIndex}: ${step.stepName} (${step.url}) ---`,
    });
    userContent.push({
      type: "image_url",
      image_url: { url: dataUrl, detail: "high" },
    });
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error: HTTP ${response.status} ${response.statusText} ${errorText}`.trim(),
    );
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI API returned an empty response.");
  }

  return /** @type {UiAnalysisResult} */ (JSON.parse(content));
}

/**
 * @param {UiAnalysisResult} analysis
 * @param {{ testFile: string; testTitle?: string }} context
 */
function formatAnalysisMarkdown(analysis, context) {
  const lines = [
    `# UI Analysis — ${path.basename(context.testFile)}`,
    "",
    `**Test:** ${context.testTitle || "n/a"}`,
    `**File:** ${context.testFile}`,
    "",
    "## Summary",
    analysis.summary || "_No summary provided._",
    "",
    "## UI Issues",
  ];

  if (!analysis.uiIssues?.length) {
    lines.push("_No issues reported._");
  } else {
    for (const issue of analysis.uiIssues) {
      lines.push(
        `- **[${issue.severity}]** (${issue.step}) ${issue.issue} — _${issue.suggestion}_`,
      );
    }
  }

  lines.push("", "## Enhancements");
  if (!analysis.enhancements?.length) {
    lines.push("_No enhancements suggested._");
  } else {
    for (const item of analysis.enhancements) {
      lines.push(
        `- **${item.step}:** ${item.enhancement} — _${item.rationale}_`,
      );
    }
  }

  lines.push("", "## Recommended E2E Flow");
  if (!analysis.recommendedFlow?.length) {
    lines.push("_No flow recommendations._");
  } else {
    for (const step of [...analysis.recommendedFlow].sort(
      (a, b) => a.order - b.order,
    )) {
      lines.push(
        `${step.order}. **${step.step}** — ${step.action}${step.notes ? ` (${step.notes})` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  analyzeUiCaptures,
  formatAnalysisMarkdown,
  DEFAULT_MODEL,
};
