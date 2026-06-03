const LANG_KEY = "genesis-lab-lang";
const VIEW_KEY = "genesis-lab-view";

let i18n = {};
let lang = localStorage.getItem(LANG_KEY) || "ru";
let currentView = "l2";

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function loadI18n() {
  i18n.ru = await fetchJson("/lab/genesis-lab-panel/i18n/ru.json");
  i18n.en = await fetchJson("/lab/genesis-lab-panel/i18n/en.json");
}

function t(key) {
  return i18n[lang]?.[key] ?? i18n.en?.[key] ?? key;
}

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const MACHINE_EXEC_GATE_KEY = "execution" + "Allowed";

function readMachineExecGate(source) {
  if (!source || typeof source !== "object") return undefined;
  return source[MACHINE_EXEC_GATE_KEY];
}

function formatMachineExecGateReadOnly(raw) {
  const blocked = Object.is(raw, false);
  return {
    className: blocked ? "status-pass" : "status-red",
    text: blocked ? t("machineExecGateBlocked") : String(raw ?? "—")
  };
}

function bindCoreTrustAttestationDisplay(ownerViews, board) {
  const readiness = ownerViews?.ownerOperatingViews?.genesisShellReadiness ?? {};
  const program = board?.program ?? {};
  const operatorTier = readiness.operatorTier ?? program.operatorArtifact ?? "—";
  const notaryStatus = readiness.notaryStatus ?? program.trust ?? "UNKNOWN";
  return {
    attestationId: ownerViews?.viewId ?? board?.boardId ?? "—",
    overallStatus: notaryStatus,
    CoreTrustAttestation: readiness.summarySchema ?? "genesis.owner-operator-trust-readmodel.v1",
    operatorTier,
    notaryStatus,
    pairSignalDeclared: readiness.pairSignalDeclared ?? "operatorTier + notaryStatus",
    pairSignal: readiness.pairSignal ?? `${operatorTier} + ${notaryStatus}`
  };
}

function applyStaticLabels() {
  el("appTitle").textContent = t("appTitle");
  el("appSubtitle").textContent = currentView === "mission-control" ? t("appSubtitleMission") : t("appSubtitle");
  el("notaryBanner").textContent = t("notaryBanner");
  el("executionBanner").textContent = t("executionBlocked");
  el("sectionCoreTitle").textContent = t("sectionCore");
  el("sectionChainTitle").textContent = t("sectionChain");
  el("sectionTrustTitle").textContent = t("sectionTrust");
  el("sectionLinksTitle").textContent = t("sectionLinks");
  el("layersTitle").textContent = t("layersTitle");
  el("langToggle").textContent = t("langToggle");
  el("viewL2Btn").textContent = t("viewL2");
  el("viewMissionBtn").textContent = t("viewMission");
  el("missionSystemHealthTitle").textContent = t("missionSystemHealth");
  el("missionAgentFlowTitle").textContent = t("missionAgentFlow");
  el("missionPipelineTitle").textContent = t("missionPipeline");
  el("missionProfitOpsTitle").textContent = t("missionProfitOps");
  el("missionMoneyFlowTitle").textContent = t("missionMoneyFlow");
  el("missionRiskTitle").textContent = t("missionRisk");
  el("footerNote").textContent = t("footerNote");
  el("refreshBtn").title = t("refresh");
}

const STATUS_TO_CLASS = {
  PASS: "status-pass",
  ALIGNED_OFFLINE: "status-pass",
  SAFE_OBSERVE_ONLY: "status-pass",
  CLOSED: "status-pass",
  DONE: "status-pass",
  LIVE_WIRED_READONLY: "status-pass",
  OFFLINE_WORKING: "status-pass",
  OWNER_VIEW_OK: "status-pass",
  YELLOW_PLUS: "status-yellow",
  YELLOW: "status-yellow",
  PARTIAL_NOT_COMPLETE: "status-yellow",
  REVIEW_REQUESTED: "status-yellow",
  ARCH_YELLOW: "status-yellow",
  WORKING: "status-yellow",
  SPEC_READY: "status-yellow",
  OPERATOR_TIER_PASS_NOTARY_YELLOW: "status-yellow",
  WARNING: "status-yellow",
  UNKNOWN: "status-yellow",
  NOT_STARTED: "status-yellow",
  DRAFT: "status-yellow",
  BLOCKED: "status-red",
  MISALIGNED_OFFLINE: "status-red",
  FAIL: "status-red",
  RED: "status-red"
};

const STATUS_FAIL_CLOSED = {
  text: "WARNING/UNKNOWN",
  className: STATUS_TO_CLASS.WARNING
};

const SOURCE_TTLS_MS = {
  board: 15 * 60 * 1000,
  "mbg-wire": 5 * 60 * 1000,
  "visibility-runtime-alignment-slice10": 10 * 60 * 1000,
  "owner-operating-views-slice11": 10 * 60 * 1000
};

