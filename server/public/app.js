const state = {
  flows: [],
  filter: "all",
  selectedFlowId: null,
  occurrenceId: null,
  pollTimer: null,
  token: localStorage.getItem("odb_api_token") || "",
};

const $ = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (state.token) h.Authorization = `Bearer ${state.token}`;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...headers(Boolean(opts.body)), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || data?.raw || res.statusText;
    throw new Error(msg);
  }
  return data;
}

function filteredFlows() {
  return state.flows.filter((f) => {
    if (state.filter === "enabled") return f.enabled;
    if (state.filter === "disabled") return !f.enabled;
    return true;
  });
}

function renderFlowList() {
  const list = $("flowList");
  const flows = filteredFlows();
  $("flowCount").textContent = `${flows.length} shown · ${state.flows.length} total`;

  list.innerHTML = flows
    .map((f) => {
      const active = f.flowId === state.selectedFlowId ? "active" : "";
      return `
        <li>
          <button type="button" class="flow-item ${active}" data-id="${escapeAttr(f.flowId)}">
            <span class="name">${escapeHtml(f.name)}</span>
            <span class="meta">
              <span>#${escapeHtml(String(f.flowId))}</span>
              <span>${f.stepsTotal || 0} steps</span>
              <span>${f.enabled ? "enabled" : "off"}</span>
            </span>
          </button>
        </li>`;
    })
    .join("");

  list.querySelectorAll(".flow-item").forEach((btn) => {
    btn.addEventListener("click", () => selectFlow(btn.dataset.id));
  });
}

function selectFlow(flowId) {
  state.selectedFlowId = String(flowId);
  const flow = state.flows.find((f) => String(f.flowId) === state.selectedFlowId);
  renderFlowList();

  if (!flow) {
    $("emptyState").classList.remove("hidden");
    $("flowDetail").classList.add("hidden");
    return;
  }

  $("emptyState").classList.add("hidden");
  $("flowDetail").classList.remove("hidden");
  $("flowEyebrow").textContent = `Flow ${flow.flowId}`;
  $("flowTitle").textContent = flow.name;
  $("flowMeta").textContent = `${flow.tests?.length || 0} spec file(s) · ${
    flow.enabled ? "enabled" : "disabled in config"
  }`;
  $("stepCatalogCount").textContent = String(flow.steps?.length || 0);

  $("stepCatalog").innerHTML = (flow.steps || [])
    .map(
      (s) => `
      <li>
        <div>
          <span class="sid">${escapeHtml(s.stepId)}${
            s.dependsOn ? ` · after ${escapeHtml(s.dependsOn)}` : ""
          }</span>
          ${escapeHtml(s.title)}
        </div>
      </li>`,
    )
    .join("");
}

function setLiveIdle() {
  $("runBadge").className = "status-pill idle";
  $("runBadge").textContent = "idle";
  $("liveEmpty").classList.remove("hidden");
  $("liveBody").classList.add("hidden");
  $("btnLoadReport").disabled = true;
  $("reportBody").innerHTML =
    '<p class="muted">Report appears when the occurrence finishes.</p>';
}

function renderOccurrence(occ) {
  $("liveEmpty").classList.add("hidden");
  $("liveBody").classList.remove("hidden");

  const status = occ.status || "idle";
  $("runBadge").className = `status-pill ${status}`;
  $("runBadge").textContent = status;

  const pct = occ.progress?.percent ?? 0;
  $("progressFill").style.width = `${pct}%`;
  $("progressLabel").textContent = `${occ.stepsCompleted || 0} / ${
    occ.stepsTotal || 0
  } steps`;
  $("progressPct").textContent = `${pct}%`;
  $("occurrenceId").textContent = occ.occurrenceId;

  const terminal = ["passed", "failed", "cancelled"].includes(status);
  $("btnLoadReport").disabled = !terminal;
  $("btnRun").disabled = status === "running" || status === "queued";

  $("liveSteps").innerHTML = (occ.steps || [])
    .map((s) => {
      const err = s.error
        ? `<span class="err">${escapeHtml(String(s.error).slice(0, 220))}</span>`
        : "";
      return `
        <li>
          <span class="dot ${escapeAttr(s.status)}"></span>
          <div>
            <div class="title">${escapeHtml(s.title || s.stepId)}</div>
            <span class="sid mono" style="color:var(--muted)">${escapeHtml(
              s.stepId,
            )}</span>
            ${err}
          </div>
          <span class="st">${escapeHtml(s.status)}</span>
        </li>`;
    })
    .join("");

  // Live issues from DB (source of truth during the run)
  const liveIssues = occ.liveIssues || [];
  if (liveIssues.length && !terminal) {
    $("reportBody").innerHTML =
      `<p><strong>${liveIssues.length}</strong> live issue(s) in DB</p>` +
      liveIssues
        .slice(0, 30)
        .map((issue) => {
          const sev = (issue.severity || "major").toLowerCase();
          return `
            <div class="issue ${escapeAttr(sev)}">
              <p class="ih">${escapeHtml(issue.marker || "")} ${escapeHtml(
                issue.id || issue.step || "",
              )} — ${escapeHtml(issue.title || "")}</p>
              <p class="im">${escapeHtml(issue.evidence || issue.message || "")}</p>
            </div>`;
        })
        .join("");
  }

  if (terminal) {
    stopPolling();
    $("btnRun").disabled = false;
    loadReport(occ.occurrenceId).catch(() => {});
  }
}

