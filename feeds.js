// ═══════════════════════════════════════════════════════════
//  NAUTILUS — Feed Sources
//  All feeds go via rss2json.com which fetches LIVE from the
//  origin on every call — no proxy caching, always fresh.
// ═══════════════════════════════════════════════════════════

// rss2json API — free tier: 60 req/hr. Paste a paid key below to unlock more.
const RSS2JSON_KEY = "";
const R2J = url =>
  `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}` +
  (RSS2JSON_KEY ? `&api_key=${RSS2JSON_KEY}` : ``);

const RSS_FEEDS = [
  // ── MARITIME / NAVAL ─────────────────────────────────────
  { name: "gCaptain",             credit: "© gCaptain",                    r2j: "https://gcaptain.com/feed/"                              },
  { name: "Maritime Executive",   credit: "© The Maritime Executive",      r2j: "https://maritime-executive.com/rss.xml"                  },
  { name: "Naval Today",          credit: "© Naval Today",                 r2j: "https://navaltoday.com/feed/"                            },
  { name: "Safety4Sea",           credit: "© Safety4Sea",                  r2j: "https://safety4sea.com/feed/"                            },
  { name: "Hellenic Shipping",    credit: "© Hellenic Shipping News",      r2j: "https://www.hellenicshippingnews.com/feed/"              },
  { name: "USNI News",            credit: "© USNI News",                   r2j: "https://news.usni.org/feed"                              },
  // ── WORLD / GEOPOLITICAL ─────────────────────────────────
  { name: "BBC World",            credit: "© BBC News",                    r2j: "https://feeds.bbci.co.uk/news/world/rss.xml"             },
  { name: "BBC Middle East",      credit: "© BBC News",                    r2j: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml" },
  { name: "BBC Asia",             credit: "© BBC News",                    r2j: "https://feeds.bbci.co.uk/news/world/asia/rss.xml"        },
  { name: "BBC Africa",           credit: "© BBC News",                    r2j: "https://feeds.bbci.co.uk/news/world/africa/rss.xml"      },
  { name: "Al Jazeera",           credit: "© Al Jazeera",                  r2j: "https://www.aljazeera.com/xml/rss/all.xml"               },
  { name: "Reuters World",        credit: "© Reuters",                     r2j: "https://feeds.reuters.com/reuters/worldNews"             },
  { name: "DW World",             credit: "© Deutsche Welle",              r2j: "https://rss.dw.com/xml/rss-en-world"                    },
  { name: "France 24",            credit: "© France 24",                   r2j: "https://www.france24.com/en/rss"                        },
  { name: "The Guardian",         credit: "© The Guardian",                r2j: "https://www.theguardian.com/world/rss"                   },
  { name: "The Diplomat",         credit: "© The Diplomat",                r2j: "https://thediplomat.com/feed/"                           },
  { name: "Geopolitical Monitor", credit: "© Geopolitical Monitor",        r2j: "https://www.geopoliticalmonitor.com/feed/"               },
];

// Cache-bust: append timestamp so proxies never serve stale cached copies
const PROXY_LIST = [
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&_cb=${Date.now()}`,
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&_cb=${Date.now()}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
  url => url,
];

// Parse raw RSS/Atom XML → array of article objects
function parseRSS(xmlText, feedName) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML parse error");
    const items = doc.querySelectorAll("item, entry");
    const results = [];
    items.forEach(item => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const desc  = (item.querySelector("description, summary, content")?.textContent || "")
                    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const linkEl = item.querySelector("link");
      const link   = linkEl?.textContent?.trim() || linkEl?.getAttribute("href") || "#";
      const pub    = item.querySelector("pubDate, published, updated, dc\\:date")?.textContent || "";
      if (title.length > 5) results.push({ title, description: desc, link, pubDate: pub });
    });
    return results;
  } catch(e) { return []; }
}

// ── SEEN TITLES — persists across refreshes in this session ──────────────────
// Stores title hashes so already-displayed headlines never reappear
const _seenTitles = new Set();
// Clear seen titles every 2 hours so the feed stays fresh across long sessions
setInterval(() => { _seenTitles.clear(); console.log("🔄 Seen titles cache cleared"); }, 2 * 60 * 60 * 1000);

// Parse rss2json JSON response → articles array
function parseRSS2JSON(json, feedName, credit) {
  try {
    if (!json || json.status !== "ok") return [];
    return (json.items || []).map(item => ({
      title:       (item.title || "").replace(/<[^>]*>/g, "").trim(),
      description: (item.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      link:        item.link || item.guid || "#",
      pubDate:     item.pubDate || "",
      source:      feedName,
      credit:      credit
    })).filter(a => a.title.length > 8);
  } catch(e) { return []; }
}

// Fetch one feed via rss2json.com — always live, no proxy caching
async function fetchFeed(feed) {
  try {
    // Build the rss2json API url from the r2j field
    const apiUrl = R2J(feed.r2j);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    const res = await fetch(apiUrl, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`⚠️ ${feed.name}: HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const items = parseRSS2JSON(json, feed.name, feed.credit);

    // Filter articles older than 48 hours — keeps the feed genuinely fresh
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    const fresh = items.filter(item => {
      if (!item.pubDate) return true;
      const t = new Date(item.pubDate).getTime();
      return isNaN(t) || t > cutoff;
    });

    console.log(`✅ ${feed.name}: ${fresh.length}/${items.length} articles (last 48h)`);
    return fresh;
  } catch(e) {
    console.warn(`⚠️ ${feed.name}: ${e.message}`);
    return [];
  }
}