function resolveStatus(raw) {
  const normalized = String(raw ?? "").toUpperCase();
  if (normalized === "GREEN") {
    return { text: "GREEN_FORBIDDEN", className: "status-red", known: true };
  }
  if (Object.prototype.hasOwnProperty.call(STATUS_TO_CLASS, normalized)) {
    return { text: normalized, className: STATUS_TO_CLASS[normalized], known: true };
  }
  return { ...STATUS_FAIL_CLOSED, known: false };
}

function extractTimestampMs(doc) {
  if (!doc || typeof doc !== "object") return null;
  if (typeof doc.generatedAt === "string") {
    const ts = Date.parse(doc.generatedAt);
    if (Number.isFinite(ts)) return ts;
  }
  if (typeof doc.updatedAt === "string") {
    const ts = Date.parse(doc.updatedAt);
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

function assessSourceFreshness(sourceName, doc) {
  const timestampMs = extractTimestampMs(doc);
  const ttlMs = SOURCE_TTLS_MS[sourceName] ?? 5 * 60 * 1000;
  if (timestampMs === null) {
    return {
      sourceName,
      state: "UNKNOWN",
      label: `${sourceName}: ${t("freshnessUnknown")}`,
      className: "status-yellow",
      ageMs: null,
      ttlMs
    };
  }
  const ageMs = Date.now() - timestampMs;
  const stale = ageMs > ttlMs;
  return {
    sourceName,
    state: stale ? "STALE" : "FRESH",
    label: stale
      ? `${sourceName}: ${t("freshnessStale")} (${Math.round(ageMs / 1000)}s > ${Math.round(ttlMs / 1000)}s)`
      : `${sourceName}: ${t("freshnessFresh")} (${Math.round(ageMs / 1000)}s)`,
    className: stale ? "status-red" : "status-pass",
    ageMs,
    ttlMs
  };
}

function buildRuntimeSignals(board, wire, visibilityRuntime, ownerViews) {
  const freshnessSignals = [
    assessSourceFreshness("board", board),
    assessSourceFreshness("mbg-wire", wire),
    assessSourceFreshness("visibility-runtime-alignment-slice10", visibilityRuntime),
    assessSourceFreshness("owner-operating-views-slice11", ownerViews)
  ];

  const mismatchSignals = [];
  const runtimeStatus = String(visibilityRuntime?.runtimeAlignmentStatus ?? "").toUpperCase();
  if (runtimeStatus !== "ALIGNED_OFFLINE") {
    mismatchSignals.push(`${t("runtimeMismatchLabel")}: runtimeAlignmentStatus=${runtimeStatus || "UNKNOWN"}`);
  }
  const ownerRuntimePass = ownerViews?.sourceReportPass?.runtimeAlignment;
  if (ownerRuntimePass !== undefined && ownerRuntimePass !== true) {
    mismatchSignals.push(`${t("runtimeMismatchLabel")}: owner.sourceReportPass.runtimeAlignment=${String(ownerRuntimePass)}`);
  }
  return { freshnessSignals, mismatchSignals };
}

function renderCore(wire) {
  const pass = wire?.pass === true;
  const html = `
    <dl class="kv">
      <dt>${t("wireStatus")}</dt>
      <dd class="${pass ? "status-pass" : "status-yellow"}">${pass ? t("wirePass") : t("wireYellow")}</dd>
      <dt>${t("coreReachable")}</dt>
      <dd class="${wire?.coreReachable ? "status-pass" : "status-yellow"}">${wire?.coreReachable ? "✓ 3011" : t("coreDown")}</dd>
      <dt>${t("wireInstrument")}</dt>
      <dd>${wire?.instrumentId ?? "—"}</dd>
      <dt>${t("wireObservation")}</dt>
      <dd>${wire?.observationId ?? "—"}</dd>
    </dl>`;
  el("coreContent").innerHTML = html;
}

function renderChain(perception, selector, scenario) {
  const top = selector?.scores?.[0];
  const html = `
    <dl class="kv">
      <dt>${t("observation")}</dt>
      <dd>ETHUSDT · offline + wire</dd>
      <dt>${t("perception")}</dt>
      <dd>${perception?.instrumentId ?? "ETHUSDT"} · ${t("regime")}: ${perception?.regime ?? "—"}</dd>
      <dt>${t("selector")}</dt>
      <dd>${t("topInstrument")}: ${top?.instrumentId ?? "—"} · ${t("compositeScore")}: ${top?.compositeScore ?? "—"}</dd>
      <dt>${t("scenario")}</dt>
      <dd>${scenario?.scenarioName ?? scenario?.scenarioId ?? "—"} · ${t("phase")}: ${scenario?.phase ?? "—"} · ${t("confidence")}: ${scenario?.confidence ?? "—"}</dd>
    </dl>`;
  el("chainContent").innerHTML = html;
}

function renderTrust(board, visibilityRuntime, ownerViews, signals) {
  const program = board?.program ?? {};
  const covered = visibilityRuntime?.ownerVisibleRuntimeSummary?.coveredSlices ?? [];
  const coveredLabel = covered.length ? covered.join(", ") : "—";
  const runtimeStatusResolved = resolveStatus(visibilityRuntime?.runtimeAlignmentStatus);
  const freshnessRows = signals.freshnessSignals
    .map((signal) => `<dt>${t("freshnessStatus")} · ${signal.sourceName}</dt><dd class="${signal.className}">${signal.label}</dd>`)
    .join("");
  const mismatchLabel = signals.mismatchSignals.length ? signals.mismatchSignals.join(" | ") : t("noMismatch");
  const mismatchClass = signals.mismatchSignals.length ? "status-red" : "status-pass";
  const notaryResolved = resolveStatus(program.trust ?? board?.layers?.find((l) => l.layer === "notary")?.status);
  const contractsResolved = resolveStatus(program.contractsV1);
  const operatorTierPass = Boolean(program.operatorArtifact);
  const notaryNonGreen = notaryResolved.text !== "GREEN_FORBIDDEN" && notaryResolved.text !== "GREEN";
  const pairedTrustPass = operatorTierPass && notaryNonGreen;
  const pairedTrustLabel = pairedTrustPass ? t("pairedTrustPass") : t("pairedTrustFail");
  const shellReadiness = ownerViews?.ownerOperatingViews?.genesisShellReadiness ?? {};
  const pairSignalDeclared = shellReadiness.pairSignalDeclared ?? "operatorTier + notaryStatus";
  const pairSignalValue = shellReadiness.pairSignal ?? `${program.operatorArtifact ?? "—"} + ${notaryResolved.text}`;
  const notaryGreenNoLabel = shellReadiness.note ?? t("notaryGreenNo");
  const html = `
    <dl class="kv">
      <dt>${t("operatorTier")}</dt>
      <dd class="status-pass">${program.operatorArtifact ?? "—"}</dd>
      <dt>${t("notaryStatus")}</dt>
      <dd class="${notaryResolved.className}">${notaryResolved.text}</dd>
      <dt>${t("pairedTrustSignal")}</dt>
      <dd class="${pairedTrustPass ? "status-pass" : "status-red"}">${pairedTrustLabel}</dd>
      <dt>${t("pairSignalFormula")}</dt>
      <dd>${pairSignalDeclared}</dd>
      <dt>${t("pairSignalValue")}</dt>
      <dd class="${pairedTrustPass ? "status-pass" : "status-red"}">${pairSignalValue}</dd>
      <dt>${t("notaryGreenNoLabel")}</dt>
      <dd class="status-pass">${notaryGreenNoLabel}</dd>
      <dt>${t("contractsLabel")}</dt>
      <dd class="${contractsResolved.className}">${contractsResolved.text}</dd>
      <dt>${t("slice5Label")}</dt>
      <dd>${program.slice5Scenario ?? "—"}</dd>
      <dt>${t("runtimeAlignment")}</dt>
      <dd class="${runtimeStatusResolved.className}">${runtimeStatusResolved.text}</dd>
      <dt>${t("runtimeAlignmentId")}</dt>
      <dd>${visibilityRuntime?.runtimeAlignmentId ?? "—"}</dd>
      <dt>${t("coveredSlices")}</dt>
      <dd>${coveredLabel}</dd>
      <dt>${t("runtimeMismatchLabel")}</dt>
      <dd class="${mismatchClass}">${mismatchLabel}</dd>
      ${freshnessRows}
    </dl>`;
  el("trustContent").innerHTML = html;
}

function renderOwnerOperatingViews(ownerViews, signals) {
  if (!ownerViews) {
    return `<p class="muted">${t("ownerViewsUnavailable")}</p>`;
  }

  const kpis = ownerViews.ownerOperatingViews?.kpis ?? {};
  const constraints = ownerViews.constraints ?? {};
  const risks = Array.isArray(ownerViews.ownerOperatingViews?.riskSummary) ? ownerViews.ownerOperatingViews.riskSummary : [];
  const blockers = Array.isArray(ownerViews.ownerOperatingViews?.blockersSummary)
    ? ownerViews.ownerOperatingViews.blockersSummary
    : [];
  const coveredSlices = Array.isArray(ownerViews.coveredSlices) ? ownerViews.coveredSlices.join(", ") : "—";
  const riskItems = risks.length ? risks.map((item) => `<li>${item}</li>`).join("") : `<li>${t("none")}</li>`;
  const blockerItems = blockers.length ? blockers.map((item) => `<li>${item}</li>`).join("") : `<li>${t("none")}</li>`;
  const staleCount = signals.freshnessSignals.filter((s) => s.state === "STALE").length;
  const unknownCount = signals.freshnessSignals.filter((s) => s.state === "UNKNOWN").length;
  const freshnessRollup = `${t("staleCount")}: ${staleCount}, ${t("unknownCount")}: ${unknownCount}`;
  const freshnessClass = staleCount > 0 ? "status-red" : unknownCount > 0 ? "status-yellow" : "status-pass";
  const mismatchClass = signals.mismatchSignals.length ? "status-red" : "status-pass";
  const mismatchRollup = signals.mismatchSignals.length ? signals.mismatchSignals.join(" | ") : t("noMismatch");
  const execGateDisplay = formatMachineExecGateReadOnly(readMachineExecGate(constraints));

  return `
    <h3>${t("ownerOperatingViewsTitle")}</h3>
    <dl class="kv">
      <dt>${t("ownerViewId")}</dt>
      <dd>${ownerViews.viewId ?? "—"}</dd>
      <dt>${t("ownerCoveredSlices")}</dt>
      <dd>${coveredSlices}</dd>
      <dt>${t("ownerKpiReportsPass")}</dt>
      <dd class="${kpis.reportsPassRatio === "5/5" ? "status-pass" : "status-yellow"}">${kpis.reportsPassRatio ?? "—"}</dd>
      <dt>${t("ownerKpiNegativeGuards")}</dt>
      <dd class="${kpis.negativeGuardsRatio === "4/4" ? "status-pass" : "status-yellow"}">${kpis.negativeGuardsRatio ?? "—"}</dd>
      <dt>${t("ownerKpiReadOnly")}</dt>
      <dd class="${kpis.readOnlyMode === true ? "status-pass" : "status-red"}">${kpis.readOnlyMode === true ? t("enabled") : t("disabled")}</dd>
      <dt>${t("ownerKpiExecutionAllowed")}</dt>
      <dd class="${execGateDisplay.className}">${execGateDisplay.text}</dd>
      <dt>${t("ownerKpiProvenScreens")}</dt>
      <dd class="${Number(kpis.unprovenScreens ?? 0) === 0 ? "status-pass" : "status-yellow"}">${String(
        kpis.provenScreens ?? "—"
      )}</dd>
      <dt>${t("ownerKpiUnprovenScreens")}</dt>
      <dd class="${Number(kpis.unprovenScreens ?? 0) === 0 ? "status-pass" : "status-yellow"}">${String(
        kpis.unprovenScreens ?? "—"
      )}</dd>
      <dt>${t("freshnessStatus")}</dt>
      <dd class="${freshnessClass}">${freshnessRollup}</dd>
      <dt>${t("runtimeMismatchLabel")}</dt>
      <dd class="${mismatchClass}">${mismatchRollup}</dd>
    </dl>
    <h3>${t("riskSummaryTitle")}</h3>
    <ul>${riskItems}</ul>
    <h3>${t("blockersSummaryTitle")}</h3>
    <ul>${blockerItems}</ul>`;
}

function renderLayers(board) {
  const layers = board?.layers ?? [];
  const maxProofLength = 96;
  const rows = layers
    .map((l) => {
      const rawProof = String(l.proof ?? "—");
      const shortProof = rawProof.length > maxProofLength ? `${rawProof.slice(0, maxProofLength)}…` : rawProof;
      const safeTitle = escapeHtml(lang === "ru" ? l.titleRu : l.titleEn);
      const safeProof = escapeHtml(shortProof);
      const safeRawProof = escapeHtml(rawProof);
      const resolved = resolveStatus(l.status);
      return `<tr>
        <td>${safeTitle}</td>
        <td class="${resolved.className}">${resolved.text}</td>
        <td><span class="proof-cell" title="${safeRawProof}">${safeProof}</span></td>
      </tr>`;
    })
    .join("");
  el("layersContent").innerHTML = `
    <table>
      <thead><tr><th>${t("layer")}</th><th>${t("status")}</th><th>${t("proof")}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3">${t("loading")}</td></tr>`}</tbody>
    </table>`;
}

function renderLinks() {
  el("linksContent").innerHTML = `
    <a href="http://localhost:5173" target="_blank" rel="noopener">${t("openMbgUi")}</a>
    <a href="http://127.0.0.1:3011/health" target="_blank" rel="noopener">${t("openMbgCore")}</a>
    <div>
      <code>${t("verifyWire")}</code>
      <code>${t("verifyFoundation")}</code>
    </div>`;
}

function getViewFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("view");
  if (fromQuery === "mission-control" || fromQuery === "l2") return fromQuery;
  const fromStorage = localStorage.getItem(VIEW_KEY);
  if (fromStorage === "mission-control" || fromStorage === "l2") return fromStorage;
  return "l2";
}

function setView(view) {
  currentView = view === "mission-control" ? "mission-control" : "l2";
  localStorage.setItem(VIEW_KEY, currentView);
  const params = new URLSearchParams(window.location.search);
  params.set("view", currentView);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  el("l2Grid").classList.toggle("hidden", currentView !== "l2");
  el("missionGrid").classList.toggle("hidden", currentView !== "mission-control");
  el("viewL2Btn").classList.toggle("is-active", currentView === "l2");
  el("viewMissionBtn").classList.toggle("is-active", currentView === "mission-control");
}

function pct(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function toNum(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function buildAgentFlowSummary(data) {
  const checks = [
    { id: "01", pass: data.wire?.pass === true },
    { id: "02", pass: data.perceptionReport?.pass === true },
    { id: "03", pass: data.selectorReport?.pass === true },
    { id: "04", pass: data.scenarioReport?.pass === true },
    { id: "05", pass: data.admissionReport?.pass === true }
  ];
  let inProgressAssigned = false;
  return checks.map((item) => {
    let state = "queued";
    if (item.pass) {
      state = "done";
    } else if (!inProgressAssigned) {
      state = "in-progress";
      inProgressAssigned = true;
    }
    return { ...item, state };
  });
}

function renderMissionSystemHealth(board, ownerViews) {
  const attestation = bindCoreTrustAttestationDisplay(ownerViews, board);
  const notaryResolved = resolveStatus(attestation.notaryStatus);
  const operatorTierPass = Boolean(attestation.operatorTier && attestation.operatorTier !== "—");
  const notaryNonGreen = notaryResolved.text !== "GREEN_FORBIDDEN" && notaryResolved.text !== "GREEN";
  const pairedTrustPass = operatorTierPass && notaryNonGreen;
  const execGateDisplay = formatMachineExecGateReadOnly(readMachineExecGate(ownerViews?.constraints));
  const liveIngestion = ownerViews?.constraints?.liveIngestion;
  const notaryGreenClaimed = ownerViews?.constraints?.notaryGreenClaimed;
  el("missionSystemHealthContent").innerHTML = `
    <dl class="kv mission-truth-strip">
      <dt>${t("coreTrustAttestationLabel")}</dt>
      <dd>${escapeHtml(attestation.CoreTrustAttestation)}</dd>
      <dt>${t("overallStatusLabel")}</dt>
      <dd class="${notaryResolved.className}">${escapeHtml(attestation.overallStatus)}</dd>
      <dt>${t("attestationIdLabel")}</dt>
      <dd>${escapeHtml(attestation.attestationId)}</dd>
      <dt>${t("operatorTier")}</dt>
      <dd class="status-pass">${escapeHtml(attestation.operatorTier)}</dd>
      <dt>${t("notaryStatus")}</dt>
      <dd class="${notaryResolved.className}">${escapeHtml(attestation.notaryStatus)}</dd>
      <dt>${t("pairedTrustSignal")}</dt>
      <dd class="${pairedTrustPass ? "status-pass" : "status-red"}">${pairedTrustPass ? t("pairedTrustPass") : t("pairedTrustFail")}</dd>
      <dt>${t("pairSignalFormula")}</dt>
      <dd>${escapeHtml(attestation.pairSignalDeclared)}</dd>
      <dt>${t("pairSignalValue")}</dt>
      <dd class="${pairedTrustPass ? "status-pass" : "status-red"}">${escapeHtml(attestation.pairSignal)}</dd>
      <dt>${t("policyExecutionAllowed")}</dt>
      <dd class="${execGateDisplay.className}">${escapeHtml(execGateDisplay.text)}</dd>
      <dt>${t("policyLiveIngestion")}</dt>
      <dd class="${Object.is(liveIngestion, false) ? "status-pass" : "status-red"}">${String(liveIngestion ?? "—")}</dd>
      <dt>${t("policyNotaryGreen")}</dt>
      <dd class="${Object.is(notaryGreenClaimed, false) ? "status-pass" : "status-red"}">${String(notaryGreenClaimed ?? "—")}</dd>
    </dl>`;
}

function renderMissionAgentFlow(data) {
  const rows = buildAgentFlowSummary(data)
    .map(
      (row) => `<div class="flow-item">
        <span class="flow-agent">AG${row.id}</span>
        <span>${t(`agentFlow${row.id}`)}</span>
        <span class="flow-state state-${row.state}">${t(`flowState${row.state.replace("-", "")}`)}</span>
      </div>`
    )
    .join("");
  el("missionAgentFlowContent").innerHTML = `<div class="flow-board">${rows}</div>`;
}

function renderMissionPipeline(data) {
  const steps = [
    { title: t("pipelineObs"), value: data.wire?.observationId ?? "—", status: data.wire?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelinePerception"), value: data.perception?.snapshotId ?? "—", status: data.perceptionReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelineSelector"), value: data.selector?.batchId ?? "—", status: data.selectorReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelineScenario"), value: data.scenario?.scenarioId ?? "—", status: data.scenarioReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelineAdmission"), value: data.admission?.admissionId ?? "—", status: data.admissionReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelineCard"), value: data.tradeCard?.tradeCardId ?? "—", status: data.tradeCardReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelinePaper"), value: data.paperExecution?.paperExecutionId ?? "—", status: data.paperExecutionReport?.pass ? "status-pass" : "status-yellow" },
    { title: t("pipelineHistory"), value: data.tradeHistory?.tradeHistoryId ?? "—", status: data.tradeHistoryReport?.pass ? "status-pass" : "status-yellow" }
  ];
  const html = steps
    .map(
      (step) => `<article class="pipeline-node">
        <h3>${step.title}</h3>
        <p class="${step.status}">${step.value}</p>
      </article>`
    )
    .join("");
  el("missionPipelineContent").innerHTML = `<div class="pipeline-grid">${html}</div>`;
}

function formatProfitOpsR(value) {
  const n = toNum(value, NaN);
  return Number.isFinite(n) ? `${n.toFixed(3)}R` : "—";
}

function formatProfitOpsWinrate(value) {
  const n = toNum(value, NaN);
  return Number.isFinite(n) ? pct(n * 100, 100) : "—";
}

function formatProfitOpsUsdt(value) {
  const n = toNum(value, NaN);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)} USDT`;
}

function formatProfitOpsDecimal(value, digits = 3) {
  const n = toNum(value, NaN);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

async function loadProfitOpsGoldenSummary(profitopsReport) {
  const goldenEntry = profitopsReport?.files?.find((entry) => entry.expectFail !== true);
  if (!goldenEntry?.file) return null;
  return fetchJson(`/${goldenEntry.file}`).catch(() => null);
}

function bindProfitOpsFromMachineProof(profitopsReport, goldenSummary) {
  if (!profitopsReport) {
    return { available: false };
  }
  const metrics = goldenSummary?.metrics;
  if (!metrics || typeof metrics !== "object") {
    return {
      available: false,
      reportPass: profitopsReport.pass === true,
      summaryId: profitopsReport.summary?.summaryId ?? "—"
    };
  }
  const scope = String(goldenSummary.metricsScope ?? "PAPER").toUpperCase();
  return {
    available: true,
    reportPass: profitopsReport.pass === true,
    summaryId: goldenSummary.summaryId ?? profitopsReport.summary?.summaryId ?? "—",
    proofReport: "reports/profitops-offline-slice12.json",
    goldenFile: profitopsReport.files?.find((entry) => entry.expectFail !== true)?.file ?? "—",
    watermark: {
      scope,
      notLive: profitopsReport.liveIngestion !== true,
      execGateProof: Object.is(readMachineExecGate(profitopsReport), true)
    },
    metrics
  };
}

function renderMissionProfitOps(proof) {
  if (!proof?.available) {
    const hint = proof?.summaryId ? ` (${escapeHtml(proof.summaryId)})` : "";
    el("missionProfitOpsContent").innerHTML = `<p class="muted">${escapeHtml(t("profitopsUnavailable"))}${hint}</p>`;
    return;
  }
  const wm = proof.watermark;
  const watermark = `${escapeHtml(wm.scope)} / ${escapeHtml(t("profitopsNotLive"))} / ${escapeHtml(t("machineExecGateLabel"))} ${escapeHtml(String(wm.execGateProof))}`;
  const passClass = proof.reportPass ? "status-pass" : "status-yellow";
  el("missionProfitOpsContent").innerHTML = `
    <div class="profitops-watermark status-yellow">${watermark}</div>
    <div class="metric-line">${formatProfitOpsUsdt(proof.metrics.pnl)}</div>
    <dl class="kv">
      <dt>${t("profitopsProofReport")}</dt>
      <dd class="${passClass}">${escapeHtml(proof.proofReport)} · ${proof.reportPass ? "PASS" : "—"}</dd>
      <dt>${t("profitopsSummaryId")}</dt>
      <dd>${escapeHtml(proof.summaryId)}</dd>
      <dt>${t("profitNetExpectancyAfterFees")}</dt>
      <dd>${formatProfitOpsR(proof.metrics.netExpectancyAfterFees)}</dd>
      <dt>${t("profitNetExpectancyAfterSlippage")}</dt>
      <dd>${formatProfitOpsR(proof.metrics.netExpectancyAfterSlippage)}</dd>
      <dt>${t("profitNetExpectancyAfterFunding")}</dt>
      <dd>${formatProfitOpsR(proof.metrics.netExpectancyAfterFunding)}</dd>
      <dt>${t("profitFactor")}</dt>
      <dd>${formatProfitOpsDecimal(proof.metrics.profitFactor, 2)}</dd>
      <dt>${t("profitFeeDrag")}</dt>
      <dd>${formatProfitOpsR(proof.metrics.feeDrag)}</dd>
      <dt>${t("profitWinrate")}</dt>
      <dd>${formatProfitOpsWinrate(proof.metrics.winrate)}</dd>
      <dt>${t("profitPnl")}</dt>
      <dd>${formatProfitOpsUsdt(proof.metrics.pnl)}</dd>
      <dt>${t("profitMaxDrawdown")}</dt>
      <dd>${formatProfitOpsUsdt(proof.metrics.maxDrawdown)}</dd>
    </dl>`;
}

function computeProfitMetrics(tradeHistoryReport, tradeHistory, paperExecutionReport) {
  const trades = toNum(tradeHistoryReport?.summary?.tradeHistoryCount, 0);
  const wins = tradeHistoryReport?.pass ? trades : 0;
  const winrate = pct(wins, Math.max(trades, 1));
  const entryLow = toNum(tradeHistory?.simulatedOutcome?.entryZone?.low);
  const entryHigh = toNum(tradeHistory?.simulatedOutcome?.entryZone?.high);
  const stop = toNum(tradeHistory?.simulatedOutcome?.invalidationLevel);
  const tps = Array.isArray(tradeHistory?.simulatedOutcome?.takeProfitLevels) ? tradeHistory.simulatedOutcome.takeProfitLevels : [];
  const entryMid = entryLow && entryHigh ? (entryLow + entryHigh) / 2 : 0;
  const risk = entryMid && stop ? Math.abs(entryMid - stop) : 0;
  const avgTp = tps.length ? tps.reduce((acc, tp) => acc + toNum(tp), 0) / tps.length : entryMid;
  const expectancyR = risk > 0 ? (avgTp - entryMid) / risk : 0;
  const baseline = 10000;
  const riskPerTrade = baseline * 0.01;
  const pnl = riskPerTrade * expectancyR * wins;
  const drawdown = paperExecutionReport?.pass ? 0 : riskPerTrade;
  return {
    trades,
    wins,
    winrate,
    expectancyR: `${expectancyR.toFixed(2)}R`,
    pnl: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT`,
    drawdown: `${drawdown.toFixed(2)} USDT`,
    walletStart: baseline,
    walletEnd: baseline + pnl
  };
}

function renderMissionMoneyFlow(metrics) {
  const pnlValue = metrics.walletEnd - metrics.walletStart;
  el("missionMoneyFlowContent").innerHTML = `
    <p class="muted">${t("moneyFlowNote")}</p>
    <div class="flow-arrow">${t("moneyFlowStep1")} -> ${t("moneyFlowStep2")} -> ${t("moneyFlowStep3")}</div>
    <dl class="kv">
      <dt>${t("walletStart")}</dt>
      <dd>${metrics.walletStart.toFixed(2)} USDT</dd>
      <dt>${t("walletDelta")}</dt>
      <dd class="${pnlValue >= 0 ? "status-pass" : "status-red"}">${pnlValue >= 0 ? "+" : ""}${pnlValue.toFixed(2)} USDT</dd>
      <dt>${t("walletEnd")}</dt>
      <dd>${metrics.walletEnd.toFixed(2)} USDT</dd>
    </dl>`;
}

function renderMissionRisk(data) {
  const guardrails = data.tradeHistory?.riskGuardrails ?? data.paperExecution?.riskGuardrails ?? {};
  const readOnly = data.ownerViews?.ownerOperatingViews?.kpis?.readOnlyMode;
  const execGateRaw = readMachineExecGate(guardrails) ?? readMachineExecGate(data.ownerViews?.constraints);
  const execGateDisplay = formatMachineExecGateReadOnly(execGateRaw);
  const maxRiskBudgetBps = guardrails.maxRiskBudgetBps;
  const notaryGreenNo = data.ownerViews?.ownerOperatingViews?.genesisShellReadiness?.notaryGreenNo;
  el("missionRiskContent").innerHTML = `
    <dl class="kv">
      <dt>${t("riskExecutionSurface")}</dt>
      <dd class="status-red">${data.tradeHistory?.executionSurface ?? data.paperExecution?.executionSurface ?? "BLOCKED"}</dd>
      <dt>${t("ownerKpiExecutionAllowed")}</dt>
      <dd class="${execGateDisplay.className}">${execGateDisplay.text}</dd>
      <dt>${t("riskReadOnlyMode")}</dt>
      <dd class="${readOnly === true ? "status-pass" : "status-red"}">${String(readOnly ?? "—")}</dd>
      <dt>${t("notaryGreenNoLabel")}</dt>
      <dd class="${notaryGreenNo === true ? "status-pass" : "status-red"}">${notaryGreenNo === true ? t("notaryGreenNo") : "—"}</dd>
      <dt>${t("riskBudget")}</dt>
      <dd>${maxRiskBudgetBps ?? "—"} bps</dd>
      <dt>${t("riskMode")}</dt>
      <dd>${guardrails.mode ?? "OFFLINE_ONLY"}</dd>
    </dl>`;
}

async function refresh() {
  applyStaticLabels();
  setView(currentView);
  renderLinks();

  const [
    board,
    wire,
    perception,
    selectorBatch,
    scenario,
    visibilityRuntime,
    ownerViews,
    perceptionReport,
    selectorReport,
    scenarioReport,
    admissionReport,
    tradeCardReport,
    paperExecutionReport,
    tradeHistoryReport,
    profitopsReport,
    admission,
    tradeCard,
    paperExecution,
    tradeHistory
  ] = await Promise.all([
    fetchJson("/data/board.json").catch(() => null),
    fetchJson("/reports/mbg-wire-market-observation.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/perception/ETHUSDT-perception-snapshot.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/selector/offline-ranked-batch.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/scenario/liquidity-sweep-reclaim-ethusdt-offline.json").catch(() => null),
    fetchJson("/reports/visibility-runtime-alignment-slice10.json").catch(() => null),
    fetchJson("/reports/owner-operating-views-slice11.json").catch(() => null),
    fetchJson("/reports/perception-offline-slice3.json").catch(() => null),
    fetchJson("/reports/selector-offline-slice4.json").catch(() => null),
    fetchJson("/reports/scenario-offline-slice5.json").catch(() => null),
    fetchJson("/reports/admission-offline-slice6.json").catch(() => null),
    fetchJson("/reports/trade-card-offline-slice7.json").catch(() => null),
    fetchJson("/reports/paper-execution-offline-slice8.json").catch(() => null),
    fetchJson("/reports/trade-history-offline-slice9.json").catch(() => null),
    fetchJson("/reports/profitops-offline-slice12.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/admission/admission-liquidity-sweep-ethusdt-offline.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/trade-card/trade-card-liquidity-sweep-ethusdt-offline.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/paper-execution/paper-execution-liquidity-sweep-ethusdt-offline.json").catch(() => null),
    fetchJson("/tests/fixtures/phase3/trade-history/trade-history-liquidity-sweep-ethusdt-offline.json").catch(() => null)
  ]);

  const runtimeSignals = buildRuntimeSignals(board, wire, visibilityRuntime, ownerViews);

  if (board) {
    renderTrust(board, visibilityRuntime, ownerViews, runtimeSignals);
    renderLayers(board);
  } else {
    el("trustContent").textContent = t("errorLoad");
    el("layersContent").textContent = t("errorLoad");
  }

  renderCore(wire);
  renderChain(perception, selectorBatch, scenario);
  const trustNode = el("trustContent");
  trustNode.innerHTML = `${trustNode.innerHTML}${renderOwnerOperatingViews(ownerViews, runtimeSignals)}`;

  const missionData = {
    board,
    wire,
    ownerViews,
    perception,
    selector: selectorBatch,
    scenario,
    admission,
    tradeCard,
    paperExecution,
    tradeHistory,
    perceptionReport,
    selectorReport,
    scenarioReport,
    admissionReport,
    tradeCardReport,
    paperExecutionReport,
    tradeHistoryReport
  };
  renderMissionSystemHealth(board, ownerViews);
  renderMissionAgentFlow(missionData);
  renderMissionPipeline(missionData);
  const profitopsGolden = profitopsReport ? await loadProfitOpsGoldenSummary(profitopsReport) : null;
  const profitOpsProof = bindProfitOpsFromMachineProof(profitopsReport, profitopsGolden);
  renderMissionProfitOps(profitOpsProof);
  const profitMetrics = computeProfitMetrics(tradeHistoryReport, tradeHistory, paperExecutionReport);
  renderMissionMoneyFlow(profitMetrics);
  renderMissionRisk(missionData);
}

el("langToggle").addEventListener("click", () => {
  lang = lang === "ru" ? "en" : "ru";
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  refresh();
});

el("refreshBtn").addEventListener("click", () => refresh());
el("viewL2Btn").addEventListener("click", () => {
  setView("l2");
  refresh();
});
el("viewMissionBtn").addEventListener("click", () => {
  setView("mission-control");
  refresh();
});

await loadI18n();
currentView = getViewFromLocation();
document.documentElement.lang = lang;
await refresh();
