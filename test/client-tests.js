// Runs web/index.html's inline script against a stub DOM and asserts the
// exact protocol messages each gesture produces.
const fs = require("fs");
const script = fs.readFileSync("web/app.js", "utf8");

let sent = [];
let rafQueue = [];
let now = 1000;
let timers = [];
let timerId = 0;

// Advancing the virtual clock fires any timer that has come due, so the
// client's deferred drag behaves the way it would in a browser.
function advance(dt) {
  const target = now + (dt || 0);
  for (;;) {
    const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter((t) => t !== due);
    now = due.at;
    due.fn();
  }
  now = target;
}

function mkEl(id) {
  const el = {
    id, textContent: "", innerHTML: "", value: "", style: {}, disabled: false, src: "",
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    type: "",
    dataset: {}, children: [], listeners: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    appendChild(c) { this.children.push(c); },
    querySelectorAll() { return []; },
    blur() {}, focus() {},
    closest(sel) {
      const m = sel.match(/^\[data-(.+)\]$/);
      if (m) {
        const k = m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
        return this.dataset[k] !== undefined ? this : null;
      }
      return null;
    },
    dispatch(type, ev) { for (const fn of this.listeners[type] || []) fn(ev); },
  };
  // Setting className must populate classList, as it does in a real browser.
  Object.defineProperty(el, "className", {
    get() { return [...el.classList._s].join(" "); },
    set(v) { el.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

const els = {};
const getEl = (id) => (els[id] ||= mkEl(id));

const modButtons = ["cmd", "ctrl", "opt", "shift"].map((m) => {
  const b = mkEl("mod-" + m); b.dataset.mod = m; return b;
});

const document = {
  listeners: {},
  body: mkEl("body"),
  getElementById: getEl,
  createElement: () => mkEl("gen"),
  addEventListener(t, fn, opts) { (this.listeners[t] ||= []).push({ fn, opts }); },
  querySelectorAll(sel) {
    if (sel === "[data-mod]") return modButtons;
    const m = sel.match(/^\[data-mod="(\w+)"\]$/);
    if (m) return modButtons.filter((b) => b.dataset.mod === m[1]);
    return [];
  },
  querySelector(sel) {
    if (sel.startsWith("meta")) return { content: "test-token" };
    return null;
  },
  hidden: false,
  dispatch(type, ev) { for (const h of this.listeners[type] || []) h.fn(ev); },
};

let wsInstance = null;
class WebSocket {
  constructor() { wsInstance = this; this.readyState = 1; }
  send(s) { sent.push(JSON.parse(s)); }
  close() {}
}

const sandbox = {
  document,
  WebSocket,
  location: { host: "127.0.0.1:8765" },
  navigator: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  performance: { now: () => now },
  requestAnimationFrame: (fn) => rafQueue.push(fn),
  setTimeout: (fn, ms) => { const id = ++timerId; timers.push({ id, at: now + (ms || 0), fn }); return id; },
  clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  console,
};
sandbox.addEventListener = () => {};
sandbox.window = sandbox;

const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
// The real browser fires onopen after the client assigns its handler.
if (!wsInstance) { console.error("client never opened a socket"); process.exit(2); }
wsInstance.onopen();

function flushRaf() { const q = rafQueue; rafQueue = []; for (const fn of q) fn(); }

const pad = getEl("pad");
const kb = getEl("kb");
function touch(id, x, y) { return { identifier: id, clientX: x, clientY: y }; }

// A real browser reports every finger currently on the glass in e.touches.
let live = new Map();
function ev(type, changed, all) {
  if (all) { live = new Map(all.map((t) => [t.identifier, t])); }
  else if (type === "touchstart" || type === "touchmove") {
    for (const t of changed) live.set(t.identifier, t);
  } else {
    for (const t of changed) live.delete(t.identifier);
  }
  return { type, changedTouches: changed, touches: [...live.values()],
           preventDefault() {}, stopPropagation() {} };
}
function loseTouch(id) { live.delete(id); }   // browser stops reporting it, no touchend

function reset() { sent = []; rafQueue = []; timers = []; live = new Map(); lastTapClear(); }
// Each scenario starts fresh: clear any tap history left by the previous one.
function lastTapClear() { advance(2000); }
function padSeq(steps) {
  reset();
  for (const [type, changed, all, dt] of steps) {
    advance(dt || 0);
    pad.dispatch(type, ev(type, changed, all));
    flushRaf();
  }
  return sent;
}

let fails = 0;
function check(name, cond, detail) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) { fails++; if (detail !== undefined) console.log("        got:", JSON.stringify(detail)); }
}

console.log("\n=== pointer ===");
let out = padSeq([
  ["touchstart", [touch(1, 100, 100)], null, 0],
  ["touchmove",  [touch(1, 140, 120)], null, 16],
  ["touchend",   [touch(1, 140, 120)], [],   16],
]);
let moves = out.filter((m) => m.t === "m");
check("one finger produces a move", moves.length === 1 && moves[0].x > 0 && moves[0].y > 0, out);
check("a long slide is not treated as a click", !out.some((m) => m.t === "c"), out);

console.log("\n=== acceleration is sampling-rate independent ===");
// The same physical swipe, sampled at two different rates, must move the
// pointer the same distance. Per-event acceleration failed this, which is what
// made movement feel uneven.
function swipeAtRate(steps, pxPerStep, msPerStep) {
  reset();
  let y = 400;
  pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, y)]));
  for (let i = 0; i < steps; i++) {
    advance(msPerStep);
    y -= pxPerStep;
    pad.dispatch("touchmove", ev("touchmove", [touch(1, 100, y)]));
    flushRaf();
  }
  pad.dispatch("touchend", ev("touchend", [touch(1, 100, y)], []));
  flushRaf();
  return sent.filter((m) => m.t === "m").reduce((a, m) => a + Math.abs(m.y), 0);
}
const fast120 = swipeAtRate(10, 10, 8);    // 100px over 80ms at 120Hz
const fast60  = swipeAtRate(5, 20, 16);    // 100px over 80ms at 60Hz
const spread  = Math.abs(fast120 - fast60) / Math.max(fast120, fast60);
check("120Hz and 60Hz sampling move the pointer the same distance",
  spread < 0.12, { fast120: Math.round(fast120), fast60: Math.round(fast60),
                   spreadPct: Math.round(spread * 100) });

