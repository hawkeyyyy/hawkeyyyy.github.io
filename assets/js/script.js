// Portfolio JS: intro overlay + tabs + parallax

/* ---------------- Intro ---------------- */
function prefersReducedMotion(){
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function bindScroll(handler, lenis){
  if (lenis){
    lenis.on("scroll", handler);
  } else {
    window.addEventListener("scroll", handler, { passive:true });
  }
}

function getHeaderOffset(){
  const header = document.querySelector(".topbar");
  const h = header ? header.offsetHeight : 0;
  return h + 10;
}

function initTheme(){
  const btns = Array.from(document.querySelectorAll(".theme-btn"));
  if (!btns.length) return;

  const root = document.documentElement;
  const saved = localStorage.getItem("theme");
  const initial = ["light","dark","colorful"].includes(saved) ? saved : "dark";
  root.setAttribute("data-theme", initial);

  function setActive(theme){
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    btns.forEach(b => {
      const isActive = b.dataset.theme === theme;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  setActive(initial);

  btns.forEach(btn=>{
    btn.addEventListener("click", ()=> setActive(btn.dataset.theme));
  });
}

let horizontalControllers = [];

function syncHorizontal(scrollY){
  horizontalControllers.forEach(ctrl => ctrl.translate(scrollY));
}

function initSmoothScroll(){
  if (prefersReducedMotion()) return null;
  if (typeof Lenis === "undefined") return null;

  const lenis = new Lenis({
    duration: 1.08,
    smoothWheel: true,
    smoothTouch: false,
    easing: (t)=> 1 - Math.pow(1 - t, 3)
  });

  function raf(time){
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  return lenis;
}

function initHorizontalScrolls(lenis){
  const wrappers = Array.from(document.querySelectorAll(".h-wrapper"));
  horizontalControllers = [];

  function createController(wrapper){
    const track = wrapper?.querySelector(".h-track");
    const panels = Array.from(track?.querySelectorAll(".panel") || []);
    if (!wrapper || !track || !panels.length) return null;

    function setDims(){
      wrapper.style.setProperty("--panel-count", String(panels.length));
      wrapper.style.height = `${panels.length * window.innerHeight}px`;
      track.style.width = `${panels.length * 100}vw`;
    }

    function range(){
      const start = wrapper.offsetTop;
      const end = start + wrapper.offsetHeight - window.innerHeight;
      return { start, end };
    }

    function translate(scrollY){
      const { start, end } = range();
      const dist = Math.max(end - start, 1);
      const rel = Math.min(Math.max(scrollY - start, 0), dist);
      const progress = rel / dist;
      const maxX = track.scrollWidth - window.innerWidth;
      const x = -progress * maxX;
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    function onScroll(e){
      const y = (typeof e === "number") ? e : (typeof e?.scroll === "number" ? e.scroll : window.scrollY || 0);
      translate(y);
    }

    setDims();
    bindScroll(onScroll, lenis);
    window.addEventListener("resize", ()=>{ setDims(); translate(window.scrollY || 0); });
    translate(window.scrollY || 0);

    function getTargetScroll(id){
      const idx = panels.findIndex(p => p.id === id);
      if (idx === -1) return null;
      const { start } = range();
      return start + (idx * window.innerHeight) - getHeaderOffset();
    }

    function progressFor(scrollY){
      const { start, end } = range();
      if (scrollY < start || scrollY > end) return null;
      const dist = Math.max(end - start, 1);
      const rel = Math.min(Math.max(scrollY - start, 0), dist);
      return rel / dist;
    }

    return { getTargetScroll, panels, range, translate, progressFor };
  }

  wrappers.forEach(wrapper=>{
    const ctrl = createController(wrapper);
    if (ctrl) horizontalControllers.push(ctrl);
  });

  function getTargetScroll(id){
    for(const ctrl of horizontalControllers){
      const res = ctrl.getTargetScroll(id);
      if (res !== null) return res;
    }
    return null;
  }

  return { getTargetScroll, translate: syncHorizontal };
}

function wireAnchors(lenis, getPanelScroll){
  document.querySelectorAll('a[href^="#"]').forEach(link=>{
    const target = link.getAttribute("href");
    if (!target || target === "#") return;
    link.addEventListener("click", (e)=>{
      e.preventDefault();
      const el = document.querySelector(target);
      const headerOffset = getHeaderOffset();

      const panelScroll = el && getPanelScroll ? getPanelScroll(el.id) : null;
      const targetVal = (panelScroll !== null)
        ? panelScroll
        : el
          ? (el.getBoundingClientRect().top + window.scrollY - headerOffset)
          : 0;

      if (lenis){
        syncHorizontal(targetVal);
        lenis.scrollTo(targetVal, { duration: 0.65, lock:true });
        return;
      }

      if (!prefersReducedMotion()){
        window.scrollTo({ top: targetVal, behavior:"smooth" });
      } else {
        window.scrollTo(0, targetVal);
      }
    });
  });
}

function setIntroWord(word){
  const el = document.getElementById("introWord");
  // clear
  el.innerHTML = "";
  const letters = Array.from(word);
  letters.forEach((ch, i) => {
    const s = document.createElement("span");
    s.className = "ch";
    s.style.animationDelay = `${i * 55}ms`;
    s.textContent = ch;
    el.appendChild(s);
  });
}

function initIntro(lenis){
  const intro = document.getElementById("intro");
  if (!intro) return;

  document.body.classList.add("intro-active");

  const words = ["HELLO", "NAMASTE", "こんにちは"];
  let idx = 0;
  let stopped = false;

  function hide(){
    if (stopped) return;
    stopped = true;
    document.body.classList.remove("intro-active");
    intro.classList.add("is-hidden");
    const removeDelay = prefersReducedMotion() ? 320 : 2200;
    setTimeout(()=> intro.remove(), removeDelay);
  }

  if (prefersReducedMotion()){
    setIntroWord(words[0]);
    setTimeout(hide, 450);
    return;
  }

  function play(){
    if (stopped) return;
    setIntroWord(words[idx]);
    // pace: type + hold
    const hold = 950;
    const typeTime = Math.min(700, words[idx].length * 60 + 200);
    setTimeout(() => {
      idx += 1;
      if (idx >= words.length) {
        // give a small beat then hide
        setTimeout(hide, 750);
      } else {
        play();
      }
    }, typeTime + hold);
  }

  play();

  // also hide on first scroll (nice feel)
  const onScroll = () => { hide(); };
  bindScroll(onScroll, lenis);
}

/* ---------------- Code block tabs ---------------- */
const codeSamples = {
  python: [
    "# dad_jokes.py",
    "jokes = [",
    "    \"Why do programmers prefer dark mode? Because light attracts bugs.\",",
    "    \"How many programmers does it take to change a light bulb? None, that's a hardware problem.\",",
    "    \"I told my computer I needed a break, and it said no problem—it'll go to sleep.\",",
    "]",
    "",
    "for j in jokes:",
    "    print(j)"
  ].join("\n"),
  js: [
    "// dad_jokes.js",
    "const jokes = [",
    "  'Why was the function always calm? It had a lot of closure.',",
    "  'Promise me you’ll await my jokes.',",
    "  'I would tell you a UDP joke, but you might not get it.',",
    "];",
    "jokes.forEach(j => console.log(j));"
  ].join("\n"),
  cpp: [
    "// dad_jokes.cpp",
    "#include <iostream>",
    "int main(){",
    "  std::cout << \"There are only 10 types of people: those who understand binary and those who don't.\\n\";",
    "  std::cout << \"C++ developers don’t get jokes. They get templates.\\n\";",
    "}"
  ].join("\n")
};

function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function highlight(code){
  const kw = ["import","def","pass","print","const","return","include","int","main"];
  let h = escapeHtml(code);
  h = h.replace(/(^|\n)(\s*(#|\/\/).*)/g, (m, a, b)=> `${a}<span class="cm">${b}</span>`);
  h = h.replace(/(["'`])([^\n]*?)\1/g, (m)=> `<span class="str">${m}</span>`);
  for(const k of kw){
    const re = new RegExp(`\\b${k}\\b`, "g");
    h = h.replace(re, `<span class="kw">${k}</span>`);
  }
  h = h.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g, (m, fn)=> `<span class="fn">${fn}</span>(`);
  return h;
}

function renderCode(lang){
  const raw = codeSamples[lang] || codeSamples.python;
  const lines = raw.split("\n");
  const withNumbers = lines.map((line, i)=>{
    const ln = String(i+1).padStart(2,' ');
    return `<span class="ln">${ln}</span>  ${highlight(line)}`;
  }).join("\n");
  document.getElementById("codeBlock").innerHTML = withNumbers;
  document.getElementById("statusText").textContent = `${lang} • ready`;
}

function initTabs(){
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(t=>{
        t.classList.remove("active");
        t.setAttribute("aria-selected","false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected","true");
      renderCode(btn.dataset.lang);
    });
  });
}

function initCopy(){
  const btn = document.getElementById("copyBtn");
  btn.addEventListener("click", async ()=>{
    const lang = document.querySelector(".tab.active")?.dataset?.lang || "python";
    const text = codeSamples[lang] || codeSamples.python;
    try{
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
      setTimeout(()=> btn.textContent = "Copy", 900);
    }catch(e){
      btn.textContent = "Copy failed";
      setTimeout(()=> btn.textContent = "Copy", 900);
    }
  });
}

function initMailto(){
  const btn = document.getElementById("mailtoBtn");
  btn.addEventListener("click", ()=>{
    const form = btn.closest("form");
    const [name,email,msg] = Array.from(form.querySelectorAll("input, textarea")).map(x=>x.value.trim());
    const subject = encodeURIComponent(`Portfolio contact — ${name || "Visitor"}`);
    const body = encodeURIComponent(`Name: ${name || ""}\nEmail: ${email || ""}\n\nMessage:\n${msg || ""}\n`);
    window.location.href = `mailto:gcsamyog77@gmail.com?subject=${subject}&body=${body}`;
  });
}

/* ---------------- Nav active ---------------- */
let navStops = [];
let navLinks = [];

function buildNavStops(getPanelScroll){
  navLinks = Array.from(document.querySelectorAll(".nav a[href^=\"#\"]"));
  navStops = navLinks.map(link=>{
    const id = (link.getAttribute("href") || "").replace("#","");
    if (!id) return null;
    const el = document.getElementById(id);
    if (!el) return null;
    const panelScroll = getPanelScroll ? getPanelScroll(id) : null;
    const y = (typeof panelScroll === "number")
      ? panelScroll
      : (el.getBoundingClientRect().top + window.scrollY - getHeaderOffset());
    return { id, y };
  }).filter(Boolean);
  navStops.sort((a, b)=> a.y - b.y);
}

function setActiveNav(scrollPos){
  if (!navStops.length) return;
  const current = (typeof scrollPos === "number" ? scrollPos : window.scrollY || 0);
  const trigger = current + getHeaderOffset() + 20;
  let activeId = navStops[0].id;

  for(const stop of navStops){
    if (stop.y <= trigger) activeId = stop.id;
  }

  navLinks.forEach(link=>{
    const href = (link.getAttribute("href") || "").replace("#","");
    link.classList.toggle("active", href === activeId);
  });
}

function getHorizontalProgress(scrollY){
  for(const ctrl of horizontalControllers){
    const p = ctrl.progressFor(scrollY);
    if (p !== null) return p;
  }
  return null;
}

function initActiveNav(lenis, getPanelScroll){
  const rebuild = ()=>{
    buildNavStops(getPanelScroll);
    setActiveNav(window.scrollY || 0);
  };
  rebuild();
  bindScroll((e)=> setActiveNav(e?.scroll), lenis);
  window.addEventListener("resize", rebuild);
}


/* ---------------- Motion toggle + Parallax ---------------- */
function initMotionToggle(){
  // Motion toggle removed; default stays "on".
}

/* ---------------- Section reveal on scroll ---------------- */
function initReveals(){
  const sections = Array.from(document.querySelectorAll(".section"));
  if (!sections.length) return;

  if (prefersReducedMotion()){
    sections.forEach(s=>{
      s.classList.remove("reveal");
      s.classList.add("in-view");
    });
    return;
  }

  sections.forEach((s, i)=>{
    s.classList.add("reveal");
    s.style.setProperty("--reveal-delay", `${i * 120}ms`);
  });

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  sections.forEach(s=> observer.observe(s));
}

function initParallax(lenis){
  if (prefersReducedMotion()) return;
  if ((document.documentElement.getAttribute("data-motion") || "on") === "off") return;

  const items = Array.from(document.querySelectorAll("[data-parallax]")).filter(el => !el.closest(".section"));
  if (!items.length) return;

  const cfg = items.map(el=>{
    const speed = parseFloat(el.getAttribute("data-speed") || "0.22");
    const dir = (el.getAttribute("data-direction") || "down").toLowerCase();
    const axis = (el.getAttribute("data-axis") || "y").toLowerCase();
    const direction = (dir === "up" || dir === "left") ? -1 : 1;
    return { el, speed, direction, axis };
  });

  let ticking = false;
  let lastScroll = window.scrollY || 0;

  function update(){
    ticking = false;
    const y = lastScroll;
    const hProg = getHorizontalProgress(y);
    const doc = document.documentElement;
    const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
    const vProg = Math.min(Math.max(y / maxScroll, 0), 1);
    const travel = (hProg !== null) ? hProg : vProg;
    const xDrift = (hProg !== null) ? -hProg * 300 : 0;
    for(const c of cfg){
      let offsetX = 0;
      let offsetY = 0;
      if (c.axis === "x"){
        offsetX = Math.round(travel * 320 * c.speed * c.direction);
      } else {
        offsetY = Math.round(y * c.speed * c.direction * 0.35);
        offsetX = Math.round(xDrift * c.speed);
      }
      c.el.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    }
  }

  function onScroll(evt){
    if (typeof evt === "number"){
      lastScroll = evt;
    } else if (evt && typeof evt.scroll === "number"){
      lastScroll = evt.scroll;
    } else {
      lastScroll = window.scrollY || 0;
    }

    if (!ticking){
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  bindScroll(onScroll, lenis);
  window.addEventListener("resize", () => onScroll(lastScroll));
  onScroll(lastScroll);
}

/* ---------------- Bird canvas ---------------- */
function initBirdCanvas(){
  const canvas = document.getElementById("birdCanvas");
  if (!canvas) return;
  if (prefersReducedMotion()) return;
  if ((document.documentElement.getAttribute("data-motion") || "on") === "off") return;

  class Perlin2D {
    constructor(seed = 1337) {
      this.perm = new Uint8Array(512);
      const p = new Uint8Array(256);
      for (let i=0;i<256;i++) p[i]=i;
      let s = seed >>> 0;
      const rnd = () => (s = (1664525*s + 1013904223)>>>0) / 4294967296;
      for (let i=255;i>0;i--){
        const j = (rnd()*(i+1))|0;
        [p[i], p[j]] = [p[j], p[i]];
      }
      for (let i=0;i<512;i++) this.perm[i]=p[i & 255];
    }
    fade(t){ return t*t*t*(t*(t*6-15)+10); }
    lerp(a,b,t){ return a + (b-a)*t; }
    grad(h,x,y){
      switch(h & 7){
        case 0: return  x + y;
        case 1: return -x + y;
        case 2: return  x - y;
        case 3: return -x - y;
        case 4: return  x;
        case 5: return -x;
        case 6: return  y;
        default:return -y;
      }
    }
    noise(x,y){
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = this.fade(xf);
      const v = this.fade(yf);
      const aa = this.perm[this.perm[X] + Y];
      const ab = this.perm[this.perm[X] + Y + 1];
      const ba = this.perm[this.perm[X + 1] + Y];
      const bb = this.perm[this.perm[X + 1] + Y + 1];
      const x1 = this.lerp(this.grad(aa, xf,   yf),   this.grad(ba, xf-1, yf),   u);
      const x2 = this.lerp(this.grad(ab, xf,   yf-1), this.grad(bb, xf-1, yf-1), u);
      return this.lerp(x1, x2, v);
    }
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let W=0,H=0,DPR=1;
  function resize(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth|0; H = window.innerHeight|0;
    canvas.width = (W*DPR)|0; canvas.height = (H*DPR)|0;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", resize);
  resize();

  const perlin = new Perlin2D(20260127);

  const bird = [
    {x:-0.60, y: 0.10},
    {x:-0.28, y:-0.12},
    {x: 0.00, y: 0.10},
    {x: 0.28, y:-0.12},
    {x: 0.60, y: 0.10},
  ];

  const BASE = {
    noiseScale: 0.002,
    timeScale: 0.055,
    ampY: 0.03,
    fadeEdges: true,
    avoidRadius: 150,
    avoidStrength: 32,
  };

  const FLOCKS = [
    {
      count: 22,
      sizeMin: 10,
      sizeMax: 16,
      bandY: 0.22,
      speed: 36,
      spacingX: 60,
      spacingJitter: 12,
      alpha: 0.24,
      flapSpeed: 2.3,
    },
    {
      count: 18,
      sizeMin: 9,
      sizeMax: 14,
      bandY: 0.16,
      speed: 24,
      spacingX: 72,
      spacingJitter: 14,
      alpha: 0.18,
      flapSpeed: 1.8,
    },
  ];

  function rand(a,b){ return a + Math.random()*(b-a); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  const flocks = FLOCKS.map((cfg)=>{
    const merged = { ...BASE, ...cfg };
    const birds = Array.from({length: merged.count}, (_,i)=>{
      const side = (i%2===0) ? -1 : 1;
      const k = Math.floor(i/2);
      return {
        slot: (side * k),
        size: rand(merged.sizeMin, merged.sizeMax),
        jitterX: rand(-merged.spacingJitter, merged.spacingJitter),
        jitterY: rand(-0.02, 0.02),
        phase: rand(0, 1000),
        alpha: merged.alpha * rand(0.85, 1.15),
        offX: 0,
        offY: 0,
      };
    });
    return { cfg: merged, birds, leaderX: -200 - Math.random() * 160 };
  });

  let t0 = performance.now();
  let last = t0;
  let running = false;
  let rafId = 0;

  let strokeBase = { r: 245, g: 245, b: 245 };
  function parseColor(input){
    if (!input) return null;
    const val = input.trim();
    if (val.startsWith("#")){
      const hex = val.slice(1);
      if (hex.length === 3){
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
      }
      if (hex.length === 6){
        const r = parseInt(hex.slice(0,2), 16);
        const g = parseInt(hex.slice(2,4), 16);
        const b = parseInt(hex.slice(4,6), 16);
        return { r, g, b };
      }
      return null;
    }
    const m = val.match(/rgba?\(([^)]+)\)/i);
    if (!m) return null;
    const parts = m[1].split(",").map(v=>parseFloat(v));
    return {
      r: parts[0] ?? 245,
      g: parts[1] ?? 245,
      b: parts[2] ?? 245,
    };
  }

  function updateStrokeBase(){
    const css = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
    strokeBase = parseColor(css) || strokeBase;
  }
  updateStrokeBase();

  function isLightTheme(){
    return (document.documentElement.getAttribute("data-theme") || "light") === "light";
  }

  function setVisible(isVisible){
    canvas.style.display = isVisible ? "block" : "none";
  }

  function strokeColor(alpha){
    return `rgba(${strokeBase.r}, ${strokeBase.g}, ${strokeBase.b}, ${alpha})`;
  }

  function strokeBird(x, y, size, rot, alpha, flap){
    const wing = flap * 0.035;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.scale(size, size);

    ctx.beginPath();
    ctx.moveTo(bird[0].x, bird[0].y + wing * 0.4);
    for(let i=1;i<bird.length;i++){
      const isTip = (i === 1 || i === 3);
      const isOuter = (i === 4);
      const dy = isTip ? wing : (isOuter ? wing * 0.4 : 0);
      ctx.lineTo(bird[i].x, bird[i].y + dy);
    }

    ctx.lineWidth = 1.0 / size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor(alpha);
    ctx.stroke();
    ctx.restore();
  }

  function groupY(x, t, cfg){
    const n = perlin.noise(x * cfg.noiseScale, t * cfg.timeScale);
    return cfg.bandY + n * cfg.ampY;
  }

  function groupSlope(x, t, cfg){
    const dx = 80;
    const y1 = groupY(x - dx, t, cfg);
    const y2 = groupY(x + dx, t, cfg);
    return (y2 - y1) / (2*dx);
  }

  function edgeFade(x, cfg){
    if (!cfg.fadeEdges) return 1;
    const m = 140;
    if (x < m) return clamp(x/m, 0, 1);
    if (x > W - m) return clamp((W - x)/m, 0, 1);
    return 1;
  }

  const mouse = { x: -9999, y: -9999, active: false };
  function onMove(e){
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }
  function onLeave(){
    mouse.active = false;
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseleave", onLeave);
  window.addEventListener("blur", onLeave);

  function frame(now){
    if (!running) return;
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;
    const t = (now - t0)/1000;

    ctx.clearRect(0,0,W,H);

    for (const flock of flocks){
      const cfg = flock.cfg;
      flock.leaderX += cfg.speed * dt;
      if (flock.leaderX > W + 240) flock.leaderX = -240;

      const sorted = flock.birds.slice().sort((a,b)=>a.size-b.size);
      for (const b of sorted){
        let x = flock.leaderX - b.slot * cfg.spacingX + b.jitterX;
        const baseY = groupY(flock.leaderX + b.slot * 35, t, cfg);
        const localN = perlin.noise((flock.leaderX + b.phase) * 0.0016, t * 0.12 + b.phase*0.001);
        const yN = baseY + b.jitterY + localN * 0.012;
        let y = yN * H;

        let targetX = 0;
        let targetY = 0;
        if (mouse.active){
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < cfg.avoidRadius){
            const strength = Math.pow(1 - dist / cfg.avoidRadius, 2);
            const push = strength * cfg.avoidStrength * (b.size / cfg.sizeMax);
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            targetX = nx * push;
            targetY = ny * push;
          }
        }
        b.offX += (targetX - b.offX) * 0.18;
        b.offY += (targetY - b.offY) * 0.18;
        x += b.offX;
        y += b.offY;

        const slope = groupSlope(flock.leaderX, t, cfg);
        const rot = clamp(slope * 180, -0.22, 0.22);
        const flap = Math.sin(t * cfg.flapSpeed + b.phase * 0.01);

        const a = b.alpha * edgeFade(x, cfg);
        if (a > 0.01) strokeBird(x, y, b.size, rot, a, flap);
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  function start(){
    if (running) return;
    running = true;
    setVisible(true);
    last = performance.now();
    t0 = last;
    rafId = requestAnimationFrame(frame);
  }

  function stop(){
    if (!running) return;
    running = false;
    setVisible(false);
    if (rafId) cancelAnimationFrame(rafId);
    ctx.clearRect(0,0,W,H);
  }

  function updateThemeState(){
    updateStrokeBase();
    if (isLightTheme()){
      start();
    } else {
      stop();
    }
  }

  const themeObserver = new MutationObserver(updateThemeState);
  themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["data-theme"] });
  updateThemeState();
}

/* ---------------- Fireflies (dark mode) ---------------- */
function initFireflies(){
  const canvas = document.getElementById("fireflyCanvas");
  if (!canvas) return;
  if (prefersReducedMotion()) return;
  if ((document.documentElement.getAttribute("data-motion") || "on") === "off") return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let W=0, H=0, DPR=1;
  function resize(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth|0;
    H = window.innerHeight|0;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", resize);
  resize();

  const CFG = {
    count: 28,
    maxCount: 50,
    maxSpeed: 30,
    friction: 0.988,
    attract: 60,
    repel: 115,
    interactDist: 130,
    collisionDist: 6,
    spawnChance: 0.6,
    spawnCooldown: 0.25, // seconds
    mouseRadius: 150,
    mouseSpring: 0.075,
    baseAlpha: 0.12,
    glowRadius: 14,
    coreRadius: 2.0,
  };

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand  = (a,b)=>a+Math.random()*(b-a);

  const mouse = { x:0, y:0, active:false };
  window.addEventListener("mousemove", e=>{ mouse.x=e.clientX; mouse.y=e.clientY; mouse.active=true; });
  window.addEventListener("mouseleave", ()=> mouse.active=false);
  window.addEventListener("blur", ()=> mouse.active=false);

  let colors = { glow: "235,240,255", core: "245,248,255" };
  function updateColors(){
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const text = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
    const parsed = (val)=>{
      if (!val) return null;
      const m = val.match(/rgba?\(([^)]+)\)/i);
      if (!m) return null;
      const parts = m[1].split(",").map(v=>parseFloat(v));
      return `${parts[0]||255},${parts[1]||255},${parts[2]||255}`;
    };
    const g = parsed(accent) || "235,240,255";
    const c = parsed(text) || "245,248,255";
    colors = { glow: g, core: c };
  }
  updateColors();

  let flies = Array.from({length: CFG.count}, ()=>({
    x: rand(0,W), y: rand(0,H),
    vx: rand(-8,8), vy: rand(-8,8),
  }));

  function spawnFly(x, y){
    if (flies.length >= CFG.maxCount) return;
    flies.push({
      x: x ?? rand(0, W),
      y: y ?? rand(0, H),
      vx: rand(-4,4),
      vy: rand(-4,4),
    });
  }

  function wrap(p){
    const pad = 30;
    if(p.x < -pad) p.x = W + pad;
    if(p.x > W + pad) p.x = -pad;
    if(p.y < -pad) p.y = H + pad;
    if(p.y > H + pad) p.y = -pad;
  }

  function interact(a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    const r=Math.hypot(dx,dy)+0.001;
    if(r > CFG.interactDist) return;
    const f = (CFG.attract/(r*r)) - (CFG.repel/(r*r*r));
    const fx = (dx/r)*f, fy=(dy/r)*f;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  function mouseForce(p){
    if(!mouse.active) return;
    const dx=mouse.x-p.x, dy=mouse.y-p.y;
    const r=Math.hypot(dx,dy);
    if(r > CFG.mouseRadius) return;
    const t = 1 - r/CFG.mouseRadius;
    p.vx += dx * CFG.mouseSpring * t;
    p.vy += dy * CFG.mouseSpring * t;
  }

  function draw(p){
    const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,CFG.glowRadius);
    g.addColorStop(0, `rgba(${colors.glow},${CFG.baseAlpha*0.35})`);
    g.addColorStop(1, `rgba(${colors.glow},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x,p.y,CFG.glowRadius,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = `rgba(${colors.core},${CFG.baseAlpha*1.6})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,CFG.coreRadius,0,Math.PI*2);
    ctx.fill();
  }

  let last = performance.now();
  let running = false;
  let rafId = 0;
  let lastSpawn = 0;

  function frame(now){
    if (!running) return;
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;

    ctx.clearRect(0,0,W,H);

    for(let i=0;i<flies.length;i++){
      for(let j=i+1;j<flies.length;j++){
        const a = flies[i], b = flies[j];
        interact(a, b);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r = Math.hypot(dx, dy);
        if (r > 0 && r < CFG.collisionDist && flies.length < CFG.maxCount){
          const since = (now - lastSpawn) / 1000;
          if (since > CFG.spawnCooldown && Math.random() < CFG.spawnChance){
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            spawnFly(mx, my);
            lastSpawn = now;
          }
        }
      }
    }

    for(const p of flies){
      mouseForce(p);

      p.vx *= CFG.friction;
      p.vy *= CFG.friction;

      const sp = Math.hypot(p.vx,p.vy);
      if(sp > CFG.maxSpeed){
        const s = CFG.maxSpeed/sp;
        p.vx*=s; p.vy*=s;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      wrap(p);
      draw(p);
    }

    rafId = requestAnimationFrame(frame);
  }

  function start(){
    if (running) return;
    running = true;
    canvas.style.display = "block";
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop(){
    if (!running) return;
    running = false;
    canvas.style.display = "none";
    if (rafId) cancelAnimationFrame(rafId);
    ctx.clearRect(0,0,W,H);
  }

  function updateThemeState(){
    updateColors();
    if ((document.documentElement.getAttribute("data-theme") || "light") === "dark"){
      start();
    } else {
      stop();
    }
  }

  const themeObserver = new MutationObserver(updateThemeState);
  themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["data-theme"] });
  updateThemeState();
}

/* ---------------- Kites (colorful theme) ---------------- */
function initKites(){
  const canvas = document.getElementById("kiteCanvas");
  if (!canvas) return;
  if (prefersReducedMotion()) return;
  if ((document.documentElement.getAttribute("data-motion") || "on") === "off") return;

  const ctx = canvas.getContext("2d", { alpha:true });
  if (!ctx) return;

  let W=0, H=0, DPR=1;
  function resize(){
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth|0; H = innerHeight|0;
    canvas.width = (W*DPR)|0; canvas.height = (H*DPR)|0;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  addEventListener("resize", resize);
  resize();

  const rand = (a,b)=>a + Math.random()*(b-a);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;

  const mouse = {x:0,y:0, clicked:false};
  addEventListener("mousemove", e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
  addEventListener("mousedown", ()=>{ mouse.clicked=true; });

  function hexToRgb(hex){
    const h = hex.replace("#", "").trim();
    if (h.length === 3){
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    if (h.length === 6){
      return [
        parseInt(h.slice(0,2), 16),
        parseInt(h.slice(2,4), 16),
        parseInt(h.slice(4,6), 16),
      ];
    }
    return [120, 120, 120];
  }

  function shade(col, f){
    return col.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  }

  const palette = [
    "#1faadf", // bold sky blue
    "#21c994", // mint green
    "#f6b73c", // warm amber
    "#ef7a4a", // coral orange
    "#7b61ff", // vivid violet
  ].map(hexToRgb);
  const pick = (arr)=>arr[(Math.random()*arr.length)|0];

  const LAYOUT = {
    spawnXMin: 0.78,
    spawnXMax: 1.04,
    bandTop:   0.10,
    bandBot:   0.28,
    avoidLeftX: 0.70,
  };

  const CFG = {
    kiteCount: 4,
    speedBase: 32,
    speedVar: 10,
    riseBase:  -12,
    riseVar:   10,
    swayAmp:  14,
    swaySpeed: 0.42,
    bobAmp:   9,
    bobSpeed: 0.62,
    follow:   0.055,
    velDamp:  0.93,
    threadWidth: 1.15,
    threadAlpha: 0.32,
    curveSlack:  0.16,
    cutThreshold: 11,
    highlightAlpha: 0.75,
    fillAlpha:   0.65,
    strokeAlpha: 0.90,
    strokeWidth: 1.2,
    flyTop: (LAYOUT.bandTop + LAYOUT.bandBot) / 2,
    bandSpread: (LAYOUT.bandBot - LAYOUT.bandTop) / 2,
    windVar: 10,
    smooth: 0.06,
    showHover: false,
    allowCut: true,
    retargetMin: 3.5,
    retargetMax: 7.5,
    targetXMin: 0.35,
    targetXMax: 0.95,
    targetYMin: LAYOUT.bandTop,
    targetYMax: LAYOUT.bandBot,
    sepDist: 150,
    sepStrength: 28,
    edgePush: 16,
    gravity: 520,
    airDrag: 0.993,
    maxSpin: 0.020,
    spinReturn: 0.018,
    snapFrames: 10,
    snapLen: 32,
    snapKick: 120,
  };

  function distPointToSeg(px,py, ax,ay, bx,by){
    const abx=bx-ax, aby=by-ay;
    const apx=px-ax, apy=py-ay;
    const ab2=abx*abx + aby*aby;
    let t = ab2>0 ? (apx*abx + apy*aby)/ab2 : 0;
    t = clamp(t,0,1);
    const cx=ax+abx*t, cy=ay+aby*t;
    return Math.hypot(px-cx, py-cy);
  }

  function makeKiteShape(size){
    const s=size;
    const skew = rand(-0.10, 0.10)*s;
    return [
      {x: 0,      y:-1.15*s},
      {x: 0.90*s, y: 0 + skew},
      {x: 0,      y: 1.15*s},
      {x:-0.90*s, y: 0 - skew},
    ];
  }

  function makeTail(size){
    const bows=[];
    const n=3;
    for(let i=0;i<n;i++){
      const t=(i+1)/(n+1);
      const y = size*1.25 + t*size*1.35;
      const w = lerp(size*0.20, size*0.12, t);
      bows.push([
        {x:0, y:y},
        {x:w, y:y+w*0.95},
        {x:-w,y:y+w*0.95},
      ]);
    }
    return bows;
  }

  function makeKite(){
    const size = rand(20, 34);
    const col = pick(palette);
    const thread = shade(col, 0.55);
    const detail = shade(col, 0.80);
    const ax = rand(W*0.92, W*1.04);
    const ay = H + rand(80, 140);
    const x = rand(W*LAYOUT.spawnXMin, W*LAYOUT.spawnXMax);
    const y = rand(H*LAYOUT.bandTop, H*LAYOUT.bandBot);
    const ty = rand(H*LAYOUT.bandTop, H*LAYOUT.bandBot);
    const base = CFG.speedBase + rand(-CFG.speedVar, CFG.speedVar);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const vx0 = dir * base * 0.55;
    const vy0 = rand(CFG.riseBase-CFG.riseVar, CFG.riseBase+CFG.riseVar);
    const up = Math.abs(vy0);
    const wind = rand(-base * 0.6, base * 0.6);
    const bandPhase = rand(0, 1000);
    return {
      ax, ay,
      x, y,
      vx: vx0, vy: vy0,
      tx: rand(W*CFG.targetXMin, W*CFG.targetXMax),
      ty: rand(H*CFG.targetYMin, H*CFG.targetYMax),
      tTimer: rand(CFG.retargetMin, CFG.retargetMax),
      size,
      shape: makeKiteShape(size),
      tail: makeTail(size),
      col,
      thread,
      detail,
      phase: rand(0, 1000),
      bandPhase,
      up,
      wind,
      rot: rand(-0.18, 0.18),
      rot0: rand(-0.12, 0.12),
      vr: 0,
      slack: CFG.curveSlack * rand(0.80, 1.25),
      sepX: 0,
      sepY: 0,
      cut:false,
      snapN: 0,
      snapSeg: null,
    };
  }

  let kites = Array.from({length: CFG.kiteCount}, () => makeKite());

  function respawn(k){
    const nk = makeKite();
    Object.assign(k, nk);
  }

  function threadBezier(k){
    const ax=k.ax, ay=k.ay, bx=k.x, by=k.y;
    const dx=bx-ax, dy=by-ay;
    const L=Math.hypot(dx,dy)+0.001;
    const sag = (0.10 + k.slack*0.70) * L;
    const bend = clamp(k.vx * 8, -28, 28) * (0.22 + 0.46 * clamp(L/420, 0, 1));
    const c1x = ax + dx*0.22 + bend;
    const c1y = ay + dy*0.22 + sag;
    const c2x = ax + dx*0.78 + bend*0.50;
    const c2y = ay + dy*0.78 + sag*0.30;
    return {ax,ay,bx,by,c1x,c1y,c2x,c2y};
  }

  function distPointToBezier(px,py, bez){
    let best = 1e9;
    let prevx = bez.ax, prevy = bez.ay;
    const steps = 28;
    for(let i=1;i<=steps;i++){
      const t = i/steps;
      const u = 1-t;
      const x =
        u*u*u*bez.ax +
        3*u*u*t*bez.c1x +
        3*u*t*t*bez.c2x +
        t*t*t*bez.bx;
      const y =
        u*u*u*bez.ay +
        3*u*u*t*bez.c1y +
        3*u*t*t*bez.c2y +
        t*t*t*bez.by;
      const d = distPointToSeg(px,py, prevx,prevy, x,y);
      if (d < best) best = d;
      prevx = x; prevy = y;
    }
    return best;
  }

  function drawThread(bez, alpha, col){
    ctx.save();
    ctx.lineWidth = CFG.threadWidth;
    const rgb = col || [60,60,60];
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(bez.ax, bez.ay);
    ctx.bezierCurveTo(bez.c1x,bez.c1y, bez.c2x,bez.c2y, bez.bx,bez.by);
    ctx.stroke();
    ctx.restore();
  }

  function drawSnapSegment(seg, t){
    if (!seg) return;
    const a = seg.a0 * (1 - t);
    if (a <= 0) return;
    ctx.save();
    ctx.lineWidth = CFG.threadWidth;
    const rgb = seg.col || [40,40,40];
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawKiteBody(k){
    const [r,g,b] = k.col;
    const [dr,dg,db] = k.detail || k.col;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rot);
    ctx.fillStyle   = `rgba(${r},${g},${b},${CFG.fillAlpha})`;
    ctx.strokeStyle = `rgba(${r},${g},${b},${CFG.strokeAlpha})`;
    ctx.lineWidth = CFG.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(k.shape[0].x, k.shape[0].y);
    for(let i=1;i<k.shape.length;i++) ctx.lineTo(k.shape[i].x, k.shape[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = `rgba(${dr},${dg},${db},${CFG.strokeAlpha})`;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(0, k.shape[0].y*0.65);
    ctx.lineTo(0, k.shape[2].y*0.65);
    ctx.moveTo(k.shape[3].x*0.55, 0);
    ctx.lineTo(k.shape[1].x*0.55, 0);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = `rgba(${dr},${dg},${db},${CFG.strokeAlpha})`;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.moveTo(0, k.size*1.10);
    ctx.lineTo(0, k.size*3.00);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = `rgba(${dr},${dg},${db},${CFG.fillAlpha * 0.85})`;
    ctx.strokeStyle = `rgba(${dr},${dg},${db},${CFG.strokeAlpha})`;
    ctx.globalAlpha = 0.22;
    for(const tri of k.tail){
      ctx.beginPath();
      ctx.moveTo(tri[0].x, tri[0].y);
      ctx.lineTo(tri[1].x, tri[1].y);
      ctx.lineTo(tri[2].x, tri[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  function updateFly(k, t, dt){
    k.tTimer -= dt;
    if (k.tTimer <= 0){
      k.tx = rand(W*CFG.targetXMin, W*CFG.targetXMax);
      k.ty = rand(H*CFG.targetYMin, H*CFG.targetYMax);
      k.tTimer = rand(CFG.retargetMin, CFG.retargetMax);
    }
    const bandCenter = H * CFG.flyTop;
    const bandJitter = Math.sin(t*0.22 + k.bandPhase*0.004) * (H*CFG.bandSpread);
    const topY = bandCenter + bandJitter;
    const sway = Math.sin(t*CFG.swaySpeed + k.phase*0.003) * CFG.swayAmp;
    const bob  = Math.cos(t*CFG.bobSpeed  + k.phase*0.002) * CFG.bobAmp;
    const ascend = (k.y > topY) ? -k.up : (-k.up * 0.18 + bob*0.15);
    const wind = k.wind + Math.sin(t*0.32 + k.phase*0.001) * CFG.windVar;
    const pullX = (k.tx - k.x) * CFG.follow;
    const pullY = (k.ty - k.y) * CFG.follow;
    const edgeX = (k.x < W*0.12) ? CFG.edgePush : (k.x > W*0.92 ? -CFG.edgePush : 0);
    const tvx = wind + sway + pullX + k.sepX + edgeX;
    const tvy = ascend + pullY + k.sepY;
    k.vx = lerp(k.vx, tvx, CFG.smooth);
    k.vy = lerp(k.vy, tvy, CFG.smooth);
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (k.x < -120) k.x = W + 120;
    if (k.x > W + 120) k.x = -120;
    const maxLen = Math.max(560, H * 0.95);
    const dx = k.x - k.ax, dy = k.y - k.ay;
    const L = Math.hypot(dx, dy) + 0.001;
    if (L > maxLen){
      const s = maxLen / L;
      k.x = k.ax + dx*s;
      k.y = k.ay + dy*s;
    }
    const desired = clamp((k.vx)*0.010, -0.28, 0.28) + k.rot0;
    k.vr += (desired - k.rot) * 0.04;
    k.vr *= 0.90;
    k.rot += k.vr * dt * 60;
    const minY = H * (LAYOUT.bandTop - 0.08);
    if (k.y < minY){
      k.y = rand(H*LAYOUT.bandTop, H*LAYOUT.bandBot);
      k.x = W + rand(40, 160);
    }
  }

  function updateFall(k, t, dt){
    k.vy += CFG.gravity * dt;
    k.vx += Math.sin(t*0.35 + k.phase*0.01) * 6 * dt;
    k.vx *= CFG.airDrag;
    k.vy *= CFG.airDrag;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    const stable = clamp((k.vx)*0.008, -0.25, 0.25) + k.rot0;
    k.vr += (stable - k.rot) * CFG.spinReturn;
    k.vr = clamp(k.vr, -CFG.maxSpin, CFG.maxSpin);
    k.rot += k.vr * dt * 60;
    if (k.y > H + 180) respawn(k);
  }

  function cutIfClicked(){
    if (!CFG.allowCut) return;
    if (!mouse.clicked) return;
    mouse.clicked = false;
    let best = {idx:-1, d:1e9, bez:null};
    for (let i=0;i<kites.length;i++){
      const k = kites[i];
      if (k.cut) continue;
      const bez = threadBezier(k);
      const d = distPointToBezier(mouse.x, mouse.y, bez);
      if (d < best.d){
        best = {idx:i, d, bez};
      }
    }
    if (best.idx >= 0 && best.d <= CFG.cutThreshold){
      const k = kites[best.idx];
      const dx = k.x - k.ax, dy = k.y - k.ay;
      const L = Math.hypot(dx,dy) + 0.001;
      const ux = dx / L, uy = dy / L;
      const x1 = k.ax;
      const y1 = k.ay;
      const x2 = k.ax + ux * CFG.snapLen;
      const y2 = k.ay + uy * CFG.snapLen;
      k.snapN = CFG.snapFrames;
      k.snapSeg = { x1,y1,x2,y2, a0: CFG.threadAlpha, col: k.thread };
      k.cut = true;
      k.cutAt = performance.now();
      k.vx += ux * CFG.snapKick + rand(-35,35);
      k.vy += uy * CFG.snapKick + rand(-10,15);
      k.vr += rand(-0.01, 0.01);
    }
  }

  let last = performance.now();
  let running = false;
  let rafId = 0;

  function frame(now){
    if (!running) return;
    const dt = Math.min(0.033, (now-last)/1000);
    last = now;
    const t = now/1000;
    ctx.clearRect(0,0,W,H);
    cutIfClicked();
    for (const k of kites){
      k.sepX = 0;
      k.sepY = 0;
    }
    for (let i=0;i<kites.length;i++){
      for (let j=i+1;j<kites.length;j++){
        const a = kites[i];
        const b = kites[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < CFG.sepDist){
          const f = (1 - d / CFG.sepDist) * CFG.sepStrength;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.sepX += fx; a.sepY += fy;
          b.sepX -= fx; b.sepY -= fy;
        }
      }
    }
    for (const k of kites){
      if (!k.cut) updateFly(k, t, dt);
      else updateFall(k, t, dt);
      if (k.snapN > 0 && k.snapSeg){
        const p = 1 - (k.snapN / CFG.snapFrames);
        drawSnapSegment(k.snapSeg, p);
        k.snapN--;
        if (k.snapN <= 0) k.snapSeg = null;
      }
      if (!k.cut){
        const bez = threadBezier(k);
        const hl = CFG.showHover ? (distPointToBezier(mouse.x, mouse.y, bez) <= (CFG.cutThreshold+4)) : false;
        drawThread(bez, hl ? CFG.highlightAlpha : CFG.threadAlpha, k.thread);
        drawKiteBody(k);
      } else {
        drawKiteBody(k);
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function start(){
    if (running) return;
    running = true;
    canvas.style.display = "block";
    canvas.style.pointerEvents = "auto";
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop(){
    if (!running) return;
    running = false;
    canvas.style.display = "none";
    canvas.style.pointerEvents = "none";
    if (rafId) cancelAnimationFrame(rafId);
    ctx.clearRect(0,0,W,H);
  }

  function updateThemeState(){
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    if (theme === "colorful"){
      start();
    } else {
      stop();
    }
  }

  const themeObserver = new MutationObserver(updateThemeState);
  themeObserver.observe(document.documentElement, { attributes:true, attributeFilter:["data-theme"] });
  updateThemeState();
}

/* ---------------- Cursor follower ---------------- */
function initCursorFollower(){
  const motionOff = (document.documentElement.getAttribute("data-motion") || "on") === "off";
  if (motionOff || prefersReducedMotion()) return;
  if (!window.matchMedia || !window.matchMedia("(pointer:fine)").matches) return;

  const dot = document.createElement("div");
  dot.className = "cursor-follower";
  document.body.appendChild(dot);

  document.addEventListener("mousemove", (e)=>{
    dot.style.setProperty("--cx", `${e.clientX}px`);
    dot.style.setProperty("--cy", `${e.clientY}px`);
    dot.style.opacity = 1;
  });
  document.addEventListener("mouseleave", ()=>{ dot.style.opacity = 0; });
  document.addEventListener("mouseenter", (e)=>{
    dot.style.opacity = 1;
    dot.style.setProperty("--cx", `${e.clientX}px`);
    dot.style.setProperty("--cy", `${e.clientY}px`);
  });

  const enlargeTargets = document.querySelectorAll("button, .btn, a");
  enlargeTargets.forEach(el=>{
    el.addEventListener("mouseenter", ()=> dot.classList.add("large"));
    el.addEventListener("mouseleave", ()=> dot.classList.remove("large"));
  });

  const invertTargets = document.querySelectorAll("a, button, .btn, p, h1, h2, h3, h4, h5, h6, li, .chip, .pill, .lead, .muted, .kicker, .tagline, .name, .status, .code, .nav a, .intro, .intro *");
  invertTargets.forEach(el=>{
    el.addEventListener("mouseenter", ()=> dot.classList.add("invert"));
    el.addEventListener("mouseleave", ()=> dot.classList.remove("invert"));
  });
}

/* init */
document.getElementById("year").textContent = String(new Date().getFullYear());
initTheme();
const lenis = initSmoothScroll();
const hScroll = initHorizontalScrolls(lenis);
wireAnchors(lenis, hScroll ? hScroll.getTargetScroll : null);
initActiveNav(lenis, hScroll ? hScroll.getTargetScroll : null);

renderCode("python");
initTabs();
initCopy();
initMailto();
initMotionToggle();
initParallax(lenis);
initBirdCanvas();
initFireflies();
initKites();
initCursorFollower();
initIntro(lenis);
initReveals();
