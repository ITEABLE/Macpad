"use strict";

const TOKEN = document.querySelector('meta[name="macpad-token"]').content;
const $ = (id) => document.getElementById(id);
const pad = $("pad"), statusEl = $("status"), flash = $("flash");
const indicator = $("indicator"), host = $("host");
host.textContent = location.host.replace(/:\d+$/, "");

// Settings
const defaults = { sens: 1.8, scrollSpeed: 1, gestThresh: 55, natural: true,
                   accel: true, gestures: true, rightTap: true, diag: false };
let cfg = Object.assign({}, defaults);
try { Object.assign(cfg, JSON.parse(localStorage.getItem("macpad") || "{}")); } catch (e) {}
const saveCfg = () => { try { localStorage.setItem("macpad", JSON.stringify(cfg)); } catch (e) {} };

function bindRange(id, key, labelId, fmt) {
  const el = $(id); if (!el) return;
  el.value = cfg[key];
  $(labelId).textContent = fmt(cfg[key]);
  el.addEventListener("input", () => {
    cfg[key] = parseFloat(el.value);
    $(labelId).textContent = fmt(cfg[key]);
    saveCfg();
  });
}
bindRange("sens", "sens", "sensVal", (v) => v.toFixed(1) + "×");
bindRange("scrollSpeed", "scrollSpeed", "scrollVal", (v) => v.toFixed(1) + "×");
bindRange("gestThresh", "gestThresh", "gestVal", (v) => v.toFixed(0) + "px");
for (const k of ["natural", "accel", "gestures", "rightTap", "diag"]) {
  const el = $(k);
  el.checked = !!cfg[k];
  el.addEventListener("change", () => { cfg[k] = el.checked; saveCfg(); });
}

// Sheets
const kb = $("kb"), settings = $("settings"), appsSheet = $("apps");
const isOpen = (el) => el.dataset.open === "yes";
const setOpen = (el, open) => { el.dataset.open = open ? "yes" : "no"; };

// Sheet height varies with the active layer and the device, so measure it.
// A hardcoded value leaves a dead band between the pad and the keyboard.
// The trackpad is the product, so it is never fully covered. Whichever sheet
// is open is capped to leave the pad a usable height, and the pad is pushed up
// by exactly the sheet plus whatever the iOS keyboard is covering.
const PAD_FLOOR = 150;

function openSheet() {
  return [kb, appsSheet, settings].find((el) => el && isOpen(el)) || null;
}

function fitPad() {
  const sheet = openSheet();
  document.body.dataset.sheet = sheet ? "open" : "none";
  if (!sheet) { pad.style.marginBottom = ""; return; }
  requestAnimationFrame(() => {
    const vv = window.visualViewport;
    const visible = (vv && vv.height) || window.innerHeight || 0;
    const headroom = visible - PAD_FLOOR - indicator.offsetHeight;
    if (headroom > 0) sheet.style.maxHeight = headroom + "px";
    const lift = parseFloat(sheet.style.bottom) || 0;
    const h = sheet.offsetHeight || 0;
    pad.style.marginBottom = h ? (h + lift) + "px" : "";
  });
}

// Kept as an alias so every existing caller still reads clearly.
const fitPadToKeyboard = fitPad;

// iOS doesn't shrink the layout viewport for its keyboard, so a sheet pinned
// to the bottom ends up behind it. visualViewport reports the covered height.
function liftAboveNativeKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  const sheet = openSheet() || kb;
  sheet.style.bottom = covered ? covered + "px" : "";
  fitPad();
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", liftAboveNativeKeyboard);
  window.visualViewport.addEventListener("scroll", liftAboveNativeKeyboard);
}
const openKb = () => {
  setOpen(settings, false); closeApps();
  setOpen(kb, true); document.body.dataset.nativeKeyboard = "no";
  fitPadToKeyboard();
};
const closeKb = () => {
  setOpen(kb, false); delete document.body.dataset.nativeKeyboard;
  $("native").blur();
  fitPadToKeyboard();
};
$("openKb").addEventListener("click", () => isOpen(kb) ? closeKb() : openKb());
$("kbDone").addEventListener("click", () => {
  if (nativeFocused) native.blur();   // first press: drop the iPhone keyboard
  else closeKb();                     // second press: close the panel
});
$("openSettings").addEventListener("click", () => { closeKb(); closeApps(); setOpen(settings, true); fitPad(); });
$("settingsDone").addEventListener("click", () => { setOpen(settings, false); fitPad(); });