// A slow drag must stay precise; a fast flick must cover more ground.
const slow = swipeAtRate(10, 2, 16);       // 20px over 160ms
const quick = swipeAtRate(10, 20, 8);      // 200px over 80ms
check("a fast flick still accelerates more than a slow drag",
  quick / 200 > slow / 20 * 1.5, { slowGain: +(slow / 20).toFixed(2),
                                   quickGain: +(quick / 200).toFixed(2) });

console.log("\n=== taps ===");
out = padSeq([
  ["touchstart", [touch(1, 100, 100)], null, 0],
  ["touchend",   [touch(1, 101, 100)], [],   60],
]);
check("1-finger tap = left click", JSON.stringify(out) === JSON.stringify([{ t: "c", b: 0, n: 1 }]), out);

out = padSeq([
  ["touchstart", [touch(1, 100, 100)], null, 0],
  ["touchstart", [touch(2, 140, 100)], null, 10],
  ["touchend",   [touch(1, 100, 100), touch(2, 140, 100)], [], 60],
]);
check("2-finger tap = right click", out.some((m) => m.t === "c" && m.b === 1), out);

out = padSeq([
  ["touchstart", [touch(1, 100, 100)], null, 0],
  ["touchstart", [touch(2, 140, 100)], null, 8],
  ["touchstart", [touch(3, 180, 100)], null, 8],
  ["touchend",   [touch(1, 100, 100), touch(2, 140, 100), touch(3, 180, 100)], [], 60],
]);
check("3-finger tap = middle click", out.some((m) => m.t === "c" && m.b === 2), out);

