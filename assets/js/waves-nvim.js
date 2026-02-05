(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const FILE_ROOT = "~/schoolportfolio/";
  const SEARCH_FILES = ["about.md", "projects.yml", "notes.md"];

  const els = {
    body: document.body,
    paneLeft: $("#paneLeft"),
    paneCenter: $("#paneCenter"),
    fileTree: $("#fileTree"),
    dotfiles: $("#dotfiles"),
    toggleHidden: $("#toggleHidden"),
    tabs: $$(".tab"),
    modePill: $("#modePill"),
    bufferPath: $("#bufferPath"),
    bufferType: $("#bufferType"),
    bufferHint: $("#bufferHint"),
    banner: $("#banner"),
    lineNos: $("#lineNos"),
    codeView: $("#codeView"),
    codeGrid: $("#codeGrid"),
    insertArea: $("#insertArea"),
    overlay: $("#overlay"),
    overlayTitle: $("#overlayTitle"),
    overlayMeta: $("#overlayMeta"),
    overlayBody: $("#overlayBody"),
    toast: $("#toast"),
    searchBar: $("#searchBar"),
    searchInput: $("#searchInput"),
    searchMeta: $("#searchMeta"),
    searchResults: $("#searchResults"),
    cmdBar: $("#cmdBar"),
    cmdInput: $("#cmdInput"),
    cmdMeta: $("#cmdMeta"),
    sideMode: $("#sideMode"),
    sidePane: $("#sidePane"),
    modeHint: $("#modeHint"),
    nowTime: $("#nowTime"),
    statusSound: $("#statusSound"),
    statusHidden: $("#statusHidden"),
    statusSearch: $("#statusSearch"),
    statusMode: $("#statusMode"),
    statusPath: $("#statusPath"),
    statusPos: $("#statusPos"),
    hudCpu: $("#hudCpu"),
    hudRam: $("#hudRam"),
    hudWifi: $("#hudWifi"),
    hudUptime: $("#hudUptime"),
    hudKernel: $("#hudKernel"),
    hudArch: $("#hudArch"),
  };

  if (!els.paneLeft || !els.paneCenter) return;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function makePerlin1D(seed) {
    const grads = new Map();
    function rand(i) {
      let x = (i ^ seed) >>> 0;
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17; x >>>= 0;
      x ^= x << 5; x >>>= 0;
      return (x / 0xFFFFFFFF);
    }
    function grad(i) {
      if (grads.has(i)) return grads.get(i);
      const g = rand(i) * 2 - 1;
      grads.set(i, g);
      return g;
    }
    return (x) => {
      const x0 = Math.floor(x);
      const x1 = x0 + 1;
      const t = x - x0;
      const g0 = grad(x0);
      const g1 = grad(x1);
      const d0 = g0 * t;
      const d1 = g1 * (t - 1);
      return lerp(d0, d1, fade(t));
    };
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>\"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]
    ));
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  const sound = (() => {
    let enabled = true;
    let ctx = null;
    function ensure() {
      if (!enabled) return null;
      if (ctx) return ctx;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
      } catch {
        return null;
      }
    }
    function ping({ freq = 240, dur = 0.03, gain = 0.02, type = "sine" }) {
      const ac = ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(now);
      o.stop(now + dur + 0.02);
    }
    return {
      get enabled() { return enabled; },
      setEnabled(v) { enabled = !!v; renderStatus(); },
      fileOpen() { ping({ freq: 360, dur: 0.02, gain: 0.018, type: "triangle" }); },
      mode() { ping({ freq: 210, dur: 0.018, gain: 0.014, type: "sine" }); },
      error() { ping({ freq: 110, dur: 0.06, gain: 0.02, type: "sawtooth" }); },
    };
  })();

  const fileDB = new Map();
  const state = {
    mode: "NORMAL",
    focus: "center", // left | center
    showHidden: false,
    explorerIndex: 0,
    activeFile: "about.md",
    cursorLine: 1,
    visualAnchor: null,
    overlayOpen: false,
    searchOpen: false,
    cmdOpen: false,
    searchQuery: "",
    searchHits: [],
  };

  function setMode(mode) {
    state.mode = mode;
    els.modePill.textContent = mode;
    els.statusMode.textContent = mode;
    if (els.sideMode) els.sideMode.textContent = mode;

    els.body.classList.toggle("mode-normal", mode === "NORMAL");
    els.body.classList.toggle("mode-insert", mode === "INSERT");
    els.body.classList.toggle("mode-visual", mode === "VISUAL");
    els.body.classList.toggle("mode-command", mode === "COMMAND");

    if (els.modeHint) {
      if (mode === "NORMAL") els.modeHint.textContent = "j/k move · Enter open · : commands · / search";
      if (mode === "INSERT") els.modeHint.textContent = "Esc to return · edit notes.md in-memory";
      if (mode === "VISUAL") els.modeHint.textContent = "j/k extend selection · Esc to cancel";
      if (mode === "COMMAND") els.modeHint.textContent = "predefined commands only · Enter to run";
    }
  }

  function setFocus(where) {
    state.focus = where;
    els.paneLeft.classList.toggle("is-focused", where === "left");
    els.paneCenter.classList.toggle("is-focused", where === "center");
    if (els.paneRight) {
      els.paneRight.classList.toggle("is-focused", where === "right");
    }
    if (els.sidePane) {
      els.sidePane.textContent = where === "left" ? "explorer" : where === "right" ? "system" : "editor";
    }
    renderExplorerSelection();
  }

  function renderStatus() {
    if (els.statusSound) els.statusSound.textContent = sound.enabled ? "on" : "off";
    if (els.statusHidden) els.statusHidden.textContent = state.showHidden ? "on" : "off";
    if (els.statusSearch) els.statusSearch.textContent = state.searchOpen && state.searchQuery ? `"${state.searchQuery}"` : "idle";
  }

  function fileType(name) {
    const f = fileDB.get(name);
    if (!f) return "txt";
    if (name.endsWith(".md")) return "markdown";
    if (name.endsWith(".yml") || name.endsWith(".yaml")) return "yaml";
    if (name.endsWith(".json")) return "json";
    if (name === ".env") return "env";
    return f.type || "txt";
  }

  function currentFile() { return fileDB.get(state.activeFile); }

  function setBanner(html) {
    if (!html) {
      els.banner.hidden = true;
      els.banner.innerHTML = "";
      return;
    }
    els.banner.innerHTML = html;
    els.banner.hidden = false;
  }

  function getExplorerItems() {
    const base = $$(".tree li", els.fileTree);
    const hidden = state.showHidden ? $$(".tree li", els.dotfiles) : [];
    return base.concat(hidden);
  }

  function renderExplorerSelection() {
    const items = getExplorerItems();
    items.forEach((li, idx) => li.classList.toggle("selected", state.focus === "left" && idx === state.explorerIndex));
  }

  function highlightFind(s, query) {
    const safe = escapeHtml(s);
    if (!query) return safe;
    if (!SEARCH_FILES.includes(state.activeFile)) return safe;
    const q = query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    const re = new RegExp(q, "gi");
    return safe.replace(re, (m) => `<mark class="find">${m}</mark>`);
  }

  function tokeniseLine(type, line, query) {
    let html = highlightFind(line, query);
    if (type === "markdown") {
      html = html
        .replace(/^(#{1,6})\\s+(.+)$/g, (_, h, t) => `<span class="tok-h">${escapeHtml(h)} ${t}</span>`)
        .replace(/`([^`]+)`/g, (_, c) => `<span class="tok-k">\\\`${escapeHtml(c)}\\\`</span>`)
        .replace(/^\\s*[-*+]\\s+/g, (m) => `<span class="tok-k">${escapeHtml(m)}</span>`);
    } else if (type === "yaml" || type === "env") {
      html = html
        .replace(/^(\\s*)([A-Za-z0-9_\\-]+)(\\s*:)/g, (_, s, k, c) => `${s}<span class="tok-k">${escapeHtml(k)}</span>${c}`)
        .replace(/^(\\s*)([A-Za-z0-9_\\-]+)(=)/g, (_, s, k, eq) => `${s}<span class="tok-k">${escapeHtml(k)}</span>${eq}`)
        .replace(/"([^"]*)"/g, (_, s) => `"${`<span class="tok-s">${escapeHtml(s)}</span>`}"`);
    } else if (type === "json") {
      html = html
        .replace(/"([^"\\n]+)"(?=\\s*:)/g, (_, k) => `"${`<span class="tok-k">${escapeHtml(k)}</span>`}"`)
        .replace(/:\\s*"([^"\\n]*)"/g, (_, v) => `: "${`<span class="tok-s">${escapeHtml(v)}</span>`}"`)
        .replace(/:\\s*(\\d+(?:\\.\\d+)?)/g, (_, n) => `: <span class="tok-n">${n}</span>`);
    }
    return html;
  }

  function renderCode() {
    const f = currentFile();
    const type = fileType(state.activeFile);
    if (!f) return;

    els.codeView.classList.remove("blurred", "deniedview");
    els.lineNos.style.display = "";

    if (f.denied) {
      setBanner("");
      els.lineNos.style.display = "none";
      els.codeView.classList.add("deniedview");
      els.codeView.innerHTML = [
        "<div class=\"denied\">",
        "<div>",
        "<h2>ACCESS DENIED</h2>",
        "<p>That file is protected. Try something less cursed.</p>",
        "</div>",
        "</div>",
      ].join("");
      els.statusPos.textContent = "Ln 1, Col 1";
      return;
    }

    if (state.activeFile === ".env") {
      setBanner("<strong>Warning:</strong> <code>.env</code> is sensitive. Content is intentionally blurred.");
      els.codeView.classList.add("blurred");
    } else {
      setBanner("");
    }

    const query = state.searchOpen ? state.searchQuery : "";
    const rawLines = (f.content || "").replace(/\\r\\n/g, "\\n").split("\\n");
    const total = Math.max(1, rawLines.length);
    state.cursorLine = clamp(state.cursorLine, 1, total);

    const a = state.mode === "VISUAL" && state.visualAnchor ? state.visualAnchor : null;
    const startSel = a ? Math.min(a, state.cursorLine) : null;
    const endSel = a ? Math.max(a, state.cursorLine) : null;

    els.lineNos.textContent = rawLines.map((_, i) => String(i + 1)).join("\\n");
    els.codeView.innerHTML = rawLines.map((ln, idx) => {
      const n = idx + 1;
      const cls = ["line"];
      if (state.focus === "center" && n === state.cursorLine) cls.push("cursor");
      if (startSel && endSel && n >= startSel && n <= endSel) cls.push("sel");
      return `<span class="${cls.join(" ")}">${tokeniseLine(type, ln, query)}</span>`;
    }).join("\\n");

    els.statusPos.textContent = `Ln ${state.cursorLine}, Col 1`;
  }

  function setActiveFile(name, { cursorLine = 1 } = {}) {
    if (!fileDB.has(name)) return;
    state.activeFile = name;
    state.cursorLine = cursorLine;
    state.visualAnchor = null;

    const f = currentFile();
    els.bufferPath.textContent = `${FILE_ROOT}${name}`;
    els.bufferType.textContent = fileType(name);
    els.bufferHint.textContent = f.readonly ? "readonly" : "modifiable";
    els.statusPath.textContent = `${FILE_ROOT}${name}`;
    flash(els.bufferPath);

    els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.file === name));
    $$(".tree li", els.fileTree).forEach((li) => li.classList.toggle("active", li.dataset.file === name));
    $$(".tree li", els.dotfiles).forEach((li) => li.classList.toggle("active", li.dataset.file === name));

    if (els.codeGrid) {
      els.codeGrid.classList.add("switching");
      window.setTimeout(() => els.codeGrid.classList.remove("switching"), 160);
    }
    renderCode();
    sound.fileOpen();
  }

  function openOverlay({ title, html, meta = "Esc to close" }) {
    els.overlayTitle.textContent = title;
    els.overlayMeta.textContent = meta;
    els.overlayBody.innerHTML = html;
    els.overlay.hidden = false;
    state.overlayOpen = true;
  }

  function closeOverlay() {
    els.overlay.hidden = true;
    state.overlayOpen = false;
  }

  function showToast(html, tone = "warn", ms = 1600) {
    els.toast.innerHTML = html;
    els.toast.style.borderLeftColor =
      tone === "bad" ? "rgba(247,118,142,.9)" :
      tone === "good" ? "rgba(95,215,167,.9)" :
      "rgba(224,175,104,.9)";
    els.toast.classList.add("on");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => els.toast.classList.remove("on"), ms);
  }

  function openSearch() {
    state.searchOpen = true;
    state.searchQuery = "";
    state.searchHits = [];
    els.searchInput.value = "";
    els.searchBar.hidden = false;
    els.searchResults.hidden = false;
    els.searchInput.focus();
    updateSearch();
    renderStatus();
  }

  function closeSearch() {
    state.searchOpen = false;
    state.searchQuery = "";
    state.searchHits = [];
    els.searchBar.hidden = true;
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    renderCode();
    renderStatus();
  }

  function updateSearch() {
    const q = (els.searchInput.value || "").trim();
    state.searchQuery = q;
    const hits = [];
    if (q) {
      const needle = q.toLowerCase();
      for (const file of SEARCH_FILES) {
        const f = fileDB.get(file);
        if (!f) continue;
        f.content.split("\\n").forEach((line, idx) => {
          if (line.toLowerCase().includes(needle)) {
            hits.push({ file, line: idx + 1, preview: line.trim().slice(0, 96) });
          }
        });
      }
    }
    state.searchHits = hits;
    els.searchMeta.textContent = `${hits.length} hits`;
    els.searchResults.innerHTML = hits.slice(0, 40).map((h) => (
      `<div class="item" data-file="${escapeHtml(h.file)}" data-line="${h.line}">
        <div><strong>${escapeHtml(h.preview || "(blank line)")}</strong></div>
        <div class="where">${escapeHtml(h.file)}:${h.line}</div>
      </div>`
    )).join("") || `<div class="item" style="cursor:default;color:var(--muted);">no matches</div>`;

    $$(".item", els.searchResults).forEach((item) => {
      item.addEventListener("click", () => {
        const f = item.dataset.file;
        const ln = Number(item.dataset.line || "1");
        closeSearch();
        setActiveFile(f, { cursorLine: ln });
        setFocus("center");
      });
    });

    renderCode();
    renderStatus();
  }

  function openCommand() {
    state.cmdOpen = true;
    setMode("COMMAND");
    els.cmdInput.value = "";
    els.cmdBar.hidden = false;
    els.cmdInput.focus();
  }

  function closeCommand() {
    state.cmdOpen = false;
    els.cmdBar.hidden = true;
    els.cmdInput.blur();
    setMode("NORMAL");
  }

  function cmdNotFound() {
    sound.error();
    showToast("<strong>E492:</strong> Not an editor command", "bad", 2200);
  }

  function renderHelp() {
    return `<pre>${escapeHtml(
`modes:
  NORMAL  navigation
  INSERT  edit notes.md (in-memory)
  VISUAL  line selection with j/k
  COMMAND : open command bar

keys:
  j/k     move file list or cursor
  h/l     switch panes
  Enter   open file (explorer)
  /       global search (about.md, projects.yml, notes.md)
  :       command mode
  Esc     exit overlays / modes

commands:
  :help
  :whoami
  :projects
  :clear
  :set sound off
  :blame about.md`)}</pre>`;
  }

  function renderWhoami() {
    return `<pre>${escapeHtml(
`samyog

geospatial ml / remote sensing

biases:
- correctness beats cleverness
- measurement beats vibes
- write it down so future-you can rerun it`)}</pre>`;
  }

  function renderProjects() {
    const projects = [
      {
        id: "landfill_suitability",
        metrics: ["agreement@top20%: 0.81", "runtime: 2m14s (cached)"],
        failed: "Weights looked “reasonable” but collapsed on slope extremes; fixed via sensitivity sweeps + monotonic constraints.",
        log: [
          "> loading rasters...",
          "> applying AHP weights...",
          "> constraints: slope, protected_areas, distance_to_roads",
          "> agreement@top20%: 0.81",
          "> done",
        ],
        svg: `<svg viewBox="0 0 340 120" width="340" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="340" height="120" rx="12" fill="#0b1016" stroke="#1a2430"/>
  <g opacity=".95">
    <rect x="18" y="18" width="92" height="84" rx="10" fill="#111a24" stroke="#1a2430"/>
    <rect x="126" y="18" width="92" height="84" rx="10" fill="#111a24" stroke="#1a2430"/>
    <rect x="234" y="18" width="92" height="84" rx="10" fill="#111a24" stroke="#1a2430"/>
    <path d="M28 84 C44 64, 70 78, 100 46" stroke="#7aa2f7" stroke-width="3" fill="none" opacity=".9"/>
    <path d="M136 86 C154 62, 176 74, 210 40" stroke="#9ece6a" stroke-width="3" fill="none" opacity=".9"/>
    <path d="M244 82 C270 66, 292 74, 316 44" stroke="#e0af68" stroke-width="3" fill="none" opacity=".9"/>
  </g>
  <text x="18" y="114" font-family="monospace" font-size="11" fill="#93a4b7">raster stack → weighted score</text>
</svg>`,
      },
      {
        id: "flood_extent_unet",
        metrics: ["IoU: 0.74", "ECE: 0.06"],
        failed: "Overfit cloud-edge artifacts; fixed with cloud masks + hard-negative mining.",
        log: [
          "> loading tiles...",
          "> training UNet...",
          "> IoU: 0.74",
          "> ECE: 0.06",
          "> done",
        ],
        svg: `<svg viewBox="0 0 340 120" width="340" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="340" height="120" rx="12" fill="#0b1016" stroke="#1a2430"/>
  <rect x="18" y="18" width="304" height="84" rx="10" fill="#111a24" stroke="#1a2430"/>
  <path d="M18 76 C60 56, 86 86, 130 68 C176 48, 196 92, 238 74 C274 58, 292 64, 322 52" stroke="#7aa2f7" stroke-width="3" fill="none" opacity=".95"/>
  <path d="M40 82 C68 62, 92 84, 120 72" stroke="#9ece6a" stroke-width="5" fill="none" opacity=".75"/>
  <text x="18" y="114" font-family="monospace" font-size="11" fill="#93a4b7">probability field → mask</text>
</svg>`,
      },
      {
        id: "road_change_detection",
        metrics: ["F1: 0.88", "false-positive km/100km²: 1.9"],
        failed: "Seasonal shadows triggered spurious change; solved via temporal median composites + illumination normalization.",
        log: [
          "> tiling time-series...",
          "> running change model...",
          "> F1: 0.88",
          "> false-positive km/100km²: 1.9",
          "> done",
        ],
        svg: `<svg viewBox="0 0 340 120" width="340" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect width="340" height="120" rx="12" fill="#0b1016" stroke="#1a2430"/>
  <rect x="18" y="18" width="304" height="84" rx="10" fill="#111a24" stroke="#1a2430"/>
  <path d="M36 30 L304 96" stroke="#93a4b7" stroke-width="2" opacity=".5"/>
  <path d="M56 92 L292 28" stroke="#93a4b7" stroke-width="2" opacity=".5"/>
  <path d="M44 62 L310 62" stroke="#7aa2f7" stroke-width="4" opacity=".85"/>
  <circle cx="120" cy="62" r="7" fill="#e0af68" opacity=".9"/>
  <circle cx="232" cy="62" r="7" fill="#9ece6a" opacity=".9"/>
  <text x="18" y="114" font-family="monospace" font-size="11" fill="#93a4b7">t₀/t₁ → change mask</text>
</svg>`,
      },
    ];

    const blocks = projects.map((p) => {
      const log = `$ run ${p.id}\n${p.log.join("\n")}`;
      const metrics = p.metrics.map((m) => `- ${m}`).join("\n");
      return `
        <div style="display:grid;gap:10px;margin-bottom:14px;">
          <pre>${escapeHtml(log)}</pre>
          <div>${p.svg}</div>
          <pre>${escapeHtml(metrics)}</pre>
          <div class="subtle" style="color:var(--muted);">what failed: ${escapeHtml(p.failed)}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="subtle" style="color:var(--muted);margin-bottom:10px;">Executable-style logs (predefined). No arbitrary execution.</div>
      ${blocks}
    `;
  }

  function renderBlame() {
    const about = fileDB.get("about.md")?.content || "";
    const lines = about.split("\\n");
    const now = new Date();
    function hex(n) { return n.toString(16).padStart(2, "0"); }
    function hash(i) {
      const a = (i * 73 + 41) % 255;
      const b = (i * 19 + 203) % 255;
      const c = (i * 151 + 11) % 255;
      return `${hex(a)}${hex(b)}${hex(c)}${hex((a ^ b ^ c) & 255)}${hex((a + b) & 255)}${hex((b + c) & 255)}`.slice(0, 7);
    }
    const rows = lines.map((ln, i) => {
      const d = new Date(now.getTime() - (i * 86400000 * 11));
      const ds = d.toISOString().slice(0, 10);
      const left = `${hash(i)}  ${ds}  samyog`;
      return `${left.padEnd(28, " ")} | ${ln}`;
    }).join("\\n");
    return `<div class="subtle" style="color:var(--muted);margin-bottom:10px;">Simulated blame (client-side). Not executing git.</div><pre>${escapeHtml(rows)}</pre>`;
  }

  function runCommand(raw) {
    const cmd = (raw || "").trim();
    if (!cmd) { closeCommand(); return; }
    const c = cmd.startsWith(":") ? cmd : `:${cmd}`;

    if (c === ":help") { closeCommand(); openOverlay({ title: "help", html: renderHelp() }); return; }
    if (c === ":whoami") { closeCommand(); openOverlay({ title: "whoami", html: renderWhoami() }); return; }
    if (c === ":projects") { closeCommand(); openOverlay({ title: "projects", html: renderProjects(), meta: "Esc to close · open projects.yml for raw" }); return; }
    if (c === ":clear") { closeCommand(); closeOverlay(); closeSearch(); showToast("<strong>cleared</strong>", "good"); return; }
    if (c === ":set sound off") { closeCommand(); sound.setEnabled(false); showToast("<strong>sound:</strong> off", "good"); return; }
    if (c === ":set sound on") { closeCommand(); sound.setEnabled(true); showToast("<strong>sound:</strong> on", "good"); return; }
    if (c === ":blame about.md") { closeCommand(); openOverlay({ title: "blame about.md", html: renderBlame() }); return; }

    closeCommand();
    cmdNotFound();
  }

  function enterInsert() {
    const f = currentFile();
    if (!f || f.readonly) {
      sound.error();
      showToast("<strong>E21:</strong> Cannot make changes, 'modifiable' is off", "bad", 2400);
      return;
    }
    if (state.activeFile !== "notes.md") {
      sound.error();
      showToast("<strong>E21:</strong> notes.md only (for now)", "bad", 2200);
      return;
    }
    els.insertArea.value = f.content;
    els.insertArea.hidden = false;
    els.insertArea.focus();
    setMode("INSERT");
    sound.mode();
  }

  function exitInsert() {
    const f = currentFile();
    if (!f || f.readonly) return;
    if (state.activeFile === "notes.md") f.content = els.insertArea.value;
    els.insertArea.hidden = true;
    setMode("NORMAL");
    renderCode();
  }

  function enterVisual() {
    if (state.mode !== "NORMAL") return;
    state.visualAnchor = state.cursorLine;
    setMode("VISUAL");
    sound.mode();
    renderCode();
  }

  function exitVisual() {
    state.visualAnchor = null;
    setMode("NORMAL");
    renderCode();
  }

  function moveCursor(delta) {
    const f = currentFile();
    if (!f || f.denied) return;
    const lines = (f.content || "").split("\\n");
    state.cursorLine = clamp(state.cursorLine + delta, 1, Math.max(1, lines.length));
    renderCode();
  }

  function setExplorerIndex(idx) {
    const items = getExplorerItems();
    if (!items.length) return;
    state.explorerIndex = (idx + items.length) % items.length;
    renderExplorerSelection();
    items[state.explorerIndex]?.scrollIntoView({ block: "nearest" });
  }

  function openSelectedExplorer() {
    const items = getExplorerItems();
    const li = items[state.explorerIndex];
    if (!li) return;
    const f = li.dataset.file;
    if (f) setActiveFile(f);
  }

  function toggleHidden() {
    state.showHidden = !state.showHidden;
    els.dotfiles.hidden = !state.showHidden;
    renderExplorerSelection();
    renderStatus();
  }

  function handleKeydown(e) {
    const activeEl = document.activeElement;

    if (state.overlayOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeOverlay(); }
      return;
    }

    if (activeEl === els.searchInput) {
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
      return;
    }

    if (activeEl === els.cmdInput) {
      if (e.key === "Escape") { e.preventDefault(); closeCommand(); }
      if (e.key === "Enter") { e.preventDefault(); runCommand(els.cmdInput.value); }
      return;
    }

    if (activeEl === els.insertArea) {
      if (e.key === "Escape") { e.preventDefault(); exitInsert(); }
      return;
    }

    if (e.key === "Escape") {
      if (state.searchOpen) { e.preventDefault(); closeSearch(); return; }
      if (state.cmdOpen) { e.preventDefault(); closeCommand(); return; }
      if (state.mode === "VISUAL") { e.preventDefault(); exitVisual(); sound.mode(); return; }
      if (state.mode === "INSERT") { e.preventDefault(); exitInsert(); sound.mode(); return; }
      return;
    }

    if (e.key === "h" && state.mode !== "INSERT") {
      e.preventDefault();
      if (state.focus === "center") setFocus("left");
      return;
    }

    if (e.key === "l" && state.mode !== "INSERT") {
      e.preventDefault();
      if (state.focus === "left") setFocus("center");
      return;
    }

    if (e.key === "/" && state.mode !== "INSERT") { e.preventDefault(); openSearch(); return; }
    if (e.key === ":" && state.mode !== "INSERT") { e.preventDefault(); openCommand(); sound.mode(); return; }
    if (e.key === "H" && state.mode !== "INSERT") { e.preventDefault(); toggleHidden(); return; }

    if (e.key === "j" && state.mode !== "INSERT") {
      e.preventDefault();
      if (state.focus === "left") setExplorerIndex(state.explorerIndex + 1);
      if (state.focus === "center") moveCursor(1);
      return;
    }

    if (e.key === "k" && state.mode !== "INSERT") {
      e.preventDefault();
      if (state.focus === "left") setExplorerIndex(state.explorerIndex - 1);
      if (state.focus === "center") moveCursor(-1);
      return;
    }

    if (e.key === "Enter" && state.mode !== "INSERT") {
      if (state.focus === "left") { e.preventDefault(); openSelectedExplorer(); }
      return;
    }

    if (e.key === "i" && state.mode === "NORMAL" && state.focus === "center") { e.preventDefault(); enterInsert(); return; }
    if (e.key === "v" && state.mode === "NORMAL" && state.focus === "center") { e.preventDefault(); enterVisual(); return; }
  }

  function renderTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    if (els.nowTime) els.nowTime.textContent = `${hh}:${mm}`;
  }

  function startHud() {
    const cpuNoise = makePerlin1D(1337);
    const ramNoise = makePerlin1D(4242);
    const t0 = performance.now();
    const baseUptimeSec = 2 * 3600 + 41 * 60;
    let cpuVal = 14;
    let ramVal = 46;
    if (els.hudWifi) els.hudWifi.textContent = "ok";
    if (els.hudKernel) els.hudKernel.textContent = "6.7.4";
    if (els.hudArch) els.hudArch.textContent = "x86_64";

    function tick() {
      const t = (performance.now() - t0) / 1000;
      const cpuTarget = clamp(14 + cpuNoise(t * 0.08) * 10, 6, 32);
      const ramTarget = clamp(46 + ramNoise(t * 0.05) * 12, 32, 68);
      cpuVal = lerp(cpuVal, cpuTarget, 0.18);
      ramVal = lerp(ramVal, ramTarget, 0.14);
      els.hudCpu.textContent = `${Math.round(cpuVal)}%`;
      els.hudRam.textContent = `${Math.round(ramVal)}%`;
      if (els.hudUptime) {
        const u = baseUptimeSec + Math.floor(t);
        const h = Math.floor(u / 3600);
        const m = Math.floor((u % 3600) / 60);
        els.hudUptime.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }

    tick();
    window.setInterval(tick, 420);
  }

  function initFileDB() {
    const set = (name, type, readonly, content, extra = {}) => {
      fileDB.set(name, { type, readonly, content, ...extra });
    };

    set("about.md", "markdown", true, `# about

I design geospatial ML systems that turn messy rasters into decisions you can defend.

I care about:
- reproducibility over demos
- evaluation over hype
- maps that survive peer review and skeptical stakeholders

Work I trust:
- versioned datasets with documented assumptions and checksums
- training + inference pipelines that can be re-run months later
- failure analysis that includes space/time slices (not just a single score)

I’m skeptical of:
- “AI” claims that can’t be audited
- pretty maps that collapse under uncertainty
- results that disappear when a CRS or resampling kernel changes

If a model can’t explain where and why it fails, I treat it as unfinished.`);
    set("focus.md", "markdown", true, `# focus

## Remote sensing → decisions
I like problems where pixels become budgets, field work, or policy.

## Systems > notebooks
Notebooks are for exploration. Production is for:
- dataset lineage
- deterministic preprocessing
- stable evaluation
- measurable performance

## Practical research
I’m happiest when the output can be defended with a method section and a test suite.`);
    set("skills.yml", "yaml", true, `languages:
  - Python: [numpy, pandas, geopandas, rasterio, torch]
  - SQL: [PostGIS, query planning, indexing]
  - TypeScript: [UI, tooling]
geospatial:
  - GDAL: [warp, translate, vrt, tiling]
  - CRS: [reprojection pitfalls, area/angle correctness]
ml:
  - segmentation: [UNet, loss functions, calibration]
  - evaluation: [IoU, PR curves, spatial cross-val]
systems:
  - linux: [profiling, processes, reproducible envs]
  - data: [chunking, caching, checksums]
  - ci: [tests, lint, artifact builds]`);
    set("projects.yml", "yaml", true, `projects:
  - id: landfill_suitability
    title: Landfill suitability (raster AHP + constraints)
    metrics:
      - "agreement@top20%: 0.81"
      - "runtime: 2m14s (cached)"
    what_failed: "Initial weights looked 'reasonable' but collapsed on slope extremes; fixed by sensitivity sweeps + monotonic constraints."

  - id: flood_extent_unet
    title: Flood extent segmentation (UNet)
    metrics:
      - "IoU: 0.74"
      - "ECE: 0.06"
    what_failed: "Model overfit cloud edge artifacts; fixed with cloud masks + hard-negative mining."

  - id: road_change_detection
    title: Road change detection (time-series tiles)
    metrics:
      - "F1: 0.88"
      - "false-positive km/100km²: 1.9"
    what_failed: "Seasonal shadows triggered spurious change; solved via temporal median composites + illumination normalization."`);
    set("education.json", "json", true, `{
  "school": "California State University, Fresno",
  "program": "B.S. (in progress)",
  "concentration": "GIS / Data Science",
  "coursework": [
    "Remote Sensing",
    "Spatial Analysis",
    "Machine Learning",
    "Databases"
  ]
}`);
    set("contact.txt", "txt", true, `email: gcsamyog77@gmail.com
github: github.com/hawkeyyyy
location: Fresno, CA

preferred:
- concise problem statement
- dataset + evaluation details
- timelines that respect reality`);
    set("notes.md", "markdown", false, `# notes

- Spatial cross-val ≠ random split. If tiles touch, leakage is guaranteed.
- IoU can look fine while borders are unusable; track boundary F-score if edges matter.
- Cloud masks reduce noise, but they also remove signal (flood vs shadow).
- “More data” isn’t free; mislabeled tiles can dominate loss if you don’t audit slices.

failures:
- Fancy augmentations didn’t matter; CRS + nodata bugs did.
- A “great” model collapsed when inference used a different resampling kernel than training.

todo:
- calibration plots for every segmentation run
- raster checksum manifest before training`);
    set(".env", "env", true, `MAPBOX_TOKEN=pk_live_********************************
POSTGIS_URL=postgres://user:********@localhost:5432/gis
S3_BUCKET=s3://tiles-prod
AWS_SECRET_ACCESS_KEY=********************************
MODEL_REGISTRY=/mnt/models/registry`, { sensitive: true });
    set(".bash_history", "txt", true, `rg "nodata" -n src/
gdalinfo -stats data/raw/scene_2023_09.tif
gdalwarp -t_srs EPSG:3857 -r bilinear in.tif out.tif
python -m pytest -q
python -m torch.utils.bottleneck train.py
ps aux | rg "python|node"
sudo pacman -Syu
sudo pacman -S coffee  # (it didn't help)
git commit -m "fix crs bug that made everything look correct (it wasn't)"`);
    set(".secrets", "txt", true, "", { denied: true });
  }

  function init() {
    initFileDB();
    els.dotfiles.hidden = true;

    setFocus("center");
    setMode("NORMAL");
    renderStatus();

    els.paneLeft.addEventListener("mousedown", () => setFocus("left"));
    els.paneCenter.addEventListener("mousedown", () => setFocus("center"));

    els.toggleHidden.addEventListener("click", toggleHidden);
    els.searchInput.addEventListener("input", updateSearch);

    els.overlay.addEventListener("mousedown", (ev) => {
      if (ev.target === els.overlay) closeOverlay();
    });

    $$(".tree li", els.fileTree).forEach((li, idx) => {
      li.addEventListener("click", () => {
        setFocus("left");
        state.explorerIndex = idx;
        setActiveFile(li.dataset.file);
        renderExplorerSelection();
      });
    });

    $$(".tree li", els.dotfiles).forEach((li) => {
      li.addEventListener("click", () => {
        setFocus("left");
        const items = getExplorerItems();
        state.explorerIndex = items.indexOf(li);
        setActiveFile(li.dataset.file);
        renderExplorerSelection();
      });
    });

    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setFocus("center");
        setActiveFile(tab.dataset.file);
      });
    });

    document.addEventListener("keydown", handleKeydown);

    renderTime();
    window.setInterval(renderTime, 20000);
    startHud();

    setActiveFile("about.md");
    setExplorerIndex(0);

    window.setTimeout(() => els.body.classList.remove("is-reveal"), 1300);
  }

  init();
})();