// Socket
let ws = null, ready = false, retry = 0;

function connect() {
  try { ws = new WebSocket(`ws://${location.host}/?k=${encodeURIComponent(TOKEN)}`); }
  catch (e) { scheduleReconnect(); return; }
  ws.onopen = () => {
    ready = true; retry = 0;
    indicator.dataset.state = "live";
    statusEl.textContent = "Connected";
  };
  ws.onclose = () => {
    ready = false;
    indicator.dataset.state = "fault";
    statusEl.textContent = "Reconnecting";
    scheduleReconnect();
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === "apps") { renderApps(m.apps); return; }
    if ((m.t === "hello" || m.t === "ax")) {
      if (m.ax === false) {
      indicator.dataset.state = "fault";
      statusEl.textContent = "Grant Accessibility";
    } else if (ready) {
      indicator.dataset.state = "live";
      statusEl.textContent = "Connected";
    }
    }
  };
}
function scheduleReconnect() {
  retry = Math.min(retry + 1, 10);
  setTimeout(connect, Math.min(300 * retry, 2000));
}
const send = (o) => { if (ready) { try { ws.send(JSON.stringify(o)); } catch (e) {} } };
connect();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && (!ws || ws.readyState > 1)) connect();
});

// Batched movement (one packet per frame)
let mx = 0, my = 0, sx = 0, sy = 0, queued = false;
function flushQueue() {
  queued = false;
  if (mx || my) { send({ t: "m", x: Math.round(mx * 100) / 100, y: Math.round(my * 100) / 100 }); mx = my = 0; }
  if (sx || sy) { send({ t: "s", x: Math.round(sx), y: Math.round(sy) }); sx = sy = 0; }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(flushQueue); } };

// Gesture → action table
const GESTURES = {
  3: { up: ["mission", "Mission Control"], down: ["appexpose", "App windows"],
       left: ["spaceleft", "◀ Space"],     right: ["spaceright", "Space ▶"] },
  4: { up: ["showdesktop", "Show Desktop"], down: ["showdesktop", "Show Desktop"],
       left: ["spaceleft", "◀ Space"],      right: ["spaceright", "Space ▶"] },
};

// System hotkeys (Mission Control, Spaces) want a genuine modifier keypress,
// not just a modifier flag set on the key event. Press, send, release.
const CHORDS = {
  mission:     { key: "up",    mod: ["ctrl"] },
  appexpose:   { key: "down",  mod: ["ctrl"] },
  spaceleft:   { key: "left",  mod: ["ctrl"] },
  spaceright:  { key: "right", mod: ["ctrl"] },
  showdesktop: { key: "f11",   mod: [] },
  spotlight:   { key: "space", mod: ["cmd"] },
  switchapp:   { key: "tab",   mod: ["cmd"] },
};

function runAction(name) {
  const c = CHORDS[name];
  if (!c) { send({ t: "sys", a: name }); return; }
  for (const m of c.mod) send({ t: "mod", m, down: true });
  send({ t: "k", key: c.key, mod: [] });
  for (const m of [...c.mod].reverse()) send({ t: "mod", m, down: false });
}

let flashTimer = null;
function showFlash(text) {
  flash.textContent = text;
  flash.dataset.show = "yes";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.dataset.show = "no"; }, 650);
}

// Touch handling
const TAP_MS = 280, TAP_SLOP = 12, DRAG_WINDOW = 320, DRAG_ARM_MS = 60;
const TAP_TOGETHER = 140;   // fingers landing within this count as one tap
const MAX_STEP = 180;       // a bigger single-event jump is a glitch, not a swipe
const ACCEL_K = 1.2;        // gain per px/ms of finger speed
const ACCEL_CAP = 2.6;      // ceiling, so a flick cannot teleport the pointer
const DT_MIN = 4, DT_MAX = 50;   // plausible bounds for one frame of touch

