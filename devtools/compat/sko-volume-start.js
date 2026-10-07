// sko-volume-start.js - game scope. Second launch of the volume test, seeded with the big row the first launch left
// behind. Reports whether the keeper came up on it, that the chunks and the player's slices read back, and how long a
// parse, a small read and a flush take on the big row. The runner restores the store afterwards.
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
function ms(fn) { const a = now(); const r = fn(); return { ms: +(now() - a).toFixed(1), r }; }
function run() {
  const api = window.SettingsKeeper;
  if (!api) { emit("no keeper"); emit("DONE volume-start"); return; }
  const eng = api.engine;
  const st = api.status();
  emit("VSTART root bytes=" + eng.get("modSettings").length + " rows=" + eng.length() + " status=" + J({ rootKey: st.rootKey, rows: st.rows, slices: st.slices.length, keys: st.virtualKeys.length, blocked: st.blocked }));
  const chunk = "x".repeat(1024 * 1024);
  let chunks = 0; let bad = 0;
  for (let i = 1; i <= 128; i++) { const v = safe(() => localStorage.getItem("volume-chunk-" + i), null); if (v === null) break; chunks++; if (v !== chunk) bad++; }
  emit("VSTART chunks readable=" + chunks + " corrupt=" + bad + " many-1999=" + J(localStorage.getItem("many-1999")) + " slices=" + J(st.slices.slice(0, 12)));
  const parse = ms(() => JSON.parse(eng.get("modSettings")));
  const read = ms(() => localStorage.getItem("many-7"));
  localStorage.setItem("vstart-marker", "1");
  const flush = ms(() => api.flush());
  emit("VSTART parse " + parse.ms + " ms, small read " + read.ms + " ms, setItem+flush " + flush.ms + " ms");
  emit("DONE volume-start");
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { try { run(); } catch (e) { emit("run threw " + e); } }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
