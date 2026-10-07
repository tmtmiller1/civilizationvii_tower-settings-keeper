// sko-volume-raw.js - game scope. Splits the 14 MB hang. No keeper involvement: builds plain strings of the sizes
// around the hang and, with a log line before and after each, (1) JSON.stringify-s an object holding the string and
// (2) writes the string straight to the engine's own setItem under a scratch key, then reads it back and removes it.
// Whichever line is the last one printed names the half that hangs and the size. The runner restores the store.
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function ms(fn) { const a = now(); const r = fn(); return { ms: +(now() - a).toFixed(1), r }; }
function later(t) { return new Promise((r) => setTimeout(r, t)); }
const SIZES = [14161502, 14700000, 15210099, 16000000, 16777216, 17000000];
async function run() {
  const api = window.SettingsKeeper;
  const eng = api ? api.engine : { set: (k, v) => Storage.prototype.setItem.call(localStorage, k, v), get: (k) => Storage.prototype.getItem.call(localStorage, k), remove: (k) => Storage.prototype.removeItem.call(localStorage, k) };
  emit("RAW start keeper=" + !!api);
  for (const n of SIZES) {
    const s = "x".repeat(n);
    emit("RAW " + n + ": stringify begin");
    const st = ms(() => JSON.stringify({ a: s }).length);
    emit("RAW " + n + ": stringify " + st.ms + " ms -> " + st.r + " chars");
    emit("RAW " + n + ": engine set begin");
    const w = ms(() => safe(() => { eng.set("~vol-raw", s); return "ok"; }));
    emit("RAW " + n + ": engine set " + w.ms + " ms " + w.r);
    const back = ms(() => safe(() => eng.get("~vol-raw").length, -1));
    emit("RAW " + n + ": engine get " + back.ms + " ms -> " + back.r + " chars");
    safe(() => eng.remove("~vol-raw"));
    await later(100);
  }
  emit("DONE raw");
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e)); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