const active = new Map();
const lastPos = new Map();          // per-finger previous position
let landings = [];                  // when each finger of this gesture landed
let lastCount = 0;                  // finger count at the previous event
let peakFingers = 0, startTime = 0, travel = 0, lastTapEnd = 0, tapChain = 0;
let lastMoveAt = 0;         // for speed in px/ms rather than px/event
let dragging = false, scrollAnchor = null;
let gestureAnchor = null, gestureFired = false;
let dragPending = false, dragTimer = null;

function cancelPendingDrag() {
  if (dragTimer !== null) { clearTimeout(dragTimer); dragTimer = null; }
  dragPending = false;
}

// iOS drops touchend when a system gesture steals the sequence, which leaves
// a phantom finger in our map and makes every later tap read as two. Trust
// e.touches and discard anything the browser no longer reports.
function reconcile(e) {
  if (!e.touches) return;
  const live = new Set();
  for (const t of e.touches) live.add(t.identifier);
  for (const id of [...active.keys()]) if (!live.has(id)) active.delete(id);
  for (const id of [...lastPos.keys()]) if (!live.has(id)) lastPos.delete(id);
}

function centroid() {
  let x = 0, y = 0, n = 0;
  for (const p of active.values()) { x += p.x; y += p.y; n++; }
  return n ? { x: x / n, y: y / n } : null;
}

pad.addEventListener("touchstart", (e) => {
  e.preventDefault();
  reconcile(e);
  // Settings closes on touch; the keyboard doesn't, so you can click into a
  // field and keep typing.
  if (isOpen(settings)) setOpen(settings, false);

  if (active.size === 0) {
    startTime = performance.now();
    travel = 0;
    peakFingers = 0;
    gestureFired = false;
    landings = [];
    lastMoveAt = performance.now();
    if (performance.now() - lastTapEnd < DRAG_WINDOW && e.touches.length === 1) {
      // Defer the button press: a second finger arriving now means right-click
      // or scroll, not drag.
      dragPending = true;
      dragTimer = setTimeout(() => {
        dragTimer = null;
        if (dragPending && active.size === 1) {
          dragging = true;
          send({ t: "d", b: 0 });
          pad.dataset.engaged = "drag";
        }
        dragPending = false;
      }, DRAG_ARM_MS);
    }
  }

  for (const t of e.changedTouches) {
    active.set(t.identifier, { x: t.clientX, y: t.clientY });
    lastPos.set(t.identifier, { x: t.clientX, y: t.clientY });
    landings.push(performance.now());
  }
  peakFingers = Math.max(peakFingers, active.size);
  lastCount = active.size;

  if (active.size >= 2) cancelPendingDrag();

  if (active.size >= 3) {
    // Drop queued motion so the cursor doesn't lurch while fingers land.
    mx = my = sx = sy = 0;
    gestureAnchor = centroid();
    scrollAnchor = null;
  } else if (active.size === 2) {
    scrollAnchor = centroid();
  }
  pad.dataset.touching = "yes";
}, { passive: false });