async function loadReport(occurrenceId) {
  const id = occurrenceId || state.occurrenceId;
  if (!id) return;
  try {
    const report = await api(`/api/occurrences/${encodeURIComponent(id)}/report`);
    const issues = report.issues?.issues || report.issues || [];
    const list = Array.isArray(issues) ? issues : [];

    let html = `
      <p><strong>${list.length}</strong> issue(s)
      · flow <code>${escapeHtml(String(report.flowId || ""))}</code>
      · exit ${escapeHtml(String(report.summary?.exitCode ?? "—"))}</p>`;

    if (!list.length) {
      html += `<p class="muted" style="margin-top:0.75rem">No soft issues recorded for this run.</p>`;
    } else {
      html += list
        .slice(0, 40)
        .map((issue) => {
          const sev = (issue.severity || "major").toLowerCase();
          return `
            <div class="issue ${escapeAttr(sev)}">
              <p class="ih">${escapeHtml(issue.marker || "")} ${escapeHtml(
                issue.id || issue.step || "",
              )} — ${escapeHtml(issue.title || "")}</p>
              <p class="im">${escapeHtml(issue.evidence || issue.message || "")}</p>
            </div>`;
        })
        .join("");
    }

    if (report.artifactPaths?.runDir) {
      html += `<p class="mono muted" style="margin-top:0.75rem">Artifacts: ${escapeHtml(
        report.artifactPaths.runDir,
      )}</p>`;
    }

    $("reportBody").innerHTML = html;
  } catch (err) {
    $("reportBody").innerHTML = `<p class="muted">${escapeHtml(
      err.message || "Report not ready",
    )}</p>`;
  }
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function startPolling(occurrenceId) {
  stopPolling();
  state.occurrenceId = occurrenceId;
  const tick = async () => {
    try {
      const occ = await api(
        `/api/occurrences/${encodeURIComponent(occurrenceId)}`,
      );
      renderOccurrence(occ);
      await loadHistory();
    } catch (err) {
      toast(err.message, true);
      stopPolling();
      $("btnRun").disabled = false;
    }
  };
  tick();
  state.pollTimer = setInterval(tick, 1000);
}

async function runSelectedFlow() {
  if (!state.selectedFlowId) return;
  $("btnRun").disabled = true;
  setLiveIdle();
  try {
    const data = await api(
      `/api/flows/${encodeURIComponent(state.selectedFlowId)}/run`,
      {
        method: "POST",
        body: JSON.stringify({ headed: $("headedMode").checked }),
      },
    );
    toast(`Started occurrence ${data.occurrenceId.slice(0, 8)}…`);
    startPolling(data.occurrenceId);
  } catch (err) {
    toast(err.message, true);
    $("btnRun").disabled = false;
  }
}

async function loadFlows() {
  const data = await api("/api/flows");
  state.flows = data.flows || [];
  renderFlowList();
  if (state.selectedFlowId) selectFlow(state.selectedFlowId);
}

async function loadHistory() {
  const data = await api("/api/occurrences?limit=20");
  const items = data.occurrences || [];
  $("runHistory").innerHTML = items.length
    ? items
        .map(
          (o) => `
      <li>
        <button type="button" class="history-item" data-id="${escapeAttr(
          o.occurrenceId,
        )}" data-flow="${escapeAttr(o.flowId)}">
          <span class="name">${escapeHtml(o.flowName || o.flowId)}</span>
          <span class="meta">
            <span class="status-pill ${escapeAttr(o.status)}" style="padding:0.1rem 0.4rem">${escapeHtml(
              o.status,
            )}</span>
            <span>${o.stepsCompleted || 0}/${o.stepsTotal || 0}</span>
            <span>${formatTime(o.startedAt || o.createdAt)}</span>
          </span>
        </button>
      </li>`,
        )
        .join("")
    : `<li class="muted" style="padding:0.75rem">No runs yet</li>`;

  $("runHistory").querySelectorAll(".history-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      selectFlow(btn.dataset.flow);
      state.occurrenceId = btn.dataset.id;
      try {
        const occ = await api(
          `/api/occurrences/${encodeURIComponent(btn.dataset.id)}`,
        );
        renderOccurrence(occ);
        if (["running", "queued"].includes(occ.status)) {
          startPolling(occ.occurrenceId);
        } else {
          stopPolling();
          $("btnRun").disabled = false;
        }
      } catch (err) {
        toast(err.message, true);
      }
    });
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function bindUi() {
  $("apiToken").value = state.token;
  $("apiToken").addEventListener("change", () => {
    state.token = $("apiToken").value.trim();
    localStorage.setItem("odb_api_token", state.token);
    toast("API token saved");
  });

  $("btnRefresh").addEventListener("click", async () => {
    try {
      await Promise.all([loadFlows(), loadHistory()]);
      toast("Refreshed");
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("btnRun").addEventListener("click", runSelectedFlow);
  $("btnLoadReport").addEventListener("click", () =>
    loadReport().catch((e) => toast(e.message, true)),
  );

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filter = chip.dataset.filter;
      renderFlowList();
    });
  });
}

async function init() {
  bindUi();
  setLiveIdle();
  try {
    await Promise.all([loadFlows(), loadHistory()]);
  } catch (err) {
    toast(err.message || "Failed to load API", true);
    $("flowCount").textContent = "API unreachable";
  }
}

init();