console.log("\n=== scroll ===");
out = padSeq([
  ["touchstart", [touch(1, 100, 200)], null, 0],
  ["touchstart", [touch(2, 140, 200)], null, 8],
  ["touchmove",  [touch(1, 100, 240), touch(2, 140, 240)], null, 16],
  ["touchend",   [touch(1, 100, 240), touch(2, 140, 240)], [], 16],
]);
const scrolls = out.filter((m) => m.t === "s");
check("2 fingers scroll, not move", scrolls.length >= 1 && !out.some((m) => m.t === "m"), out);
check("dragging down scrolls down (natural)", scrolls[0] && scrolls[0].y > 0, scrolls[0]);

console.log("\n=== 3-finger gestures ===");
function swipe(n, dx, dy) {
  const start = [];
  for (let i = 1; i <= n; i++) start.push(touch(i, 100 + i * 40, 250));
  const steps = [];
  for (let i = 0; i < n; i++) steps.push(["touchstart", [start[i]], null, 6]);
  const moved = start.map((t) => touch(t.identifier, t.clientX + dx, t.clientY + dy));
  steps.push(["touchmove", moved, null, 16]);
  steps.push(["touchend", moved, [], 16]);
  return padSeq(steps);
}
// A gesture now fires a real chord: modifier down, key, modifier up.
function firedChord(out, key, mod) {
  const k = out.find((m) => m.t === "k" && m.key === key);
  if (!k) return false;
  if (!mod) return !out.some((m) => m.t === "mod");
  const down = out.find((m) => m.t === "mod" && m.m === mod && m.down === true);
  const up = out.find((m) => m.t === "mod" && m.m === mod && m.down === false);
  return !!down && !!up && out.indexOf(down) < out.indexOf(k) && out.indexOf(k) < out.indexOf(up);
}
out = swipe(3, 0, -90);
check("3 up asks the server to open Mission Control",
  out.some((m) => m.t === "sys" && m.a === "mission"), out);
out = swipe(3, 0, 90);
check("3 down = App windows (ctrl+down)", firedChord(out, "down", "ctrl"), out);
out = swipe(3, -90, 0);
check("3 left = previous space (ctrl+left)", firedChord(out, "left", "ctrl"), out);
out = swipe(3, 90, 0);
check("3 right = next space (ctrl+right)", firedChord(out, "right", "ctrl"), out);
out = swipe(4, 0, -90);
check("4 up = Show Desktop (f11)", firedChord(out, "f11", null), out);

out = swipe(3, 0, -20);
check("a small 3-finger wobble fires nothing",
  !out.some((m) => m.t === "k" || m.t === "mod" || m.t === "sys"), out);

out = swipe(3, 0, -90);
check("a gesture fires exactly once",
  out.filter((m) => m.t === "k" || m.t === "sys").length === 1, out);
check("the modifier is always released again",
  out.filter((m) => m.t === "mod" && m.down).length ===
  out.filter((m) => m.t === "mod" && !m.down).length, out);
check("a gesture sends no cursor movement", !out.some((m) => m.t === "m" || m.t === "s"), out);

console.log("\n=== three-finger feedback ===");
const flashEl = getEl("flash");
reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, 300)]));
advance(6);
pad.dispatch("touchstart", ev("touchstart", [touch(2, 150, 300)]));
advance(6);
check("two fingers down shows no gesture hint", flashEl.dataset.show !== "hint");
pad.dispatch("touchstart", ev("touchstart", [touch(3, 200, 300)]));
check("three fingers down confirms the fingers registered",
  flashEl.dataset.show === "hint" && /3 fingers/.test(flashEl.textContent),
  { show: flashEl.dataset.show, text: flashEl.textContent });
pad.dispatch("touchend", ev("touchend",
  [touch(1, 100, 300), touch(2, 150, 300), touch(3, 200, 300)], []));
flushRaf();
check("lifting clears the hint", flashEl.dataset.show !== "hint", flashEl.dataset.show);

// The threshold dropped to 42px, so a swipe that used to be too short now fires.
out = swipe(3, 0, -50);
check("a 50px three-finger swipe up now fires Mission Control",
  out.some((m) => m.t === "sys" && m.a === "mission"), out);
out = swipe(3, 0, -20);
check("a 20px wobble still fires nothing",
  !out.some((m) => m.t === "k" || m.t === "mod" || m.t === "sys"), out);

