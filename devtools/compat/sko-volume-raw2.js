// sko-volume-raw2.js - game scope. Two more splits of the 14 MB hang. Phase A: raw engine writes that grow by 1 MB
// per step to 20 MB (the keeper's write pattern without the keeper), a log line before and after each. Phase B: the
// keeper itself with ONE 15 MB value (size without the many-keys shape), then 15 one-MB keys written in a single
// task (one flush). The last line printed names the hang. The runner restores the store afterwards.
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function ms(fn) { const a = now(); const r = fn(); return { ms: +(now() - a).toFixed(1), r }; }
function later(t) { return new Promise((r) => setTimeout(r, t)); }
const MB = 1024 * 1024;
async function run() {
  const api = window.SettingsKeeper;
  if (!api) { emit("no keeper"); emit("DONE raw2"); return; }
  const eng = api.engine;
  emit("RAW2 A: raw growth begin");
  for (let i = 1; i <= 20; i++) {
    const s = "x".repeat(i * MB + 530000);
    emit("RAW2 A " + i + " MB: set begin");
    const w = ms(() => safe(() => { eng.set("~vol-raw", s); return "ok"; }));
    emit("RAW2 A " + i + " MB: set " + w.ms + " ms " + w.r + " rows=" + safe(() => eng.length(), -1));
    await later(50);
  }
  safe(() => eng.remove("~vol-raw"));
  emit("RAW2 A done; B: keeper one 15 MB value begin");
  localStorage.setItem("big-one", "x".repeat(15 * MB));
  emit("RAW2 B: setItem ok, flush begin");
  const f = ms(() => safe(() => { api.flush(); return "ok"; }));
  emit("RAW2 B: flush " + f.ms + " ms " + f.r + " row=" + safe(() => eng.get("modSettings").length, -1));
  localStorage.removeItem("big-one"); api.flush();
  emit("RAW2 B removed; C: keeper 15 x 1 MB keys in one task begin");
  for (let i = 1; i <= 15; i++) localStorage.setItem("chunk-" + i, "x".repeat(MB));
  emit("RAW2 C: 15 setItem ok, flush begin");
  const g = ms(() => safe(() => { api.flush(); return "ok"; }));
  emit("RAW2 C: flush " + g.ms + " ms " + g.r + " row=" + safe(() => eng.get("modSettings").length, -1) + " chunk15ok=" + safe(() => localStorage.getItem("chunk-15").length === MB));
  emit("DONE raw2");
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e)); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
