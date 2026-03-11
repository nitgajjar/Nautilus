# 🧭 NAUTILUS — Maritime Risk Intelligence

**Nautilus** is a real-time geopolitical risk dashboard designed for the maritime industry. It aggregates live data from 17 global news feeds to provide instant threat scoring and situational awareness for 200 major global ports.

[**Live Demo**](https://nitgajjar.github.io/Nautilus/)



## ⚡ Core Features
- **Live Intelligence Pipeline:** Automatically scans and parses RSS feeds from sources like Reuters, BBC, gCaptain, and Maritime Executive.
- **Dynamic Risk Engine:** Calculates risk scores (0-10) by cross-referencing news headlines with port-specific keywords and geopolitical threat indicators.
- **Interactive Visualization:** Uses Leaflet.js to render a custom dark-themed world map with color-coded risk markers (Safe to Critical).
- **Tactical UI/UX:** A high-contrast "Command Center" aesthetic featuring CRT scanline effects, real-time clocks for global shipping hubs, and a mobile-responsive tab system.

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3 (Custom Grid & Flexbox)
- **Logic:** JavaScript (ES6+)
- **Mapping:** Leaflet.js
- **Data Integration:** RSS2JSON API
- **Fonts:** Orbitron, Rajdhani, Share Tech Mono

## 🧠 How the Risk Engine Works
Nautilus uses a weighted keyword-matching algorithm to determine port safety:
1. **Fetch:** The system pulls the latest headlines from 17 diversified maritime and world news feeds.
2. **Identify:** It scans headlines for 200+ specific port names (e.g., Shanghai, Rotterdam, Jebel Ali).
3. **Analyze:** It looks for risk-associated tokens like *blockade, missile, strike, piracy, or sanctions*.
4. **Score:** It calculates a final score that updates the UI in real-time, changing marker colors from **Safe (Green)** to **Critical (Red)**.

## 🚀 Installation
Since this is a client-side application, you can run it locally without a server:

https://nitgajjar.github.io/Nautilus/