console.log("\n=== tap-then-hold drag ===");
reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, 100)]));
advance(60);
pad.dispatch("touchend", ev("touchend", [touch(1, 100, 100)], []));
advance(100);                                 // inside the drag window
pad.dispatch("touchstart", ev("touchstart", [touch(2, 100, 100)]));
advance(80);                                  // past DRAG_ARM_MS, drag commits
pad.dispatch("touchmove", ev("touchmove", [touch(2, 160, 100)]));
flushRaf();
advance(16);
pad.dispatch("touchend", ev("touchend", [touch(2, 160, 100)], []));
flushRaf();
check("tap then hold sends mouse-down, move, mouse-up",
  sent.some((m) => m.t === "d" && m.b === 0) &&
  sent.some((m) => m.t === "m") &&
  sent.some((m) => m.t === "u" && m.b === 0), sent);

console.log("\n=== regressions: click then multi-touch ===");
reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, 100)]));
advance(50);
pad.dispatch("touchend", ev("touchend", [touch(1, 100, 100)], []));
advance(90);                                  // right-click soon after a click
pad.dispatch("touchstart", ev("touchstart", [touch(2, 100, 100)], [touch(2, 100, 100)]));
advance(10);
pad.dispatch("touchstart", ev("touchstart", [touch(3, 150, 100)]));
advance(50);
pad.dispatch("touchend", ev("touchend", [touch(2, 100, 100), touch(3, 150, 100)], []));
flushRaf();
check("click then quick 2-finger tap still right-clicks",
  sent.some((m) => m.t === "c" && m.b === 1) && !sent.some((m) => m.t === "d"), sent);

reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, 200)]));
advance(50);
pad.dispatch("touchend", ev("touchend", [touch(1, 100, 200)], []));
advance(90);                                  // scroll soon after a click
pad.dispatch("touchstart", ev("touchstart", [touch(2, 100, 200)], [touch(2, 100, 200)]));
advance(10);
pad.dispatch("touchstart", ev("touchstart", [touch(3, 150, 200)]));
advance(16);
pad.dispatch("touchmove", ev("touchmove", [touch(2, 100, 260), touch(3, 150, 260)]));
flushRaf();
pad.dispatch("touchend", ev("touchend", [touch(2, 100, 260), touch(3, 150, 260)], []));
flushRaf();
check("click then quick 2-finger scroll does not drag-select",
  sent.some((m) => m.t === "s") && !sent.some((m) => m.t === "d"), sent);

reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 100, 100)]));
advance(50);
pad.dispatch("touchend", ev("touchend", [touch(1, 100, 100)], []));
advance(90);
pad.dispatch("touchstart", ev("touchstart", [touch(2, 100, 100)]));
advance(40);                                  // lifts before the drag arms
pad.dispatch("touchend", ev("touchend", [touch(2, 100, 100)], []));
flushRaf();
const clicks = sent.filter((m) => m.t === "c");
check("double-tap sends a real double-click",
  clicks.length === 2 && clicks[0].n === 1 && clicks[1].n === 2, sent);

console.log("\n=== on-screen keyboard ===");
function keyTap(k) {
  const b = mkEl("k"); b.dataset.k = k;
  document.dispatch("touchstart", { type: "touchstart", target: b,
    changedTouches: [], touches: [], preventDefault() {}, stopPropagation() {} });
}
reset();
keyTap("a");
check("plain key sends no modifiers",
  sent.length === 1 && sent[0].t === "k" && sent[0].key === "a" && sent[0].mod.length === 0, sent);

reset();
modButtons[0].dispatch("click", { preventDefault() {} });   // ⌘
keyTap("c");
check("⌘ then C sends cmd+c",
  sent.length === 1 && sent[0].key === "c" && sent[0].mod.includes("cmd"), sent);

reset();
keyTap("v");
check("modifier is sticky for one key only",
  sent.length === 1 && sent[0].mod.length === 0, sent);

reset();
modButtons[1].dispatch("click", { preventDefault() {} });   // ⌃
modButtons[3].dispatch("click", { preventDefault() {} });   // ⇧
keyTap("up");
check("two modifiers combine (ctrl+shift+up)",
  sent.length === 1 && sent[0].key === "up" &&
  sent[0].mod.includes("ctrl") && sent[0].mod.includes("shift"), sent);

