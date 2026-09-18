/**
 * dashboard.js
 *
 * Wires every dashboard section to the real backend API.
 * No hardcoded / simulated sensor values anywhere.
 *
 * Polling intervals
 *   Sensor / pump status : 15 s  (live field data)
 *   Dashboard overview   : 20 s
 *   Alerts               : 30 s
 */

(function () {
  "use strict";

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value ?? "—"; };
  const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const show = (id) => { const el = $(id); if (el) el.style.display = ""; };
  const hide = (id) => { const el = $(id); if (el) el.style.display = "none"; };

  /** Format a Date / ISO string to a readable local time. */
  const fmtTime = (ts) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString(undefined, {
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (_) { return String(ts); }
  };

  /** Round to 1 decimal place, return "—" if null/undefined. */
  const fmtNum = (v, unit = "") =>
    (v === null || v === undefined) ? "—" : `${Number(v).toFixed(1)}${unit}`;

  /**
   * Generic API GET.  Returns { success, data } or null on network error.
   */
  const apiGet = async (path) => {
    try {
      const res = await fetch(`/api${path}`);
      if (!res.ok) return null;
      return res.json();
    } catch (_) { return null; }
  };

  /**
   * Generic API POST.
   */
  const apiPost = async (path, body = {}) => {
    try {
      const res = await fetch(`/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return res.json();
    } catch (_) { return null; }
  };

  /* ── Section navigation ───────────────────────────────────────────────── */

  const sectionButtons = Array.from(document.querySelectorAll(".side-menu-item"));
  const sections = Array.from(document.querySelectorAll(".content-panel-section"));

  /** Exposed globally so hero-action buttons can call activateSection(). */
  window.activateSection = (target) => {
    sections.forEach((s) => {
      const active = s.dataset.sectionPanel === target;
      s.classList.toggle("is-active", active);
      s.hidden = !active;
    });
    sectionButtons.forEach((b) => {
      const active = b.dataset.sectionTarget === target;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    // Lazy-load section data on first visit
    onSectionActivate(target);
  };

  sectionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.sectionTarget;
      if (target === "logout") { window.location.href = "/logout"; return; }
      window.activateSection(target);
    });
  });

  // Activate dashboard on load
  window.activateSection("dashboard");

  /* ── Status dot helper ────────────────────────────────────────────────── */

  const statusDot = (status) => {
    const map = { NORMAL: "dot-green", LOW: "dot-blue", HIGH: "dot-muted", UNKNOWN: "dot-muted" };
    return `<span class="dot ${map[status] || "dot-muted"}"></span>`;
  };

  const statusBadge = (status) => {
    if (status === "LOW")    return "warning";
    if (status === "HIGH")   return "warning";
    if (status === "NORMAL") return "ok";
    return "ok";
  };

  /* ══════════════════════════════════════════════════════════════════════════
     SENSOR  —  /api/sensor/latest
  ══════════════════════════════════════════════════════════════════════════ */

  let _latestSensor = null;   // cached for other sections to read

  const renderSensor = (data) => {
    if (!data) return;
    _latestSensor = data;

    // ── Dashboard KPI cards
    const sm = data.soilMoisture;
    const tp = data.temperature;
    const hm = data.humidity;

    setText("sensor-soil-moisture",
      sm?.value !== null ? `${sm.value}%` : "—");
    setHTML("sensor-soil-moisture-status",
      `${statusDot(sm?.status)} ${sm?.status || "—"} (${sm?.optimalRange || ""})`);

    setText("sensor-temperature",
      tp?.value !== null ? `${tp.value}°C` : "—");
    setHTML("sensor-temperature-status",
      `${statusDot(tp?.status)} ${tp?.status || "—"} (${tp?.optimalRange || ""})`);

    setText("sensor-humidity",
      hm?.value !== null ? `${hm.value}%` : "—");
    setHTML("sensor-humidity-status",
      `${statusDot(hm?.status)} ${hm?.status || "—"} (${hm?.optimalRange || ""})`);

    setText("sensor-last-sync", fmtTime(data.timestamp));

    // ── Dashboard NPK cards
    const n = data.nitrogen;
    const p = data.phosphorus;
    const k = data.potassium;

    setText("sensor-n-status", n?.status || "—");
    setText("sensor-n-value",  `${n?.value ?? "—"} ${n?.unit || ""}`);
    const nTag = $("sensor-n-tag");
    if (nTag) { nTag.textContent = n?.status || "—"; nTag.className = `em ${statusBadge(n?.status)}`; }

    setText("sensor-p-status", p?.status || "—");
    setText("sensor-p-value",  `${p?.value ?? "—"} ${p?.unit || ""}`);
    const pTag = $("sensor-p-tag");
    if (pTag) { pTag.textContent = p?.status || "—"; pTag.className = `em ${statusBadge(p?.status)}`; }

    setText("sensor-k-status", k?.status || "—");
    setText("sensor-k-value",  `${k?.value ?? "—"} ${k?.unit || ""}`);
    const kTag = $("sensor-k-tag");
    if (kTag) { kTag.textContent = k?.status || "—"; kTag.className = `em ${statusBadge(k?.status)}`; }

    // ── Monitoring section
    if ($("monitoring-content")) {
      hide("monitoring-loading");
      hide("monitoring-no-data");

      if (data.source === "NO_DATA") {
        show("monitoring-no-data");
      } else {
        show("monitoring-content");

        const fillMon = (prefix, field) => {
          setText(`mon-${prefix}`, `${field.value ?? "—"} ${field.unit || ""}`);
          setHTML(`mon-${prefix}-status`,
            `${statusDot(field.status)} ${field.status} (${field.optimalRange || ""})`);
        };

        fillMon("soil-moisture", data.soilMoisture);
        fillMon("temperature",   data.temperature);
        fillMon("humidity",      data.humidity);
        fillMon("nitrogen",      data.nitrogen);
        fillMon("phosphorus",    data.phosphorus);
        fillMon("potassium",     data.potassium);

        setText("mon-device-id",  data.deviceId || "esp32-node-1");
        setText("mon-timestamp",  fmtTime(data.timestamp));
        setText("mon-source",     data.source || "—");
      }
    }
  };

  const fetchSensor = async () => {
    const res = await apiGet("/sensor/latest");
    if (res?.success) renderSensor(res.data);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     IRRIGATION DECISION  —  /api/irrigation
  ══════════════════════════════════════════════════════════════════════════ */

  const renderIrrigation = (data) => {
    if (!data) return;

    const irrigate = data.irrigate;
    const waterMm  = data.waterRequirementMm;
    const durMin   = data.durationMinutes;

    // ── Dashboard overview card
    const banner = $("db-irrigate-banner");
    if (banner) {
      banner.textContent = irrigate ? "IRRIGATION REQUIRED" : "NO IRRIGATION NEEDED";
      banner.style.background = irrigate
        ? "rgba(239,68,68,0.12)"
        : "rgba(44,175,116,0.12)";
      banner.style.borderColor = irrigate
        ? "rgba(239,68,68,0.22)"
        : "rgba(44,175,116,0.22)";
      banner.style.color = irrigate ? "#b91c1c" : "#1b8c56";
    }

    setText("db-water-req",      waterMm !== null ? `${waterMm} mm` : "—");
    setText("db-duration",       durMin  !== null ? `${durMin} min` : "—");
    setText("db-irrigate-reason", data.recommendation || data.reason || "—");
    setText("db-irrigate-model",  `Model: ${data.model || "—"}`);

    // ── Irrigation section
    if ($("irr-content")) {
      hide("irr-loading");
      show("irr-content");

      const irrBanner = $("irr-banner");
      if (irrBanner) {
        irrBanner.textContent = irrigate ? "IRRIGATION REQUIRED" : "NO IRRIGATION NEEDED";
        irrBanner.style.background = irrigate ? "rgba(239,68,68,0.12)" : "rgba(44,175,116,0.12)";
        irrBanner.style.borderColor = irrigate ? "rgba(239,68,68,0.22)" : "rgba(44,175,116,0.22)";
        irrBanner.style.color = irrigate ? "#b91c1c" : "#1b8c56";
      }

      setText("irr-water-req",   waterMm !== null ? `${waterMm} mm/day` : "—");
      setText("irr-duration",    durMin  !== null ? `${durMin} min` : "—");
      setText("irr-reason",      data.recommendation || data.reason || "—");
      setText("irr-model",       data.model || "—");
      setText("irr-confidence",  data.confidence !== null ? `${(data.confidence * 100).toFixed(0)}%` : "—");
      setText("irr-timestamp",   fmtTime(data.timestamp));

      const inp = data.input || {};
      setText("irr-in-sm",    inp.soilMoisture !== null ? `${inp.soilMoisture}%`   : "No data");
      setText("irr-in-temp",  inp.temperature  !== null ? `${inp.temperature}°C`  : "No data");
      setText("irr-in-humid", inp.humidity     !== null ? `${inp.humidity}%`      : "No data");
      setText("irr-in-rain",  inp.rainfall24h  !== null ? `${inp.rainfall24h} mm` : "No data");
    }
  };

  const fetchIrrigation = async () => {
    const res = await apiGet("/irrigation");
    if (res?.success) renderIrrigation(res.data);
  };

  /* ── Trigger new prediction ──────────────────────────────────────────── */
  const irrPredictBtn = $("irr-predict-btn");
  if (irrPredictBtn) {
    irrPredictBtn.addEventListener("click", async () => {
      irrPredictBtn.textContent = "Running...";
      irrPredictBtn.disabled = true;
      const res = await apiPost("/irrigation/predict", {});
      if (res?.success) renderIrrigation(res.data);
      irrPredictBtn.textContent = "🔄 Run New Prediction";
      irrPredictBtn.disabled = false;
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FERTILIZER  —  /api/fertilizer
  ══════════════════════════════════════════════════════════════════════════ */

  const renderFertilizer = (data) => {
    if (!data) return;

    // ── Dashboard summary line
    setText("db-fertilizer-summary", data.summary || "—");

    // ── Fertilizer section
    if ($("fert-content")) {
      hide("fert-loading");
      show("fert-content");

      const npk = data.npkStatus || {};

      // NPK status boxes
      const fillNpk = (prefix, key) => {
        const status = npk[key] || "UNKNOWN";
        const inp    = data.input || {};
        const val    = inp[key];
        setText(`fert-${prefix}-status`, status);
        setText(`fert-${prefix}-value`,  val !== null && val !== undefined ? `${val} mg/kg` : "No data");
        const tag = $(`fert-${prefix}-tag`);
        if (tag) {
          tag.textContent = status;
          tag.className = `em ${statusBadge(status)}`;
        }
      };
      fillNpk("n", "nitrogen");
      fillNpk("p", "phosphorus");
      fillNpk("k", "potassium");

      // Priority banner
      const priBanner = $("fert-priority-banner");
      if (priBanner) {
        const p = data.priority || "LOW";
        priBanner.textContent = `${p} PRIORITY${data.actionRequired ? " — ACTION NEEDED" : " — NO ACTION NEEDED"}`;
        priBanner.style.background = p === "HIGH" ? "rgba(239,68,68,0.12)" : "rgba(44,175,116,0.12)";
        priBanner.style.borderColor = p === "HIGH" ? "rgba(239,68,68,0.22)" : "rgba(44,175,116,0.22)";
        priBanner.style.color = p === "HIGH" ? "#b91c1c" : "#1b8c56";
      }

      setText("fert-summary",    data.summary || "—");
      setText("fert-model",      data.model || "—");
      setText("fert-timestamp",  fmtTime(data.timestamp));
      setText("fert-note",       data.note || "");

      // Application cards
      const apps = data.applications || [];
      const appsEl = $("fert-applications");
      if (appsEl) {
        if (!apps.length) {
          appsEl.innerHTML = "";
        } else {
          appsEl.innerHTML = apps.map((a) => `
            <div class="info-card" style="padding:0.7rem;">
              <strong>${a.product || "—"}</strong>
              <span style="margin-left:0.5rem;font-size:0.82rem;color:#5e736a;">
                ${a.dosageKgPerHa ? `${a.dosageKgPerHa} kg/ha` : ""}
              </span>
              <p style="margin:0.25rem 0 0;font-size:0.82rem;color:#5e736a;">${a.reason || ""}</p>
            </div>
          `).join("");
        }
      }
    }
  };

  const fetchFertilizer = async () => {
    const res = await apiGet("/fertilizer");
    if (res?.success) renderFertilizer(res.data);
  };

  /* ── Trigger new recommendation ─────────────────────────────────────── */
  const fertPredictBtn = $("fert-predict-btn");
  if (fertPredictBtn) {
    fertPredictBtn.addEventListener("click", async () => {
      fertPredictBtn.textContent = "Running...";
      fertPredictBtn.disabled = true;
      const res = await apiPost("/fertilizer/predict", {});
      if (res?.success) renderFertilizer(res.data);
      fertPredictBtn.textContent = "🔄 Run New Recommendation";
      fertPredictBtn.disabled = false;
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PUMP  —  /api/pump/status  +  POST /api/pump/control
  ══════════════════════════════════════════════════════════════════════════ */

  const renderPump = (data) => {
    if (!data) return;

    const isOn = data.isOn;
    const cmd  = data.currentCommand || "UNKNOWN";
    const last = data.lastEvent;

    // Text + colour
    const pumpEl = $("pump-status-text");
    if (pumpEl) {
      pumpEl.textContent = cmd;
      pumpEl.style.color = isOn ? "#1bb46d" : "#e11d48";
    }

    setText("pump-last-trigger",
      last ? `Triggered by\n${last.triggeredBy || "—"}` : "Triggered by\n—");
    setText("pump-last-duration",
      last?.durationMinutes ? `Last duration\n${last.durationMinutes} min` : "Last duration\n—");

    // Update sidebar status pill
    setText("system-mode", isOn ? "PUMP ON" : "AUTO MODE");
    setText("last-updated", fmtTime(new Date()));
  };

  const fetchPump = async () => {
    const res = await apiGet("/pump/status");
    if (res?.success) renderPump(res.data);
  };

  const sendPumpCommand = async (command) => {
    const feedback = $("pump-feedback");
    if (feedback) feedback.textContent = "Sending command...";

    const res = await apiPost("/pump/control", {
      command,
      reason: `Manual ${command} from dashboard`,
    });

    if (res?.success) {
      renderPump({ isOn: command === "ON", currentCommand: command, lastEvent: res.data });
      if (feedback) feedback.textContent = `✓ Pump ${command} command sent`;
    } else {
      if (feedback) feedback.textContent = "✗ Command failed — check connection";
    }

    // Clear feedback after 4 s
    setTimeout(() => { if (feedback) feedback.textContent = ""; }, 4000);
  };

  const pumpOnBtn  = $("pump-on-btn");
  const pumpOffBtn = $("pump-off-btn");
  if (pumpOnBtn)  pumpOnBtn.addEventListener("click",  () => sendPumpCommand("ON"));
  if (pumpOffBtn) pumpOffBtn.addEventListener("click", () => sendPumpCommand("OFF"));

  /* ══════════════════════════════════════════════════════════════════════════
     DASHBOARD OVERVIEW  —  /api/dashboard
  ══════════════════════════════════════════════════════════════════════════ */

  const renderDashboard = (data) => {
    if (!data) return;

    // Weather summary pill
    const wx = data.weather;
    setText("db-weather-location", wx?.location || "—");
    setText("db-weather-summary",
      wx ? `${wx.temperature ?? "—"}°C | ${wx.condition || "—"}` : "—");

    // Alert badge
    setText("db-alert-count", data.criticalCount ?? data.alertCount ?? 0);

    // Device status
    const pump = data.pump;
    setText("db-device-status",
      pump?.isOn ? "Pump ON" : pump?.currentCommand === "UNKNOWN" ? "No DB" : "Online");

    // Rainfall from weather
    setText("sensor-rainfall", wx?.rainfall24h !== undefined ? `${wx.rainfall24h} mm` : "—");

    // Field info from settings (field is in data.field)
    if (data.field) {
      setText("db-growth-stage", `🌱 ${data.field.growthStage || "—"}`);
    }

    // Bottom metrics populated by settings fetch
  };

  const fetchDashboard = async () => {
    const res = await apiGet("/dashboard");
    if (res?.success) renderDashboard(res.data);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     ALERTS  —  /api/alerts
  ══════════════════════════════════════════════════════════════════════════ */

  const severityColor = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#22c55e" };
  const severityDot   = { HIGH: "blue",    MEDIUM: "amber",   LOW: "cyan" };

  const renderAlerts = (data) => {
    if (!data) return;

    const alerts = data.alerts || [];

    // ── Dashboard mini alert list
    const dashList = $("db-alert-list");
    if (dashList) {
      if (!alerts.length) {
        dashList.innerHTML = `<li><span class="alert-dot cyan"></span><span>No active alerts</span></li>`;
      } else {
        dashList.innerHTML = alerts.slice(0, 5).map((a) => `
          <li>
            <span class="alert-dot ${severityDot[a.severity] || "blue"}"></span>
            <span>${a.title}</span>
            <small>${a.severity}</small>
          </li>
        `).join("");
      }
    }

    // ── Full alerts section
    if ($("alerts-list")) {
      hide("alerts-loading");
      if (!alerts.length) {
        hide("alerts-content");
        show("alerts-empty");
      } else {
        show("alerts-content");
        hide("alerts-empty");
        setHTML("alerts-list", alerts.map((a) => `
          <div class="info-card" style="border-left:4px solid ${severityColor[a.severity] || "#3b82f6"};">
            <h3 style="margin:0;color:${severityColor[a.severity] || "#1d2d29"};">${a.title}</h3>
            <p style="margin:0.35rem 0 0;">${a.message}</p>
            <small style="color:#5e736a;">
              Severity: <strong>${a.severity}</strong> &nbsp;|&nbsp;
              Action: <strong>${a.action || "—"}</strong>
            </small>
          </div>
        `).join(""));
      }
    }
  };

  const fetchAlerts = async () => {
    const res = await apiGet("/alerts");
    if (res?.success) renderAlerts(res.data);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     WEATHER ALERTS  —  /api/weather-alerts?location=...
  ══════════════════════════════════════════════════════════════════════════ */

  const fetchWeather = async (location) => {
    hide("wx-content");
    hide("wx-no-key");
    show("wx-loading");

    const res = await apiGet(`/weather-alerts?location=${encodeURIComponent(location)}`);
    hide("wx-loading");

    if (!res?.success) {
      const msg = res?.error?.code;
      if (msg === "MISSING_API_KEY" || msg === "WEATHER_UNAVAILABLE") {
        show("wx-no-key");
      }
      return;
    }

    const d = res.data;
    show("wx-content");

    setText("wx-temp",     d.weather?.temperature !== undefined ? `${d.weather.temperature}°C` : "—");
    setText("wx-humidity", d.weather?.humidity     !== undefined ? `${d.weather.humidity}%`     : "—");
    setText("wx-rain",     d.weather?.rainfall24h  !== undefined ? `${d.weather.rainfall24h} mm` : "—");
    setText("wx-wind",     d.weather?.windSpeed    !== undefined ? `${d.weather.windSpeed} m/s`  : "—");
    setText("wx-condition", d.weather?.condition || "—");

    const wxAlertList = $("wx-alert-list");
    if (wxAlertList) {
      const alerts = d.alerts || [];
      wxAlertList.innerHTML = alerts.map((a) => `
        <li>
          <span class="alert-dot ${severityDot[a.severity] || "blue"}"></span>
          <span>${a.message}</span>
          <small>${a.severity || ""}</small>
        </li>
      `).join("") || `<li><span class="alert-dot cyan"></span><span>No weather alerts</span></li>`;
    }
  };

  const wxFetchBtn = $("wx-fetch-btn");
  if (wxFetchBtn) {
    wxFetchBtn.addEventListener("click", () => {
      const loc = ($("wx-location")?.value || "").trim();
      if (!loc) return;
      fetchWeather(loc);
    });
    $("wx-location")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") wxFetchBtn.click();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     HISTORY  —  /api/history?days=N
  ══════════════════════════════════════════════════════════════════════════ */

  let _histChart = null;   // Chart.js instance

  const renderHistory = (data) => {
    if (!data) return;

    hide("history-loading");

    const sensor   = data.sensorSummary   || {};
    const pump     = data.pumpSummary     || {};
    const decision = data.decisionSummary || {};
    const records  = data.sensorRecords   || [];

    if (!records.length && !pump.totalEvents) {
      show("history-no-data");
      hide("history-content");
      return;
    }

    hide("history-no-data");
    show("history-content");

    setText("hist-readings",         sensor.readings ?? 0);
    setText("hist-avg-sm",           sensor.avgSoilMoisture !== null ? `${sensor.avgSoilMoisture}%` : "—");
    setHTML("hist-moisture-trend",   `${statusDot("NORMAL")} Moisture trend: ${sensor.moistureTrend || "—"}`);
    setText("hist-cycles",           pump.irrigationCycles ?? 0);
    setHTML("hist-total-duration",   `${statusDot("NORMAL")} Total: ${pump.totalDurationMin ?? 0} min`);
    setText("hist-decisions",        decision.totalDecisions ?? 0);
    setHTML("hist-irrigate-yes",     `${statusDot("NORMAL")} Irrigate: ${decision.irrigateYes ?? 0}× yes`);

    // ── Soil moisture chart (Chart.js)
    const ctx = $("chart-history-sm");
    if (ctx && records.length) {
      const labels = records.map((r) => fmtTime(r.timestamp));
      const values = records.map((r) => r.soilMoisture ?? null);

      if (_histChart) _histChart.destroy();
      _histChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Soil Moisture (%)",
            data: values,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.08)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, title: { display: true, text: "%" } },
            x: { ticks: { maxTicksLimit: 8, maxRotation: 30 } },
          },
        },
      });
    }

    // ── Pump event list
    const pumpList = $("hist-pump-list");
    if (pumpList) {
      const events = pump.recentEvents || [];
      pumpList.innerHTML = events.length
        ? events.map((e) => `
          <li>
            <span class="alert-dot ${e.command === "ON" ? "blue" : "cyan"}"></span>
            <span>${e.command} — ${e.reason || "—"}</span>
            <small>${fmtTime(e.timestamp)}</small>
          </li>
        `).join("")
        : `<li><span class="alert-dot cyan"></span><span>No pump events in this period</span></li>`;
    }
  };

  const fetchHistory = async (days = 7) => {
    show("history-loading");
    hide("history-content");
    hide("history-no-data");
    const res = await apiGet(`/history?days=${days}`);
    if (res?.success) renderHistory(res.data);
    else { hide("history-loading"); show("history-no-data"); }
  };

  const histLoadBtn = $("history-load-btn");
  if (histLoadBtn) {
    histLoadBtn.addEventListener("click", () => {
      const days = parseInt($("history-days")?.value || "7", 10);
      fetchHistory(days);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SETTINGS  —  GET /api/settings  +  POST /api/settings
  ══════════════════════════════════════════════════════════════════════════ */

  const renderSettings = (data) => {
    if (!data) return;

    hide("settings-loading");
    show("settings-content");

    // Populate form inputs
    const set = (id, val) => { const el = $(id); if (el) el.value = val || ""; };

    set("cfg-farmer-name",     data.farmer?.name);
    set("cfg-farmer-location", data.farmer?.location);
    set("cfg-farmer-phone",    data.farmer?.phone);
    set("cfg-field-name",      data.field?.name);
    set("cfg-field-area",      data.field?.area);
    set("cfg-soil-type",       data.field?.soilType);
    set("cfg-irr-type",        data.field?.irrigationType);
    set("cfg-sm-low",          data.thresholds?.soilMoistureLow  ?? 40);
    set("cfg-sm-high",         data.thresholds?.soilMoistureHigh ?? 70);

    // Bottom metrics on dashboard
    setText("db-field-name",  `📍 ${data.field?.name || "Field 1"}`);
    setText("bm-area",        data.field?.area         || "—");
    setText("bm-soil",        data.field?.soilType     || "—");
    setText("bm-irr-type",    data.field?.irrigationType || "—");
    setText("bm-location",    data.farmer?.location    || "—");
  };

  const fetchSettings = async () => {
    const res = await apiGet("/settings");
    if (res?.success) renderSettings(res.data);
    else { hide("settings-loading"); show("settings-content"); }
  };

  const settingsForm = $("settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const feedback = $("settings-feedback");
      if (feedback) feedback.textContent = "Saving...";

      // Build nested object from flat form field names (field.name → { field: { name } })
      const updates = {};
      new FormData(settingsForm).forEach((value, key) => {
        const parts = key.split(".");
        if (parts.length === 2) {
          updates[parts[0]] = updates[parts[0]] || {};
          updates[parts[0]][parts[1]] = value;
        } else {
          updates[key] = value;
        }
      });

      const res = await apiPost("/settings", updates);
      if (feedback) {
        feedback.textContent = res?.success ? "✓ Saved" : "✗ Save failed";
        setTimeout(() => { feedback.textContent = ""; }, 3000);
      }
      if (res?.success) renderSettings(updates);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     TREND CHARTS  (dashboard overview)
  ══════════════════════════════════════════════════════════════════════════ */

  let _moistureChart   = null;
  let _tempHumidChart  = null;

  /**
   * Fetch last 24 h of sensor records from /api/history?days=1
   * and draw the two mini charts on the dashboard overview.
   */
  const fetchAndDrawOverviewCharts = async () => {
    const res = await apiGet("/history?days=1");
    if (!res?.success) return;

    const records = res.data?.sensorRecords || [];
    if (!records.length) return;

    const labels  = records.map((r) => fmtTime(r.timestamp));
    const sm      = records.map((r) => r.soilMoisture ?? null);
    const temp    = records.map((r) => r.temperature  ?? null);
    const humid   = records.map((r) => r.humidity     ?? null);

    const ctxSm = $("chart-moisture");
    if (ctxSm) {
      if (_moistureChart) _moistureChart.destroy();
      _moistureChart = new Chart(ctxSm, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Soil Moisture (%)",
            data: sm,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.08)",
            tension: 0.3, fill: true, pointRadius: 2,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100 },
            x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          },
        },
      });
    }

    const ctxTH = $("chart-temp-humid");
    if (ctxTH) {
      if (_tempHumidChart) _tempHumidChart.destroy();
      _tempHumidChart = new Chart(ctxTH, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Temp (°C)",
              data: temp,
              borderColor: "#f59e0b",
              backgroundColor: "transparent",
              tension: 0.3, pointRadius: 2,
            },
            {
              label: "Humidity (%)",
              data: humid,
              borderColor: "#3b82f6",
              backgroundColor: "transparent",
              tension: 0.3, pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 10 } } } },
          scales: {
            y: { min: 0 },
            x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } },
          },
        },
      });
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     LAZY SECTION LOAD  —  only fetch when user navigates to a section
  ══════════════════════════════════════════════════════════════════════════ */

  const _loaded = new Set();

  const onSectionActivate = (target) => {
    if (_loaded.has(target)) return;
    _loaded.add(target);

    switch (target) {
      case "monitoring":     fetchSensor();     break;
      case "irrigation":     fetchIrrigation(); break;
      case "nutrient":       fetchFertilizer(); break;
      case "weather-alerts": /* user must click fetch */ break;
      case "history":        fetchHistory();    break;
      case "other-alerts":   fetchAlerts();     break;
      case "settings":       fetchSettings();   break;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     POLLING  —  periodic background refreshes
  ══════════════════════════════════════════════════════════════════════════ */

  const SENSOR_POLL_MS    = 15_000;
  const DASHBOARD_POLL_MS = 20_000;
  const ALERT_POLL_MS     = 30_000;

  const refreshAll = async () => {
    await Promise.all([
      fetchSensor(),
      fetchIrrigation(),
      fetchFertilizer(),
      fetchPump(),
    ]);
  };

  setInterval(refreshAll,         SENSOR_POLL_MS);
  setInterval(fetchDashboard,     DASHBOARD_POLL_MS);
  setInterval(fetchAlerts,        ALERT_POLL_MS);

  /* ══════════════════════════════════════════════════════════════════════════
     INITIAL LOAD  —  prime the dashboard on page open
  ══════════════════════════════════════════════════════════════════════════ */

  const init = async () => {
    await Promise.all([
      fetchSensor(),
      fetchIrrigation(),
      fetchFertilizer(),
      fetchPump(),
      fetchDashboard(),
      fetchAlerts(),
      fetchSettings(),
    ]);
    fetchAndDrawOverviewCharts();
  };

  init();

})();
