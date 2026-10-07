// sko-volume-quiet.js - game scope. The growth loop of sko-volume.js with the read-back churn removed: one keeper
// write and one flush per step, nothing read back until the end. How the one row behaves as it grows. Starting from the player's real root, it adds
// 1 MB chunks through the keeper and, after each step, times one flush (serialise plus engine write), one small-key
// read, one raw engine read of the row, and checks the first chunk reads back unchanged. It stops at __PHASE__ MB,
// when a write throws, or when a flush passes 3 s. Then it writes 2000 small keys and times that. The runner restores
// the store afterwards; a second launch seeded from this run's store measures start-up on the big row.
const LIMIT_MB = Number("__PHASE__") || 64;
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function ms(fn) { const a = now(); const r = fn(); return { ms: +(now() - a).toFixed(1), r }; }
async function run() {
  const api = window.SettingsKeeper;
  if (!api) { emit("no keeper"); emit("DONE volume"); return; }
  const eng = api.engine;
  const chunk = "x".repeat(1024 * 1024);
  emit("VOLUME start root bytes=" + eng.get("modSettings").length + " rows=" + eng.length() + " limit=" + LIMIT_MB + " MB");
  for (let i = 1; i <= LIMIT_MB; i++) {
    let failed = null;
    emit("VOLUME " + i + " MB: begin");
    try { localStorage.setItem("volume-chunk-" + i, chunk); } catch (e) { failed = String(e); }
    emit("VOLUME " + i + " MB: setItem " + (failed || "ok"));
    const flush = ms(() => { try { api.flush(); return "ok"; } catch (e) { return "ERR " + e; } });
    emit("VOLUME " + i + " MB: flushed " + flush.ms + " ms");
    emit("VOLUME " + i + " MB: write " + (failed || "ok") + " flush " + flush.ms + " ms (" + flush.r + ")");
    if (failed || flush.ms > 3000) { emit("VOLUME stop at " + i + " MB"); break; }
    await later(50);
  }
  const many = ms(() => { for (let k = 0; k < 2000; k++) localStorage.setItem("many-" + k, "v" + k); });
  const manyFlush = ms(() => api.flush());
  emit("VOLUME 2000 small keys: setItem loop " + many.ms + " ms, flush " + manyFlush.ms + " ms, readback many-1999=" + J(localStorage.getItem("many-1999")) + " keys=" + api.status().virtualKeys.length);
  emit("VOLUME end root bytes=" + eng.get("modSettings").length + " rows=" + eng.length() + " chunk1ok=" + (localStorage.getItem("volume-chunk-1") === chunk) + " chunkLastOk=" + (localStorage.getItem("volume-chunk-" + LIMIT_MB) === chunk));
  emit("DONE volume");
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e)); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