// ── STATE ──────────────────────────────────────────────────
let liveAlerts   = [];
let portRiskData = {};

function initRiskData() {
  PORTS.forEach(port => {
    portRiskData[port.id] = {
      score:   port.baseRisk,
      reasons: []
    };
  });
}

// ── CREDITS FOOTER ─────────────────────────────────────────
function renderCredits(activeSources) {
  const existing = document.getElementById("creditsBar");
  if (existing) existing.remove();
  if (!activeSources.length) return;
  const unique = [...new Set(activeSources)];
  const bar = document.createElement("div");
  bar.id = "creditsBar";
  bar.style.cssText = `
    position:fixed; bottom:0; left:0; right:0;
    background:rgba(2,12,20,0.96); border-top:1px solid #0d2a3f;
    padding:4px 16px; font-family:'Share Tech Mono',monospace;
    font-size:0.55rem; color:#4a7a99; z-index:9998;
    display:flex; gap:12px; flex-wrap:wrap; align-items:center;
  `;
  bar.innerHTML = `<span style="color:#0099cc;letter-spacing:1px;flex-shrink:0">DATA SOURCES:</span>`
    + unique.map(c => `<span>${c}</span>`).join(" · ");
  document.body.appendChild(bar);
}

// Main function: fetch all feeds, analyze, update port risks
async function fetchAndAnalyzeFeeds() {
  updateFeedStatus("SCANNING...", false);
  liveAlerts = [];
  initRiskData();

  // Fetch all feeds in parallel
  const results = await Promise.all(RSS_FEEDS.map(feed => fetchFeed(feed)));
  let allItems = results.flat();

  // Collect which sources actually worked for credits
  const activeSources = [];
  results.forEach((items, i) => {
    if (items.length > 0) activeSources.push(RSS_FEEDS[i].credit);
  });

  // Deduplicate within this batch by title
  const batchSeen = new Set();
  allItems = allItems.filter(item => {
    const key = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70);
    if (batchSeen.has(key)) return false;
    batchSeen.add(key);
    return true;
  });

  // Tag each article as new (not seen before) or seen
  // Articles are always shown — _seenTitles only drives the NEW badge
  allItems = allItems.map(item => {
    const key = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 70);
    const isNew = !_seenTitles.has(key);
    _seenTitles.add(key);
    return { ...item, isNew };
  });

  // Sort by pubDate descending — newest articles first
  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  console.log(`Total unique articles: ${allItems.length} from ${activeSources.length} sources`);

  if (allItems.length === 0) {
    updateFeedStatus("FEEDS UNAVAILABLE — USING DEMO DATA", false);
    allItems = getDemoAlerts();
  } else {
    renderCredits(activeSources);
  }

  // Country → port IDs mapping for country-level threat matching
  const COUNTRY_PORT_MAP = {
    // East Asia
    "china":         [1,14,28,35,36,37,38,58],
    "chinese":       [1,14,28,35,36,37,38,58],
    "taiwan":        [39],
    "taiwan strait": [1,39],
    "japan":         [31,32,33,34,69,70,196,197,198],
    "japanese":      [31,32,33,34,69,70],
    "south korea":   [6,56,57],
    "korean":        [6,56,57],
    "north korea":   [6,29,199],
    "dprk":          [6,29,199],
    "hong kong":     [28],
    "russia":        [18,29,132,133,134,199,200],
    "russian":       [18,29,132,133,134,199,200],
    // Southeast Asia
    "singapore":     [2],
    "malaysia":      [13,15,52,53,63],
    "indonesia":     [44,45],
    "philippines":   [40],
    "thailand":      [41,51],
    "vietnam":       [42,43],
    "cambodia":      [54],
    "myanmar":       [55,62],
    "burma":         [55,62],
    // South Asia
    "india":         [9,47,48,49,189,190,191,192,193],
    "indian":        [9,47,48,49,189,190,191,192,193],
    "pakistan":      [19,60],
    "bangladesh":    [46,195],
    "sri lanka":     [4,50,59,61,194],
    "maldives":      [181],
    // Middle East
    "uae":           [5],
    "emirates":      [5],
    "dubai":         [5],
    "iran":          [27],
    "iranian":       [27],
    "hormuz":        [5,27],
    "israel":        [26,186],
    "israeli":       [26,186],
    "houthi":        [8,187],
    "yemen":         [8,187,188],
    "saudi":         [77,78],
    "saudi arabia":  [77,78],
    "qatar":         [73],
    "kuwait":        [74],
    "oman":          [75,76],
    "iraq":          [83],
    "jordan":        [79,185],
    "syria":         [81,82],
    "syrian":        [81,82],
    "lebanon":       [80],
    "suez":          [7],
    "egypt":         [7,84],
    "red sea":       [7,8,77,79,186,187],
    // Europe
    "netherlands":   [3],
    "dutch":         [3],
    "belgium":       [12,140],
    "germany":       [101,102],
    "german":        [101,102],
    "france":        [103,104,139],
    "french":        [103,104,139],
    "spain":         [105,106,107],
    "spanish":       [105,106,107],
    "italy":         [108,109,110,111],
    "italian":       [108,109,110,111],
    "greece":        [16,115],
    "greek":         [16,115],
    "turkey":        [17],
    "turkish":       [17],
    "ukraine":       [18],
    "ukrainian":     [18],
    "black sea":     [17,18,134,135,136,137],
    "poland":        [128],
    "baltic":        [128,129,130,131,132,133],
    "latvia":        [129],
    "estonia":       [130],
    "lithuania":     [131],
    "kaliningrad":   [132],
    "finland":       [127],
    "uk":            [118,119,120,121],
    "britain":       [118,119,120,121],
    "british":       [118,119,120,121],
    "sweden":        [122],
    "norway":        [123,124],
    "denmark":       [125,126],
    "portugal":      [116,117],
    "romania":       [135],
    "bulgaria":      [136,137],
    // North Africa
    "libya":         [30,85],
    "libyan":        [30,85],
    "tunisia":       [86],
    "algeria":       [87],
    "morocco":       [88,89],
    // Africa
    "nigeria":       [21],
    "kenya":         [20,175],
    "tanzania":      [22],
    "south africa":  [99,100],
    "angola":        [96],
    "mozambique":    [97,98,176],
    "somalia":       [72,184],
    "somali":        [72,184],
    "djibouti":      [71],
    "eritrea":       [182,183],
    "ghana":         [92],
    "cameroon":      [95],
    "senegal":       [91],
    "guinea":        [93],
    // Americas
    "usa":           [10,11,141,142,143,144,145,146],
    "united states": [10,11,141,142,143,144,145,146],
    "american":      [10,11,141,142,143,144,145,146],
    "canada":        [25,147,148],
    "canadian":      [25,147,148],
    "mexico":        [149,150],
    "mexican":       [149,150],
    "panama":        [151,152],
    "colombia":      [153,154],
    "brazil":        [23,159,160,161,162,163],
    "brazilian":     [23,159,160,161,162,163],
    "chile":         [24],
    "argentina":     [157],
    "venezuela":     [170],
    "cuba":          [164],
    "haiti":         [166],
    "peru":          [156],
    "ecuador":       [155],
    // Oceania
    "australia":     [64,65,66,67,174],
    "australian":    [64,65,66,67,174],
    "new zealand":   [68],
  };

  // Threat-only words — if headline has country + any of these, raise that country's ports
  const COUNTRY_THREAT_WORDS = [
    "war", "attack", "strike", "missile", "bomb", "invasion", "troops",
    "military", "conflict", "battle", "drone", "blockade", "sanction",
    "coup", "rebel", "terrorist", "nuclear", "weapon", "navy", "naval",
    "threat", "tension", "crisis", "seized", "hostage", "explosion",
    "shooting", "assassination", "protest", "unrest", "riot", "siege",
    "typhoon", "earthquake", "tsunami", "hurricane", "cyclone",
    "recession", "collapse", "default", "embargo", "tariff war"
  ];

  // Words that prove an article is geopolitically/maritimely relevant
  const RELEVANCE_WORDS = [
    "war", "attack", "strike", "missile", "bomb", "troops", "military",
    "navy", "naval", "warship", "weapon", "sanction", "blockade",
    "invasion", "conflict", "battle", "drone", "nuclear", "threat",
    "tension", "crisis", "coup", "rebel", "militia", "terrorist",
    "ship", "vessel", "tanker", "cargo", "port", "shipping", "fleet",
    "export", "import", "trade", "tariff", "embargo", "supply chain",
    "freight", "container", "oil", "gas", "lng", "pipeline",
    "sanction", "treaty", "diplomacy", "alliance", "nato", "un ",
    "government", "president", "minister", "parliament", "election",
    "economy", "gdp", "inflation", "currency", "debt", "recession",
    "protest", "unrest", "refugee", "border", "territorial",
    "earthquake", "typhoon", "hurricane", "cyclone", "tsunami", "flood"
  ];

  // Analyze each article
  allItems.forEach(item => {
    const headline = (item.title || "").toLowerCase();
    const rawDesc  = (item.description || "").replace(/<[^>]*>/g, " ").toLowerCase();
    const fullText = headline + " " + rawDesc;

    // RELEVANCE GATE: headline must contain at least one geopolitical/maritime word
    const isRelevant = RELEVANCE_WORDS.some(w => headline.includes(w));
    if (!isRelevant) return;

    // STEP 1: Match ports via port keywords (headline only)
    let matchedPorts = [];
    PORTS.forEach(port => {
      for (const portKw of port.keywords) {
        if (headline.includes(portKw.toLowerCase())) {
          matchedPorts.push(port.id);
          break;
        }
      }
    });

    // STEP 1B: Country-level matching — if headline has country name + a threat word,
    // raise all ports belonging to that country
    // Only triggers if the headline also has a real threat word (not just "india economy")
    const hasCountryThreat = COUNTRY_THREAT_WORDS.some(w => headline.includes(w));
    if (hasCountryThreat) {
      Object.entries(COUNTRY_PORT_MAP).forEach(([country, portIds]) => {
        if (headline.includes(country)) {
          portIds.forEach(id => {
            if (!matchedPorts.includes(id)) matchedPorts.push(id);
          });
        }
      });
    }

    // If no headline match, still show in feed as INFO if body mentions port
    // but DO NOT affect risk score
    let infoOnlyPorts = [];
    if (matchedPorts.length === 0) {
      PORTS.forEach(port => {
        for (const portKw of port.keywords) {
          if (rawDesc.includes(portKw.toLowerCase())) {
            infoOnlyPorts.push(port.id);
            break;
          }
        }
      });
    }

    const allMatchedPorts = matchedPorts.length > 0 ? matchedPorts : infoOnlyPorts;
    if (allMatchedPorts.length === 0) return;

    // STEP 2: Check for POSITIVE news — only apply if headline matched
    const isPositive = POSITIVE_KEYWORDS.some(kw => headline.includes(kw));
    if (isPositive && matchedPorts.length > 0) {
      matchedPorts.forEach(portId => {
        portRiskData[portId].score = Math.max(
          PORTS.find(p => p.id === portId)?.baseRisk || 0,
          portRiskData[portId].score - 0.3
        );
      });
      liveAlerts.push({
        title: item.title, source: item.source,
        level: "positive", tierLabel: "POSITIVE",
        ports: matchedPorts.slice(0,2).map(id => PORTS.find(p=>p.id===id)?.name).filter(Boolean),
        link: item.link || "#"
      });
      return;
    }

    // STEP 3: Match threat tier from headline first, then body
    let matchedTier = null;
    for (const tier of THREAT_TIERS) {
      if (tier.keywords.some(kw => headline.includes(kw))) {
        matchedTier = tier; break;
      }
    }
    // Body match only if headline had a port match too
    if (!matchedTier && matchedPorts.length > 0) {
      for (const tier of THREAT_TIERS) {
        if (tier.keywords.some(kw => rawDesc.includes(kw))) {
          matchedTier = tier; break;
        }
      }
    }

    // STEP 4: Apply ceiling-based scoring — ONLY for headline-matched ports
    if (matchedTier && matchedPorts.length > 0) {
      matchedPorts.forEach(portId => {
        const current = portRiskData[portId].score;
        const ceiling = matchedTier.ceiling;
        if (current < ceiling) {
          const gap = ceiling - current;
          portRiskData[portId].score = Math.min(ceiling, current + (gap * 0.4));
        }
        const reason = `[${matchedTier.label}] [${item.source}] ${item.title}`;
        if (!portRiskData[portId].reasons.find(r => r === reason)) {
          portRiskData[portId].reasons.push(reason);
        }
      });
    }

    // STEP 5: Add to alert feed — use all matched ports for display
    const portNames = allMatchedPorts.slice(0,3)
      .map(id => PORTS.find(p => p.id === id)?.name)
      .filter(Boolean);

    liveAlerts.push({
      title:     item.title,
      source:    item.source,
      level:     matchedTier && matchedPorts.length > 0 ? matchedTier.level : "info",
      tierLabel: matchedTier && matchedPorts.length > 0 ? matchedTier.label : "INFO",
      ports:     portNames,
      link:      item.link || "#"
    });
  });

  // Round all scores
  Object.keys(portRiskData).forEach(id => {
    portRiskData[id].score = Math.round(portRiskData[id].score * 10) / 10;
  });

  // Sort: critical → severe → high → elevated → watch → info → positive
  const levelOrder = { critical:0, severe:1, high:2, elevated:3, watch:4, info:5, positive:6 };
  liveAlerts.sort((a,b) => (levelOrder[a.level]??5) - (levelOrder[b.level]??5));

  const threatCount = liveAlerts.filter(a => !["info","positive"].includes(a.level)).length;
  updateFeedStatus(`LIVE — ${liveAlerts.length} ARTICLES · ${threatCount} THREATS`, true);
  renderAlertFeed();
  renderPortList();
  updateMapMarkers();
  updateHeaderStats();

  console.log(`Feed analysis complete: ${liveAlerts.length} articles, ${threatCount} threats`);
}

