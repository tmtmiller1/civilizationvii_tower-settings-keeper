// sko-perf.js - game scope. How long a write costs through the keeper with the player's real root (hundreds of KB),
// against the engine's own write of the same size and of a small value. Runs at game start. The runner restores
// the store afterwards.
const PHASE = "__PHASE__";
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function timed(n, fn) {
  const t = [];
  for (let i = 0; i < n; i++) { const a = now(); fn(i); t.push(now() - a); }
  t.sort((x, y) => x - y);
  const sum = t.reduce((x, y) => x + y, 0);
  return { n, totalMs: +sum.toFixed(1), medianMs: +t[Math.floor(n / 2)].toFixed(2), maxMs: +t[n - 1].toFixed(2) };
}
async function run() {
  const api = window.SettingsKeeper;
  if (!api) { emit("no keeper"); emit("DONE perf"); return; }
  const eng = api.engine;
  const rootText = eng.get("modSettings");
  emit("PERF " + PHASE + " root bytes=" + (rootText ? rootText.length : 0) + " rows=" + eng.length());
  emit("PERF stringify root x20: " + J(timed(20, () => JSON.stringify(JSON.parse(rootText)))));
  emit("PERF engine raw write of the full root x20 (same bytes back): " + J(timed(20, () => eng.set("modSettings", rootText))));
  emit("PERF engine raw write of 135 bytes x60 (own key, as AutoMissionary did): " + J(timed(60, (i) => eng.set("~perf-raw", "{\"autoSpread\":true,\"i\":" + i + "}"))));
  eng.remove("~perf-raw");
  emit("PERF keeper setItem own key, one value x60: " + J(timed(60, (i) => localStorage.setItem("perf-own", "v" + i))));
  emit("PERF keeper setItem 60 different 6 KB chunks (a chunked backup): " + J(timed(60, (i) => localStorage.setItem("perf-chunk-" + i, "x".repeat(6000)))));
  emit("PERF keeper getItem own key x200: " + J(timed(200, () => localStorage.getItem("perf-own"))));
  emit("PERF keeper getItem modSettings x200: " + J(timed(200, () => localStorage.getItem("modSettings"))));
  const helper = (i) => { const o = JSON.parse(localStorage.getItem("modSettings") || "{}"); o["perf-mod"] = { v: i }; localStorage.setItem("modSettings", JSON.stringify(o)); };
  emit("PERF ModOptions-style helper save (read+parse+stringify+write) x20: " + J(timed(20, helper)));
  for (let i = 0; i < 60; i++) localStorage.removeItem("perf-chunk-" + i);
  localStorage.removeItem("perf-own");
  emit("PERF end rows=" + eng.length() + " root bytes=" + eng.get("modSettings").length);
  emit("DONE perf");
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e)); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
