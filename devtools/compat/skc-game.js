// skc-game.js - game scope. One phase per launch; the runner substitutes __PHASE__ and __PAIRS__.
//   A  report the keeper's state. The runner then harvests every "LOAD mod.option=value" line the other mods logged.
//   B  write a value for every harvested option through that mod's own settings module where it can be imported,
//      otherwise through the same read-modify-write the helper does. Write the own-key mods' settings through their
//      own code. Read everything back in the same launch.
//   C  read everything back after a restart. The other mods' own LOAD lines at start are the main evidence.
//   D  report the keeper's state on a seeded, poisoned store, and what AutoMissionary reads.
const PHASE = "__PHASE__";
const PAIRS = __PAIRS__; // [{mod, opt, cur}] ; opt null = a whole-slice helper (LOAD mod=json)
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const status = () => safe(() => (window.SettingsKeeper ? window.SettingsKeeper.status() : "NO KEEPER"));
const rawRows = () => safe(() => (window.SettingsKeeper ? window.SettingsKeeper.engine.length() : -1));

const HELPER_PATHS = {
  "sib-celebratory-celebrations": "/sib-celebratory-celebrations/ui/options/mod-options.js",
  "better-ribbon-info": "/better-ribbon-info/scripts/ui/options/mod-options.js",
  "wonders-screen-continued": "/wonders-screen-continued/code/mod-options-decorator.js"
};
const helpers = new Map();
async function helperFor(mod) {
  if (helpers.has(mod)) return helpers.get(mod);
  let h = null;
  for (const p of [HELPER_PATHS[mod], "/" + mod + "/ui/options/mod-options.js", "/" + mod + "/ui/mod-options.js"]) {
    if (!p) continue;
    try { const m = await import(p); if (m && m.default && typeof m.default.save === "function") { h = { mod: m.default, path: p }; break; } } catch (_) { /* next */ }
  }
  helpers.set(mod, h);
  return h;
}
// the read-modify-write every ModOptions helper does, for mods whose module could not be imported
function genericSave(mod, opt, value) {
  const options = JSON.parse(localStorage.getItem("modSettings") || "{}");
  if (opt == null) options[mod] = value; else { options[mod] ??= {}; options[mod][opt] = value; }
  localStorage.setItem("modSettings", JSON.stringify(options));
}
function genericLoad(mod, opt) {
  const s = localStorage.getItem("modSettings"); if (!s) return undefined;
  const o = JSON.parse(s); return opt == null ? o[mod] : (o[mod] || {})[opt];
}
function valueFor(cur) {
  if (cur === undefined || cur === null || cur === "undefined" || cur === "null" || cur === "") return true;
  if (cur === "true") return true; if (cur === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(cur)) return Number(cur);
  try { const o = JSON.parse(cur); if (o && typeof o === "object") return o; } catch (_) { /* string */ }
  return cur;
}

async function ownKeyMods(write) {
  const out = {};
  const am = safe(() => globalThis.AutoMissionarySettings, null);
  if (am && typeof am.get === "function") {
    if (write) safe(() => am.set({ autoSpread: true, showDockButton: true }));
    out.AutoMissionary = { api: safe(() => am.get()), raw: safe(() => localStorage.getItem("AutoMissionary.settings.v2")) };
  } else out.AutoMissionary = "no AutoMissionarySettings global";
  const mods = [
    ["compact-policy-cards", "/tmt-compact-policy-cards/ui/compact-cards-utils.js", (m) => m.setGlobalSettings({ skc: "B" }), (m) => m.getGlobalSettings()],
    ["canals", "/tower-canals/ui/canals-settings.js", (m) => m.setMode("one-tile"), (m) => m.getMode()],
    ["cultural-diffusion", "/cultural-diffusion/ui/cd-settings.js", (m) => m.setClaimOnlyUnowned(true), (m) => m.getClaimOnlyUnowned()],
    ["emigration", "/emigration/ui/emigration-settings.js", (m) => m.setShowDockButton(true), (m) => m.getShowDockButton()],
    ["geographic-labels", "/tmt-geographic-labels-dev/ui/geo-labels-utils.js", (m) => m.setGlobalSettings({ skc: "B" }), (m) => m.getGlobalSettings()]
  ];
  for (const [name, path, set, get] of mods) {
    try {
      const m = await import(path);
      if (write) safe(() => set(m));
      out[name] = safe(() => get(m));
    } catch (e) { out[name] = "import failed: " + String(e).slice(0, 80); }
  }
  return out;
}

async function phaseA() {
  emit("A keeper=" + J(status()) + " rawRows=" + rawRows() + " length=" + localStorage.length + " key0=" + J(localStorage.key(0)));
  emit("A own-key mods read: " + J(await ownKeyMods(false)));
}
async function phaseB() {
  emit("B keeper before=" + J(status()));
  const written = {};
  for (const p of PAIRS) {
    const value = p.opt == null ? (valueFor(p.cur) && typeof valueFor(p.cur) === "object" ? valueFor(p.cur) : { skc: true }) : valueFor(p.cur);
    const h = await helperFor(p.mod);
    let how = "generic";
    if (h) { how = "real:" + h.path; safe(() => (p.opt == null ? h.mod.save(p.mod, value) : h.mod.save(p.mod, p.opt, value))); }
    else safe(() => genericSave(p.mod, p.opt, value));
    const back = h && typeof h.mod.load === "function" ? safe(() => (p.opt == null ? h.mod.load(p.mod) : h.mod.load(p.mod, p.opt))) : safe(() => genericLoad(p.mod, p.opt));
    written[p.mod + (p.opt == null ? "" : "." + p.opt)] = value;
    emit("B wrote " + p.mod + (p.opt == null ? "" : "." + p.opt) + "=" + J(value) + " via " + how + "; readback=" + J(back));
  }
  emit("B own-key mods written: " + J(await ownKeyMods(true)));
  emit("B VALUES " + J(written));
  emit("B keeper after=" + J(status()) + " rawRows=" + rawRows() + " length=" + localStorage.length);
}
async function phaseC() {
  emit("C keeper=" + J(status()) + " rawRows=" + rawRows() + " length=" + localStorage.length);
  for (const p of PAIRS) {
    const h = await helperFor(p.mod);
    const back = h && typeof h.mod.load === "function" ? safe(() => (p.opt == null ? h.mod.load(p.mod) : h.mod.load(p.mod, p.opt))) : safe(() => genericLoad(p.mod, p.opt));
    emit("C read " + p.mod + (p.opt == null ? "" : "." + p.opt) + "=" + J(back) + (h ? " via real" : " via generic"));
  }
  emit("C own-key mods read: " + J(await ownKeyMods(false)));
}
async function phaseD() {
  emit("D keeper=" + J(status()) + " rawRows=" + rawRows() + " length=" + localStorage.length);
  emit("D modSettings view keys=" + J(safe(() => Object.keys(JSON.parse(localStorage.getItem("modSettings") || "{}")))));
  emit("D own-key mods read: " + J(await ownKeyMods(false)));
}

async function run() {
  emit("START phase " + PHASE + " turn=" + safe(() => Game.turn) + " pairs=" + PAIRS.length);
  if (PHASE === "A") await phaseA(); else if (PHASE === "B") await phaseB(); else if (PHASE === "C") await phaseC(); else await phaseD();
  emit("DONE phase " + PHASE);
}
emit("attached phase " + PHASE + "; keeper at module time=" + J(status()));
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e + " " + (e && e.stack))); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
