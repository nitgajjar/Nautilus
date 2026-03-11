// App state
let map;
let markers = {};
let selectedPortId = null;
let currentFilter = "all";

// Risk level helpers
function getRiskLevel(score) {
  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "safe";
}

function getRiskColor(score) {
  if (score >= 8) return "#ff2d55";
  if (score >= 5) return "#ff9500";
  if (score >= 3) return "#ffcc00";
  return "#30d158";
}

function getRiskLabel(score) {
  if (score >= 8) return "CRITICAL";
  if (score >= 5) return "HIGH RISK";
  if (score >= 3) return "MODERATE";
  return "SAFE";
}

// ─── INIT MAP ───────────────────────────────────────────────
function initMap() {
  map = L.map("map", {
    center: [20, 10],
    zoom: 2.5,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
  });

  // Dark tile layer
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap',
    className: "dark-tiles"
  }).addTo(map);

  // Add CSS to darken map tiles
  const style = document.createElement("style");
  style.textContent = `.dark-tiles { filter: invert(100%) hue-rotate(180deg) brightness(0.6) saturate(0.5); }`;
  document.head.appendChild(style);
}

// ─── MARKERS ────────────────────────────────────────────────
function createMarkerIcon(port) {
  const data = portRiskData[port.id];
  const score = data ? Math.round(data.score) : port.baseRisk;
  const color = getRiskColor(score);
  const level = getRiskLevel(score);
  const size = score >= 8 ? 36 : score >= 5 ? 30 : 26;

  const pulse = level === "critical" ? `
    <div style="
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      width:${size + 16}px; height:${size + 16}px;
      border-radius:50%;
      border:2px solid ${color};
      opacity:0.4;
      animation:pulse-ring 2s infinite;
    "></div>` : "";

  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      ${pulse}
      <div style="
        position:absolute; top:0; left:0;
        width:${size}px; height:${size}px;
        border-radius:50%;
        background: radial-gradient(circle, ${color}33, ${color}11);
        border: 2px solid ${color};
        box-shadow: 0 0 ${score >= 8 ? 20 : 10}px ${color}88;
        display:flex; align-items:center; justify-content:center;
        font-family:'Orbitron',monospace;
        font-size:${size >= 36 ? 11 : 10}px;
        font-weight:700;
        color:${color};
        cursor:pointer;
      ">${score}</div>
    </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function addMarkers() {
  PORTS.forEach(port => {
    const icon = createMarkerIcon(port);
    const marker = L.marker([port.lat, port.lng], { icon })
      .addTo(map)
      .on("click", () => selectPort(port.id))
      .on("mouseover", (e) => showTooltip(port.id, e.originalEvent))
      .on("mouseout", hideTooltip)
      .on("mousemove", (e) => moveTooltip(e.originalEvent));

    markers[port.id] = marker;
  });

  // Add pulse ring CSS
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse-ring {
      0% { transform: translate(-50%,-50%) scale(0.8); opacity:0.6; }
      100% { transform: translate(-50%,-50%) scale(1.6); opacity:0; }
    }`;
  document.head.appendChild(style);
}

function updateMapMarkers() {
  PORTS.forEach(port => {
    if (markers[port.id]) {
      markers[port.id].setIcon(createMarkerIcon(port));
    }
  });
}

// ─── TOOLTIP ────────────────────────────────────────────────
function showTooltip(portId, e) {
  const port = PORTS.find(p => p.id === portId);
  const data = portRiskData[portId];
  if (!port || !data) return;

  const score = data.score;
  const color = getRiskColor(score);
  const label = getRiskLabel(score);
  const reasons = data.reasons.slice(0, 2);

  const tooltip = document.getElementById("tooltip");
  tooltip.innerHTML = `
    <div class="tooltip-name">${port.name}</div>
    <div class="tooltip-country">📍 ${port.country} · ${port.region}</div>
    <div class="tooltip-score" style="color:${color}">${score.toFixed(1)}<span style="font-size:0.9rem;color:#4a7a99">/10</span></div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:${color};margin-bottom:6px;letter-spacing:1px;">${label}</div>
    ${reasons.length > 0 ? `
      <div class="tooltip-reason">
        ${reasons.map(r => `⚠ ${r.replace(/^\[[^\]]+\]\s*/g, "").trim().slice(0, 90)}`).join("<br/>")}
      </div>` : port.intel ? `
      <div class="tooltip-reason" style="color:var(--text-mid)">
        ${port.intel.slice(0, 120)}…
      </div>` : ""}
    <div class="tooltip-hint">Click for full details →</div>
  `;

  tooltip.classList.remove("hidden");
  moveTooltip(e);
}

function moveTooltip(e) {
  const tooltip = document.getElementById("tooltip");
  const x = e.clientX + 16;
  const y = e.clientY - 10;
  const maxX = window.innerWidth - tooltip.offsetWidth - 20;
  const maxY = window.innerHeight - tooltip.offsetHeight - 20;
  tooltip.style.left = Math.min(x, maxX) + "px";
  tooltip.style.top = Math.min(y, maxY) + "px";
}

function hideTooltip() {
  document.getElementById("tooltip").classList.add("hidden");
}

// ─── PORT LIST ──────────────────────────────────────────────
function renderPortList() {
  const container = document.getElementById("portList");
  const search = document.getElementById("searchInput").value.toLowerCase();

  const sorted = [...PORTS].sort((a, b) => {
    const sa = portRiskData[a.id]?.score ?? a.baseRisk;
    const sb = portRiskData[b.id]?.score ?? b.baseRisk;
    return sb - sa;
  });

  container.innerHTML = "";
  let rank = 0;

  sorted.forEach(port => {
    const score = portRiskData[port.id]?.score ?? port.baseRisk;
    const level = getRiskLevel(score);
    const color = getRiskColor(score);

    if (currentFilter !== "all") {
      if (currentFilter === "critical" && level !== "critical") return;
      if (currentFilter === "high"     && level !== "high")     return;
      if (currentFilter === "safe"     && level !== "safe")     return;
    }
    if (search) {
      const s = `${port.name} ${port.country} ${port.region}`.toLowerCase();
      if (!s.includes(search)) return;
    }

    rank++;
    const item = document.createElement("div");
    item.className = `port-item${selectedPortId === port.id ? " selected" : ""}`;
    item.onclick = () => selectPort(port.id);
    item.innerHTML = `
      <div class="port-rank">${rank}</div>
      <div class="port-risk-badge ${level}">${score % 1 === 0 ? score : score.toFixed(1)}</div>
      <div class="port-info">
        <div class="port-name">${port.name.replace("Port of ","")}</div>
        <div class="port-meta">${port.country} · ${port.region}</div>
        <div class="risk-bar-mini">
          <div class="risk-bar-fill" style="width:${score*10}%;background:${color}"></div>
        </div>
      </div>`;
    container.appendChild(item);
  });

  document.getElementById("portCount").textContent = rank;
}

// ─── PORT DETAIL ────────────────────────────────────────────
function selectPort(portId) {
  selectedPortId = portId;
  const port = PORTS.find(p => p.id === portId);
  const data = portRiskData[portId];
  if (!port || !data) return;

  const score = data.score;
  const color = getRiskColor(score);
  const level = getRiskLevel(score);
  const label = getRiskLabel(score);

  // Pan map to port
  map.flyTo([port.lat, port.lng], 5, { duration: 1 });

  // Render detail panel
  const detail = document.getElementById("portDetail");
  detail.innerHTML = `
    <div class="detail-card">
      <div class="detail-name">${port.name}</div>
      <div class="detail-country">📍 ${port.country} · ${port.region}</div>

      <div class="risk-score-display">
        <div class="risk-number" style="color:${color};text-shadow:0 0 20px ${color}88">
          ${score.toFixed(1)}
        </div>
        <div>
          <div class="risk-label-big" style="color:${color}">${label}</div>
          <div style="color:#4a7a99;font-size:0.7rem;margin-top:2px">Risk Score / 10</div>
        </div>
      </div>

      <div class="risk-bar-full">
        <div class="risk-bar-full-fill" style="width:${score * 10}%;background:linear-gradient(90deg,${color}88,${color})"></div>
      </div>

      <div class="detail-section-title">MONITORED KEYWORDS</div>
      <div class="keywords-list">
        ${port.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join("")}
      </div>

      <div class="detail-section-title">STANDING THREAT ASSESSMENT</div>
      <div class="reason-list">
        <div class="reason-item ${score >= 8 ? 'high' : score >= 5 ? 'medium' : 'safe'}" style="font-size:0.78rem;line-height:1.55;border-left-color:${color}">
          ${port.intel || "No standing assessment available."}
        </div>
      </div>

      <div class="detail-section-title">LIVE INTEL (${data.reasons.length} matched today)</div>
      <div class="reason-list">
        ${data.reasons.length === 0
          ? `<div style="color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:0.62rem;padding:6px 0;line-height:1.8">
               No headlines matched this port in the current feed cycle.<br>
               Standing assessment above reflects baseline conditions.
             </div>`
          : data.reasons.slice(0, 5).map((r, i) => {
              const clean = r.replace(/^\[[^\]]+\]\s*/g, "").trim();
              return `<div class="reason-item ${i === 0 ? level : "medium"}">⚠ ${clean}</div>`;
            }).join("")
        }
      </div>

      <div class="detail-section-title" style="margin-top:14px">LOCATION DATA</div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.62rem;color:#4a7a99;line-height:1.8">
        LAT: ${port.lat.toFixed(4)}<br>
        LNG: ${port.lng.toFixed(4)}<br>
        NEAREST SEA: ${port.keywords.find(k => k.includes("sea") || k.includes("ocean") || k.includes("gulf") || k.includes("strait")) || "N/A"}
      </div>
    </div>
  `;

  // Re-render list to show selection
  renderPortList();

  // On mobile, auto-switch to detail tab
  if (window.innerWidth <= 768) {
    const detailBtn = document.querySelectorAll(".tab-btn")[3];
    if (detailBtn) showTab("detail", detailBtn);
  }
}

// ─── ALERT FEED ─────────────────────────────────────────────
function renderAlertFeed() {
  const feed = document.getElementById("alertFeed");
  if (liveAlerts.length === 0) {
    feed.innerHTML = `<div class="alert-placeholder">No geopolitical headlines matched<br>any monitored port today</div>`;
    return;
  }

  const tierColors = {
    critical:"#ff3355", severe:"#ff6b35", high:"#ff9f0a",
    elevated:"#ffd60a", watch:"#32d74b", info:"#00c8f0", positive:"#30d158"
  };

  feed.innerHTML = liveAlerts.slice(0, 80).map(alert => {
    const c = tierColors[alert.level] || "#3d6a85";
    const label = (alert.tierLabel || alert.level).toUpperCase();
    const url = alert.link && alert.link !== "#" ? alert.link : null;
    const tag = url ? "a" : "div";
    const extra = url ? `href="${url}" target="_blank" rel="noopener"` : "";
    return `
    <${tag} class="alert-item" ${extra}>
      <div class="alert-badges">
        <span class="alert-badge" style="background:${c}18;color:${c};border-color:${c}44">${label}</span>
        <span class="alert-badge" style="background:rgba(60,90,110,0.2);color:var(--text-dim);border-color:var(--border2)">${alert.source}</span>
        ${alert.isNew ? '<span class="alert-badge" style="background:rgba(50,215,75,0.15);color:#32d74b;border-color:rgba(50,215,75,0.4);animation:pulse-dot 1.5s infinite">● NEW</span>' : ""}
        ${url ? `<span class="alert-badge" style="background:rgba(0,200,240,0.08);color:var(--accent2);border-color:var(--accent3);margin-left:auto">↗ READ</span>` : ""}
      </div>
      <div class="alert-title">${alert.title}</div>
      ${alert.ports.length ? `<div class="alert-ports"><span class="alert-ports-icon">⚓</span>${alert.ports.join(" · ")}</div>` : ""}
    </${tag}>`;
  }).join("");
}

// ─── HEADER STATS ───────────────────────────────────────────
function updateHeaderStats() {
  let critical = 0, high = 0, safe = 0;

  PORTS.forEach(port => {
    const score = portRiskData[port.id]?.score || port.baseRisk;
    const level = getRiskLevel(score);
    if (level === "critical") critical++;
    else if (level === "high") high++;
    else if (level === "safe") safe++;
  });

  document.getElementById("criticalCount").textContent = critical;
  document.getElementById("highCount").textContent = high;
  document.getElementById("safeCount").textContent = safe;
  document.getElementById("alertCount").textContent = liveAlerts.length;
}

// ─── MOBILE TAB NAVIGATION ──────────────────────────────────
function showTab(tab, btn) {
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  // Map tab names to elements
  const panels = {
    map:    document.querySelector(".map-container"),
    ports:  document.querySelector(".left-panel"),
    intel:  document.querySelector(".right-panel"),
    detail: document.querySelector(".right-panel"),
  };

  // Hide all, show selected
  document.querySelector(".map-container").classList.remove("tab-active");
  document.querySelector(".left-panel").classList.remove("tab-active");
  document.querySelector(".right-panel").classList.remove("tab-active");

  if (panels[tab]) panels[tab].classList.add("tab-active");

  // Resize map when it becomes visible (Leaflet needs this)
  if (tab === "map" && map) {
    setTimeout(() => map.invalidateSize(), 50);
  }

  // If switching to detail on mobile, scroll port detail into view
  if (tab === "detail") {
    const detail = document.getElementById("portDetail");
    if (detail) setTimeout(() => detail.scrollIntoView({ behavior: "smooth" }), 100);
  }
}

// On load, activate map tab by default on mobile
function initMobileTabs() {
  if (window.innerWidth <= 768) {
    document.querySelector(".map-container")?.classList.add("tab-active");
  }
}

// ─── FILTER & SEARCH ────────────────────────────────────────
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderPortList();
}

function filterPorts() { renderPortList(); }

// ─── TIMEZONES ───────────────────────────────────────────────
const TIMEZONES = [
  { label: "UTC",  tz: "UTC",                    highlight: true  },
  { label: "GMT",  tz: "Europe/London"                            },
  { label: "CET",  tz: "Europe/Paris"                             },
  { label: "MSK",  tz: "Europe/Moscow"                            },
  { label: "GST",  tz: "Asia/Dubai"                               },
  { label: "IST",  tz: "Asia/Kolkata",            highlight: true  },
  { label: "ICT",  tz: "Asia/Bangkok"                             },
  { label: "SGT",  tz: "Asia/Singapore"                           },
  { label: "CST",  tz: "Asia/Shanghai"                            },
  { label: "JST",  tz: "Asia/Tokyo"                               },
  { label: "AEST", tz: "Australia/Sydney"                         },
  { label: "EST",  tz: "America/New_York",        highlight: true  },
  { label: "CST",  tz: "America/Chicago"                          },
  { label: "PST",  tz: "America/Los_Angeles"                      },
  { label: "BRT",  tz: "America/Sao_Paulo"                        },
];

// ─── REFRESH COUNTDOWN ──────────────────────────────────────
let _nextRefresh = Date.now() + 20 * 60 * 1000;
function setNextRefresh() { _nextRefresh = Date.now() + 20 * 60 * 1000; }

function updateRefreshCountdown() {
  const btn = document.querySelector(".refresh-btn");
  if (!btn) return;
  const remaining = Math.max(0, _nextRefresh - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  btn.textContent = `⟳  NEXT ${m}:${String(s).padStart(2,"0")}`;
}

function updateClock() {
  const now = new Date();
  const bar = document.getElementById("timezoneBar");
  if (!bar) return;

  bar.innerHTML = TIMEZONES.map(zone => {
    const timeStr = now.toLocaleTimeString("en-GB", {
      timeZone: zone.tz,
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    const dateStr = now.toLocaleDateString("en-GB", {
      timeZone: zone.tz,
      day: "2-digit", month: "short"
    });
    return `
      <div class="tz-chip${zone.highlight ? " highlight" : ""}">
        <div class="tz-label">${zone.label}</div>
        <div class="tz-time">${timeStr}</div>
        <div class="tz-date">${dateStr}</div>
      </div>`;
  }).join("");
}

// ─── STARTUP ────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  const overlay = document.getElementById("loadingOverlay");
  const status  = document.getElementById("loadingStatus");

  const setStatus = (msg) => { if (status) status.textContent = msg; };

  setStatus("LOADING MAP ENGINE...");
  await new Promise(r => setTimeout(r, 300));

  initRiskData();
  initMap();

  setStatus("PLACING 200 PORT MARKERS...");
  await new Promise(r => setTimeout(r, 300));

  addMarkers();
  renderPortList();
  updateHeaderStats();
  updateClock();
  initMobileTabs();
  setInterval(() => { updateClock(); updateRefreshCountdown(); }, 1000);
  setInterval(fetchAndAnalyzeFeeds, 20 * 60 * 1000); // 20min: 17 feeds × 3/hr = 51 req (under rss2json free 60/hr limit)

  setStatus("CONNECTING TO LIVE FEEDS...");
  await new Promise(r => setTimeout(r, 400));

  // Hide overlay smoothly then fetch
  overlay.classList.add("hidden");
  setTimeout(() => { overlay.style.display = "none"; }, 700);

  setNextRefresh();
  await fetchAndAnalyzeFeeds();
});