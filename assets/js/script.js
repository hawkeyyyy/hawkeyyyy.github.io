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
  const initial = ["light","dark","colorful"].includes(saved) ? saved : "light";
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
function setActiveNav(scrollPos){
  const links = document.querySelectorAll(".nav a");
  const ids = ["about","skills","projects","education","contact"];
  const sections = ids.map(id => document.getElementById(id));
  const current = (typeof scrollPos === "number" ? scrollPos : window.scrollY);
  const y = current + 120;
  let activeId = ids[0];

  const hPanelId = getHorizontalMatch(current);
  if (hPanelId && ids.includes(hPanelId)){
    activeId = hPanelId;
  } else {
    for(const s of sections){
      if(s && s.offsetTop <= y) activeId = s.id;
    }
  }

  links.forEach(a=>{
    const href = (a.getAttribute("href") || "").replace("#","");
    a.classList.toggle("active", href === activeId);
  });
}

function getHorizontalMatch(scrollY){
  for(const ctrl of horizontalControllers){
    const { start, end } = ctrl.range();
    if (scrollY >= start && scrollY <= end + 1){
      const dist = Math.max(end - start, 1);
      const rel = Math.min(Math.max(scrollY - start, 0), dist);
      const progress = rel / dist;
      const idx = Math.min(ctrl.panels.length - 1, Math.max(0, Math.round(progress * (ctrl.panels.length - 1))));
      const pid = ctrl.panels[idx]?.id;
      if (pid) return pid;
    }
  }
  return null;
}

function getHorizontalProgress(scrollY){
  for(const ctrl of horizontalControllers){
    const p = ctrl.progressFor(scrollY);
    if (p !== null) return p;
  }
  return null;
}

function initActiveNav(lenis){
  bindScroll((e)=> setActiveNav(e?.scroll), lenis);
  setActiveNav(window.scrollY || 0);
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
    const direction = (dir === "up") ? -1 : 1;
    return { el, speed, direction };
  });

  let ticking = false;
  let lastScroll = window.scrollY || 0;

  function update(){
    ticking = false;
    const y = lastScroll;
    const hProg = getHorizontalProgress(y);
    const xBase = (hProg !== null) ? -hProg * 300 : 0;
    for(const c of cfg){
      const offsetY = Math.round(y * c.speed * c.direction * 0.35);
      const offsetX = Math.round(xBase * c.speed);
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
initActiveNav(lenis);

renderCode("python");
initTabs();
initCopy();
initMailto();
initMotionToggle();
initParallax(lenis);
initCursorFollower();
initIntro(lenis);
initReveals();