console.log("\n=== iPhone keyboard mirroring ===");
const native = getEl("native");
reset();
native.dispatch("focus", {});
native.value = "hel";
native.dispatch("input", {});
native.value = "hello";
native.dispatch("input", {});
check("typing sends only the new characters",
  sent.length === 2 && sent[0].s === "hel" && sent[1].s === "lo", sent);

reset();
native.value = "hell";                 // one backspace
native.dispatch("input", {});
check("backspace sends a delete key",
  sent.length === 1 && sent[0].t === "k" && sent[0].key === "delete", sent);

reset();
native.value = "hello there";          // autocorrect-style replacement
native.dispatch("input", {});
check("appending after a delete works", sent.some((m) => m.t === "txt"), sent);


function runSwipe3Up() { return swipe(3, 0, -90); }

console.log("\n=== scroll -> pointer leap (the big one) ===");
reset();
// Two-finger scroll upward, then one finger lifts while the other keeps going.
pad.dispatch("touchstart", ev("touchstart", [touch(1, 200, 600)]));
advance(8);
pad.dispatch("touchstart", ev("touchstart", [touch(2, 260, 600)]));
advance(16);
for (let y = 560; y >= 320; y -= 40) {
  pad.dispatch("touchmove", ev("touchmove", [touch(1, 200, y), touch(2, 260, y)]));
  flushRaf();
  advance(16);
}
const mark = sent.length;                 // ignore the scroll packets themselves
pad.dispatch("touchend", ev("touchend", [touch(2, 260, 320)]));   // one finger up
advance(16);
pad.dispatch("touchmove", ev("touchmove", [touch(1, 200, 310)]));  // other drifts 10px
flushRaf();
advance(16);
pad.dispatch("touchmove", ev("touchmove", [touch(1, 200, 300)]));
flushRaf();
pad.dispatch("touchend", ev("touchend", [touch(1, 200, 300)], []));
flushRaf();
const leap = sent.slice(mark).filter((m) => m.t === "m");
const worst = leap.reduce((a, m) => Math.max(a, Math.abs(m.y)), 0);
check("lifting one finger mid-scroll does not fling the pointer",
  worst < 120, { worst, leap });

console.log("\n=== ghost finger (lost touchend) ===");
reset();
// A finger lands, then the browser stops reporting it without ever firing
// touchend - a system gesture stealing the sequence does exactly this.
pad.dispatch("touchstart", ev("touchstart", [touch(99, 50, 400)]));
loseTouch(99);
advance(100);
// Now an ordinary one-finger tap.
pad.dispatch("touchstart", ev("touchstart", [touch(1, 200, 300)]));
advance(50);
pad.dispatch("touchend", ev("touchend", [touch(1, 200, 300)]));
flushRaf();
check("a stale finger cannot turn a tap into a right click",
  sent.some((m) => m.t === "c" && m.b === 0) && !sent.some((m) => m.t === "c" && m.b === 1), sent);

console.log("\n=== late second finger ===");
reset();
pad.dispatch("touchstart", ev("touchstart", [touch(1, 200, 300)]));
advance(200);                             // a thumb brushes well after the tap finger
pad.dispatch("touchstart", ev("touchstart", [touch(2, 240, 300)]));
advance(40);
pad.dispatch("touchend", ev("touchend", [touch(1, 200, 300), touch(2, 240, 300)], []));
flushRaf();
check("a finger landing late does not make it a right click",
  !sent.some((m) => m.t === "c" && m.b === 1), sent);

console.log("\n=== system actions use the right mechanism ===");
reset();
const down3 = swipe(3, 0, 90);
const seq = down3.filter((m) => m.t === "mod" || m.t === "k");
check("a shortcut-backed gesture presses ctrl, sends the key, releases ctrl",
  seq.length === 3 &&
  seq[0].t === "mod" && seq[0].m === "ctrl" && seq[0].down === true &&
  seq[1].t === "k" && seq[1].key === "down" &&
  seq[2].t === "mod" && seq[2].m === "ctrl" && seq[2].down === false, down3);