pad.addEventListener("touchmove", (e) => {
  e.preventDefault();
  reconcile(e);

  // Every finger's position is refreshed on every event regardless of mode.
  // Refreshing only in the one-finger branch meant that after a two-finger
  // scroll the remaining finger was measured against its touchdown point,
  // firing the whole scroll distance as a single jump.
  const deltas = [];
  for (const t of e.changedTouches) {
    const prev = lastPos.get(t.identifier);
    const now = { x: t.clientX, y: t.clientY };
    lastPos.set(t.identifier, now);
    if (active.has(t.identifier)) active.set(t.identifier, now);
    if (prev) deltas.push({ dx: now.x - prev.x, dy: now.y - prev.y });
  }

  const n = active.size;
  const settled = n === lastCount;   // the event a finger joins/leaves is not a move
  lastCount = n;

  // --- 3+ fingers: swipe gestures ---
  if (n >= 3) {
    if (!cfg.gestures || gestureFired || !gestureAnchor) return;
    const c = centroid();
    if (!c) return;
    const dx = c.x - gestureAnchor.x, dy = c.y - gestureAnchor.y;
    travel += Math.hypot(dx, dy);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cfg.gestThresh) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left")
                                            : (dy > 0 ? "down" : "up");
    const table = GESTURES[Math.min(n, 4)];
    const hit = table && table[dir];
    if (hit) { runAction(hit[0]); showFlash(hit[1]); }
    gestureFired = true;
    return;
  }

  // --- 2 fingers: scroll ---
  if (n === 2) {
    const c = centroid();
    if (scrollAnchor && c) {
      const dx = c.x - scrollAnchor.x, dy = c.y - scrollAnchor.y;
      travel += Math.hypot(dx, dy);
      // A finger joining or leaving shifts the centroid on its own.
      if (!settled || Math.abs(dx) > MAX_STEP || Math.abs(dy) > MAX_STEP) {
        scrollAnchor = c;
        return;
      }
      const k = 2.2 * cfg.scrollSpeed, sign = cfg.natural ? 1 : -1;
      sy += dy * k * sign;
      sx += dx * k * sign;
      scrollAnchor = c;
      schedule();
    }
    return;
  }

  // --- 1 finger: move the pointer ---
  if (n !== 1 || !settled) return;

  // Acceleration is measured in px per millisecond, not px per event. Per-event
  // speed depends on how often the device samples touches, so the same physical
  // flick accelerated differently at 60Hz and 120Hz and the pointer felt uneven.
  const now = performance.now();
  const dt = Math.min(Math.max(now - lastMoveAt, DT_MIN), DT_MAX);
  lastMoveAt = now;

  for (const d of deltas) {
    // No real swipe covers this much ground in one event.
    if (Math.abs(d.dx) > MAX_STEP || Math.abs(d.dy) > MAX_STEP) continue;
    const dist = Math.hypot(d.dx, d.dy);
    travel += dist;
    let gain = cfg.sens;
    if (cfg.accel) gain *= 1 + Math.min((dist / dt) * ACCEL_K, ACCEL_CAP);
    mx += d.dx * gain;
    my += d.dy * gain;
    schedule();
  }
}, { passive: false });

function endTouches(e) {
  e.preventDefault();
  for (const t of e.changedTouches) { active.delete(t.identifier); lastPos.delete(t.identifier); }
  reconcile(e);
  lastCount = active.size;

  if (active.size >= 3) { gestureAnchor = centroid(); return; }
  if (active.size === 2) { scrollAnchor = centroid(); return; }
  if (active.size === 1) { scrollAnchor = null; gestureAnchor = null; return; }

  pad.dataset.touching = "no";
  flushQueue();
  cancelPendingDrag();

  if (dragging) {
    dragging = false;
    pad.dataset.engaged = "none";
    send({ t: "u", b: 0 });
    lastTapEnd = 0;
    tapChain = 0;
    peakFingers = 0;
    return;
  }

  const quick = performance.now() - startTime < TAP_MS;
  const still = travel < TAP_SLOP;

  // Count only fingers that landed together. Counting the peak total meant a
  // thumb brushing the pad after the tap turned a left click into a right one.
  let tapFingers = 0;
  if (landings.length) {
    const first = landings[0];
    tapFingers = landings.filter((t) => t - first <= TAP_TOGETHER).length;
  }

  if (quick && still && !gestureFired && e.type === "touchend") {
    if (tapFingers >= 3) {
      send({ t: "c", b: 2, n: 1 });
      showFlash("Middle click");
      tapChain = 0; lastTapEnd = 0;
    } else if (tapFingers === 2) {
      // With right-click off, a stray second contact still clicks normally.
      send({ t: "c", b: cfg.rightTap ? 1 : 0, n: 1 });
      tapChain = 0; lastTapEnd = 0;
    } else if (tapFingers === 1) {
      tapChain = performance.now() - lastTapEnd < DRAG_WINDOW ? Math.min(tapChain + 1, 3) : 1;
      send({ t: "c", b: 0, n: tapChain });
      lastTapEnd = performance.now();
    }
    if (cfg.diag && tapFingers) {
      statusEl.textContent = `${tapFingers} finger${tapFingers > 1 ? "s" : ""}`;
      clearTimeout(diagTimer);
      diagTimer = setTimeout(() => { if (ready) statusEl.textContent = "Connected"; }, 1400);
    }
  }
  peakFingers = 0;
  gestureFired = false;
  gestureAnchor = null;
  scrollAnchor = null;
  landings = [];
  lastCount = 0;
}
let diagTimer = null;
pad.addEventListener("touchend", endTouches, { passive: false });
pad.addEventListener("touchcancel", endTouches, { passive: false });