// Fallback demo alerts when RSS fails (CORS issues etc)
function getDemoAlerts() {
  return [
    { title: "Houthi forces launch drone attack on Red Sea shipping lane near Bab el-Mandeb", description: "houthi attack drone red sea yemen aden gulf shipping", source: "Reuters World", pubDate: new Date().toISOString(), link: "#" },
    { title: "Russia sanctions expand, Black Sea ports face new trade restrictions", description: "russia ukraine black sea war conflict odessa shipping sanctions", source: "BBC News", pubDate: new Date().toISOString(), link: "#" },
    { title: "Iran threatens to close Strait of Hormuz amid escalating tensions", description: "iran hormuz strait persian gulf sanctions nuclear bandar abbas threat", source: "Reuters World", pubDate: new Date().toISOString(), link: "#" },
    { title: "Gaza conflict: Israeli naval operations expand in eastern Mediterranean", description: "israel haifa gaza conflict war military strike naval mediterranean", source: "Al Jazeera", pubDate: new Date().toISOString(), link: "#" },
    { title: "Nigeria Gulf of Guinea piracy incidents surge in Q4", description: "nigeria piracy gulf of guinea west africa attack vessel seized lagos", source: "Reuters Business", pubDate: new Date().toISOString(), link: "#" },
    { title: "Tropical storm warning issued for South China Sea ports", description: "storm typhoon south china sea singapore hong kong guangzhou disruption", source: "BBC News", pubDate: new Date().toISOString(), link: "#" },
    { title: "Taiwan Strait military exercises cause shipping delays", description: "taiwan strait china military tension hong kong shipping delay", source: "Reuters World", pubDate: new Date().toISOString(), link: "#" },
    { title: "Suez Canal traffic disrupted as regional tensions mount", description: "suez canal egypt port said red sea houthi disruption delay", source: "Reuters Business", pubDate: new Date().toISOString(), link: "#" },
    { title: "Somali piracy threat resurfaces near Horn of Africa", description: "somalia piracy indian ocean mombasa east africa threat vessel", source: "BBC News", pubDate: new Date().toISOString(), link: "#" },
    { title: "North Korea missile test heightens tensions on Korean Peninsula", description: "north korea missile dprk south korea busan tension military", source: "Reuters World", pubDate: new Date().toISOString(), link: "#" }
  ];
}

function updateFeedStatus(msg, success) {
  const el = document.getElementById("feedStatus");
  if (success) {
    const now = new Date();
    const t = now.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    el.textContent = msg + " · UPDATED " + t;
  } else {
    el.textContent = msg;
  }
  const dot = document.getElementById("feedDot");
  dot.className = "pulse-dot" + (success ? "" : " error");
}
