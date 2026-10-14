// emb-common.js - shared body of emb-shell.js and emb-game.js (the runner prepends the scope and token).
// Each scope: wait for the page to settle, READ what the previous launch left (own keys, a modSettings slice, and one
// real setting per tower mod through that mod's own settings module), then WRITE new values tagged with this run's
// token, read them back in the same launch, and log everything on short "[EMB]" lines.
const TAG = "[EMB] " + SCOPE + " ";
function emit(m) { try { console.error(TAG + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? "ERR:" + e : fb; } }
const later = (ms) => new Promise((r) => setTimeout(r, ms));

// [name, module path, read(m), write(m, previous) -> value written]
const MODS = [
  ["canals", "/tower-canals/ui/canals-settings.js", (m) => m.getMode(),
    (m, v) => { const n = v === "one-tile" ? "ages" : "one-tile"; m.setMode(n); return n; }],
  ["cultural-diffusion", "/cultural-diffusion/ui/cd-settings.js", (m) => m.getRequireAdjacency(),
    (m, v) => { const n = !v; m.setRequireAdjacency(n); return n; }],
  ["emigration", "/emigration/ui/emigration-settings.js", (m) => m.getSnapshotInterval(),
    (m, v) => { const n = v === 3 ? 4 : 3; m.setSnapshotInterval(n); return n; }],
  ["geographic-labels", "/tmt-geographic-labels/ui/geo-labels-utils.js", (m) => (m.getGlobalSettings() || {}).flat,
    (m, v) => { const n = !v; m.setGlobalSettings({ flat: n }); return n; }],
  ["national-parks", "/tower-national-park/ui/np-settings.js", (m) => m.getMarks(),
    (m, v) => { const n = !v; m.setMarks(n); return n; }],
  ["universal-auto-explore", "/universal-auto-explore/ui/uae-settings.js", (m) => m.isClassEnabled("civilian"),
    (m, v) => { const n = !v; m.setClassEnabled("civilian", n); return n; }],
  ["demographics", "/demographics/ui/core/demographics-settings.js",
    (m) => (m.DemographicsSettings || m.default).getSetting("embToken", null),
    (m) => { (m.DemographicsSettings || m.default).setSetting("embToken", TOKEN); return TOKEN; }]
];

function keeperState() {
  const k = safe(() => window.SettingsKeeper, null);
  if (!k || typeof k !== "object") return { keeper: null };
  const s = safe(() => k.status(), {});
  return { build: k.build, origin: k.origin, root: s.rootKey, rows: s.rows, blocked: s.blocked, folded: s.folded,
    virtualKeys: s.virtualKeys, lengthShadowed: s.lengthShadowed, rawRows: safe(() => k.engine.length(), "?") };
}
function sliceRead() { return safe(() => (JSON.parse(localStorage.getItem("modSettings") || "{}") || {})["emb-probe"] || null); }
function sliceWrite(field, value) {
  const root = JSON.parse(localStorage.getItem("modSettings") || "{}") || {};
  (root["emb-probe"] ??= {})[field] = value;
  localStorage.setItem("modSettings", JSON.stringify(root));
}

async function loadMods() {
  const out = [];
  for (const [name, path, read, write] of MODS) {
    try { out.push({ name, m: await import(path), read, write }); } catch (_) { /* that mod is not loaded */ }
  }
  return out;
}

async function body() {
  emit("keeper " + J(keeperState()) + " length=" + safe(() => localStorage.length) + " key0=" + J(safe(() => localStorage.key(0))));
  emit("READ own-shell=" + J(safe(() => localStorage.getItem("emb-own-shell"))) +
    " own-game=" + J(safe(() => localStorage.getItem("emb-own-game"))) + " slice=" + J(sliceRead()));
  const mods = await loadMods();
  emit("mods present: " + J(mods.map((x) => x.name)));
  const before = {};
  for (const x of mods) { before[x.name] = safe(() => x.read(x.m)); emit("READ mod " + x.name + "=" + J(before[x.name])); }
  if (!WRITE) return;
  // writes: own key, shared slice, then each mod's own setting
  safe(() => localStorage.setItem("emb-own-" + SCOPE, TOKEN));
  safe(() => sliceWrite(SCOPE, TOKEN));
  for (const x of MODWRITE ? mods : []) {
    const w = safe(() => x.write(x.m, before[x.name]));
    emit("WROTE mod " + x.name + "=" + J(w) + " readback=" + J(safe(() => x.read(x.m))));
  }
  emit("WROTE own-" + SCOPE + "=" + J(TOKEN) + " readback=" + J(safe(() => localStorage.getItem("emb-own-" + SCOPE))) +
    " slice readback=" + J(sliceRead()));
  emit("keeper after " + J(keeperState()) + " length=" + safe(() => localStorage.length));
}