// Modifiers latch: tap one and it stays lit until the next key consumes it.
const mods = { cmd: false, ctrl: false, opt: false, shift: false };

function activeMods() { return Object.keys(mods).filter((m) => mods[m]); }

function clearMods() {
  for (const m of Object.keys(mods)) mods[m] = false;
  for (const b of document.querySelectorAll("[data-mod]")) b.setAttribute("aria-pressed", "false");
}

// A shortcut is pressed the way hardware presses it: modifiers down, key,
// modifiers up. Any latched modifier joins in, so shift + cmdZ gives redo.
function pressChord(spec) {
  const parts = spec.split("+");
  const key = parts.pop();
  const held = [...new Set([...parts, ...activeMods()])];
  for (const m of held) send({ t: "mod", m, down: true });
  send({ t: "k", key, mod: [] });
  for (const m of [...held].reverse()) send({ t: "mod", m, down: false });
  if (activeMods().length) clearMods();
}

function pressKey(key) {
  const held = activeMods();
  send({ t: "k", key, mod: held });
  if (held.length) clearMods();
}



for (const b of document.querySelectorAll("[data-mod]")) {
  b.addEventListener("click", (e) => {
    e.preventDefault();
    const m = b.dataset.mod;
    mods[m] = !mods[m];
    // Every button bound to this modifier lights, wherever it lives.
    for (const el of document.querySelectorAll(`[data-mod="${m}"]`)) {
      el.setAttribute("aria-pressed", String(mods[m]));
    }
  });
}

// Iphone's own keyboard, mirrored
// Diff the field and send only what changed, so autocorrect and predictive
// text land on the Mac as they appear on the phone.
const native = $("native");
let mirror = "";
let nativeFocused = false;

native.addEventListener("focus", () => {
  native.value = ""; mirror = "";
  nativeFocused = true;
  document.body.dataset.nativeKeyboard = "yes";
  // Measure after the keyboard animation settles.
  setTimeout(liftAboveNativeKeyboard, 50);
  setTimeout(liftAboveNativeKeyboard, 350);
});
native.addEventListener("blur", () => {
  nativeFocused = false;
  document.body.dataset.nativeKeyboard = "no";
  kb.style.bottom = "";
  setTimeout(fitPadToKeyboard, 50);
});
native.addEventListener("input", () => {
  const cur = native.value;
  let i = 0;
  while (i < mirror.length && i < cur.length && mirror[i] === cur[i]) i++;
  const removed = mirror.length - i;
  const added = cur.slice(i);

  // A latched modifier plus a letter is a shortcut, not text.
  const held = activeMods();
  if (held.length && !removed && added.length === 1) {
    send({ t: "k", key: added.toLowerCase(), mod: held });
    clearMods();
    native.value = mirror;          // keep the shortcut out of the field
    return;
  }

  for (let n = 0; n < removed; n++) send({ t: "k", key: "delete" });
  if (added) send({ t: "txt", s: added });
  mirror = cur;
});
native.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send({ t: "k", key: "return" });
    native.value = ""; mirror = "";
  }
});

// Button wiring
// Fire on touchstart for latency; ignore the synthetic click iOS follows with.
function wire(selector, build) {
  for (const b of document.querySelectorAll(selector)) {
    let handled = 0;
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const payload = build(b);
      if (payload) send(payload);
    };
    b.addEventListener("touchstart", (e) => { handled = Date.now(); fire(e); }, { passive: false });
    b.addEventListener("click", (e) => { if (Date.now() - handled > 700) fire(e); else e.preventDefault(); });
  }
}
wire("[data-med]", (b) => ({ t: "med", k: b.dataset.med }));
wire("[data-click]", (b) => ({ t: "c", b: parseInt(b.dataset.click, 10), n: 1 }));
wire("[data-sys]", (b) => { runAction(b.dataset.sys); return null; });