reset();
const up3 = runSwipe3Up();
check("Mission Control is delegated to the server, not sent as a keystroke",
  up3.length === 1 && up3[0].t === "sys" && up3[0].a === "mission", up3);

console.log("\n=== iPhone keyboard overlay mode ===");
getEl("openKb").dispatch("click", {});          // open the panel
reset();
native.dispatch("focus", {});
check("focusing the field collapses our keyboard away",
  document.body.dataset.nativeKeyboard === "yes");

reset();
modButtons[0].dispatch("click", { preventDefault() {} });   // latch ⌘
native.value = "c";
native.dispatch("input", {});
check("⌘ + a letter on the iPhone keyboard sends a shortcut, not text",
  sent.length === 1 && sent[0].t === "k" && sent[0].key === "c" &&
  sent[0].mod.includes("cmd"), sent);
check("the shortcut letter is kept out of the text field", native.value === "");

reset();
native.value = "hi";
native.dispatch("input", {});
check("plain typing still mirrors as text",
  sent.length === 1 && sent[0].t === "txt" && sent[0].s === "hi", sent);

reset();
getEl("kbDone").dispatch("click", {});
check("Done dismisses the iPhone keyboard but keeps the panel open",
  kb.dataset.open === "yes");
native.dispatch("blur", {});
check("blurring restores our keyboard",
  document.body.dataset.nativeKeyboard !== "yes");
getEl("kbDone").dispatch("click", {});
check("a second Done closes the panel", kb.dataset.open !== "yes");

console.log("\n=== app switcher ===");
reset();
getEl("openApps").dispatch("click", {});
check("opening the apps sheet requests the app list",
  sent.some((m) => m.t === "apps"), sent);

reset();
getEl("swStart").dispatch("click", {});
check("starting the switcher holds ⌘ down then taps tab",
  sent.length === 2 &&
  sent[0].t === "mod" && sent[0].m === "cmd" && sent[0].down === true &&
  sent[1].t === "k" && sent[1].key === "tab", sent);

reset();
getEl("swNext").dispatch("click", {});
check("next steps forward with ⌘ still held",
  sent.length === 1 && sent[0].key === "tab" && !sent.some((m) => m.t === "mod"), sent);

reset();
getEl("swPrev").dispatch("click", {});
check("previous steps backward (shift+tab)",
  sent.length === 1 && sent[0].key === "tab" && sent[0].mod.includes("shift"), sent);

reset();
getEl("swPick").dispatch("click", {});
check("picking releases ⌘",
  sent.length === 1 && sent[0].t === "mod" && sent[0].m === "cmd" && sent[0].down === false, sent);

reset();
getEl("swStart").dispatch("click", {});      // hold again
reset();
getEl("appsDone").dispatch("click", {});
check("closing the sheet while switching releases ⌘",
  sent.some((m) => m.t === "mod" && m.down === false), sent);

reset();
getEl("swStart").dispatch("click", {});
reset();
document.dispatch("visibilitychange", {});   // phone still visible: hold stays
check("staying on screen keeps ⌘ held", sent.length === 0, sent);
document.hidden = true;
reset();
document.dispatch("visibilitychange", {});
check("phone sleeping releases ⌘ (no stuck modifier)",
  sent.some((m) => m.t === "release"), sent);
document.hidden = false;

console.log("\n=== app grid ===");
reset();
wsInstance.onmessage({ data: JSON.stringify({ t: "apps", apps: [
  { name: "Safari", id: "com.apple.Safari", front: true, icon: "AAAA" },
  { name: "Music", id: "com.apple.Music", front: false },
]})});
const grid = getEl("appGrid");
check("the grid renders one tile per app", grid.children.length === 2, grid.children.length);
check("the frontmost app is highlighted",
  grid.children[0].getAttribute("aria-current") === "true" && !grid.children[1].getAttribute("aria-current"));
reset();
grid.children[1].dispatch("click", {});
check("tapping an app activates it",
  sent.some((m) => m.t === "activate" && m.b === "com.apple.Music"), sent);

console.log(`\n${fails === 0 ? "ALL CLIENT TESTS PASSED" : fails + " CLIENT TEST(S) FAILED"}`);
process.exit(fails ? 1 : 0);
