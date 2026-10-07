// sko-burst.js - shell scope. Many small keys at once: 2000 setItem calls in one task (one flush), then 200 more
// each in its own task (200 flushes), then a read-back. The cost of a mod that stores many small values.
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function ms(fn) { const a = now(); const r = fn(); return { ms: +(now() - a).toFixed(1), r }; }
setTimeout(async () => {
  try {
    const api = window.SettingsKeeper;
    emit("BURST start rowBytes=" + api.status().rowBytes);
    const loop = ms(() => { for (let k = 0; k < 2000; k++) localStorage.setItem("many-" + k, "v" + k); });
    const flush = ms(() => api.flush());
    emit("BURST 2000 keys in one task: setItem loop " + loop.ms + " ms, flush " + flush.ms + " ms, many-1999=" + J(localStorage.getItem("many-1999")) + " keys=" + api.status().virtualKeys.length + " rowBytes=" + api.status().rowBytes);
    let total = 0;
    for (let k = 0; k < 200; k++) { const t = ms(() => { localStorage.setItem("solo-" + k, "w" + k); api.flush(); }); total += t.ms; }
    emit("BURST 200 keys each in its own task (200 flushes): total " + total.toFixed(1) + " ms, per write " + (total / 200).toFixed(2) + " ms");
    const read = ms(() => { let n = 0; for (let k = 0; k < 2000; k++) if (localStorage.getItem("many-" + k) === "v" + k) n++; return n; });
    emit("BURST read back 2000 keys: " + read.r + " correct in " + read.ms + " ms; engine rows=" + api.engine.length());
    for (let k = 0; k < 2000; k++) localStorage.removeItem("many-" + k);
    for (let k = 0; k < 200; k++) localStorage.removeItem("solo-" + k);
    api.flush();
    emit("BURST removed all: keys=" + api.status().virtualKeys.length + " rowBytes=" + api.status().rowBytes);
    emit("DONE burst");
  } catch (e) { emit("shell threw " + e); emit("DONE shell error"); }
}, 20000);