// Delegated: key buttons are re-rendered when the layer or shift changes.
function hitFromEvent(e) {
  const c = e.target.closest("[data-chord]");
  if (c) return { chord: c.dataset.chord };
  const b = e.target.closest("[data-k]");
  if (b) return { key: b.dataset.k };
  return null;
}
const fire = (hit) => (hit.chord ? pressChord(hit.chord) : pressKey(hit.key));
let keyHandled = 0;
document.addEventListener("touchstart", (e) => {
  const hit = hitFromEvent(e);
  if (!hit) return;
  e.preventDefault(); e.stopPropagation();
  keyHandled = Date.now();
  fire(hit);
}, { passive: false, capture: true });
document.addEventListener("click", (e) => {
  const hit = hitFromEvent(e);
  if (!hit) return;
  e.preventDefault();
  if (Date.now() - keyHandled > 700) fire(hit);
}, true);

// App switcher
// Holding Command is what keeps the macOS switcher panel on screen.
let switching = false;

function setSwitching(on) {
  switching = on;
  $("swStart").innerHTML = on
    ? '<span class="cap">&#8984; held</span>'
    : '<span class="cap">Hold &#8984;&#8677;</span>';
  $("swStart").setAttribute("aria-pressed", String(on));
  for (const id of ["swPrev", "swNext", "swPick"]) $(id).disabled = !on;
}

function startSwitch() {
  if (switching) { send({ t: "k", key: "tab" }); return; }
  send({ t: "mod", m: "cmd", down: true });
  send({ t: "k", key: "tab" });
  setSwitching(true);
}

function endSwitch() {
  if (!switching) return;
  send({ t: "mod", m: "cmd", down: false });
  setSwitching(false);
}

$("swStart").addEventListener("click", startSwitch);
$("swNext").addEventListener("click", () => send({ t: "k", key: "tab" }));
$("swPrev").addEventListener("click", () => send({ t: "k", key: "tab", mod: ["shift"] }));
$("swPick").addEventListener("click", endSwitch);

function openApps() {
  closeKb(); setOpen(settings, false);
  setOpen(appsSheet, true);
  fitPad();
  send({ t: "apps" });
}
function closeApps() {
  endSwitch();                       // never leave ⌘ held behind
  setOpen(appsSheet, false);
  fitPad();
}
$("openApps").addEventListener("click", () => isOpen(appsSheet) ? closeApps() : openApps());
$("appsDone").addEventListener("click", closeApps);
$("appsRefresh").addEventListener("click", () => send({ t: "apps" }));

function renderApps(list) {
  const grid = $("appGrid"), empty = $("appEmpty");
  grid.innerHTML = "";
  if (!list || !list.length) { empty.textContent = "no apps found"; empty.style.display = ""; return; }
  empty.style.display = "none";
  for (const a of list) {
    const el = document.createElement("button");
    el.className = "app";
    el.type = "button";
    if (a.front) el.setAttribute("aria-current", "true");
    if (a.icon) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + a.icon;
      el.appendChild(img);
    }
    const label = document.createElement("span");
    label.textContent = a.name;
    el.appendChild(label);
    el.addEventListener("click", () => {
      endSwitch();
      send({ t: "activate", b: a.id });
      closeApps();
    });
    grid.appendChild(el);
  }
}

// Never leave Command held if the phone sleeps or navigates away.
const panic = () => { if (switching) { send({ t: "release" }); setSwitching(false); } };
window.addEventListener("pagehide", panic);
window.addEventListener("blur", panic);
document.addEventListener("visibilitychange", () => { if (document.hidden) panic(); });

// Keep the screen awake
let lock = null;
async function keepAwake() {
  if (!("wakeLock" in navigator)) return;
  try { lock = await navigator.wakeLock.request("screen"); } catch (e) {}
}
keepAwake();
document.addEventListener("visibilitychange", () => { if (!document.hidden && !lock) keepAwake(); });

window.addEventListener("resize", fitPadToKeyboard);
window.addEventListener("orientationchange", fitPadToKeyboard);

document.addEventListener("gesturestart", (e) => e.preventDefault());
$("appGrid").addEventListener("touchmove", (e) => e.stopPropagation(), { passive: true });
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
