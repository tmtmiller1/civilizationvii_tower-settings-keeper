// sko-func.js - game scope. Measures behaviour that depends on the saved options, in a fresh process:
//   bz Map Trix: the yield-banner restyle (body class and the computed style it drives), and which lens the mod
//                activates when the scout and the warrior are selected (RECON setting against the default MILITARY)
//   Cultural Diffusion: its live CONFIG after its own applyTunableOverrides()
//   Canals: the GameConfiguration pin the mod writes at game start. The runner also greps its "rules:" line.
// Run once on the player's untouched store (control) and once on the store from the Options run (saved values).
const PHASE = "__PHASE__";
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }

function yieldBannerStyle() {
  const el = document.querySelector("yield-bar-entry.text-yield-food") || document.querySelector("yield-bar-entry");
  if (!el) return "no yield-bar-entry";
  const cs = getComputedStyle(el);
  return { tag: el.tagName, cls: el.className, color: cs.color, fontWeight: cs.fontWeight, fontSize: cs.fontSize, bg: cs.backgroundColor, bodyClass: document.body.classList.contains("bz-yield-banner") };
}
async function lensFor(unit, LensManager) {
  safe(() => UI.Player.deselectAllUnits());
  await later(800);
  safe(() => UI.Player.selectUnit(unit.id));
  await later(1800);
  const lens = safe(() => LensManager.getActiveLens());
  safe(() => UI.Player.deselectAllUnits());
  await later(800);
  return lens;
}
async function run() {
  emit("START func " + PHASE + " turn=" + safe(() => Game.turn) + " keeper=" + J(safe(() => window.SettingsKeeper && window.SettingsKeeper.status().slices)));
  emit("bz yield banner: " + J(yieldBannerStyle()));
  emit("SHOT func-" + PHASE + "-hud");
  await later(7000);
  let LensManager = null;
  try { LensManager = (await import("/core/ui/lenses/lens-manager.js")).default; } catch (e) { emit("lens-manager import failed " + e); }
  const local = GameContext.localPlayerID;
  const units = [];
  for (const u of safe(() => Players.get(local).Units.getUnits(), []) || []) units.push({ id: u.id, type: safe(() => GameInfo.Units.lookup(u.type).UnitType), core: safe(() => GameInfo.Units.lookup(u.type).CoreClass) });
  emit("units " + J(units));
  const scout = units.find((u) => /SCOUT/.test(u.type));
  const warrior = units.find((u) => u.core === "CORE_CLASS_MILITARY" && !/SCOUT/.test(u.type));
  emit("bz options at runtime: " + J(await safe(async () => { const m = await import("/bz-map-trix/ui/options/bz-map-trix-options.js"); return { commanders: m.default.commanders, yieldBanner: m.default.yieldBanner }; })));
  if (LensManager) {
    emit("lens before: " + J(safe(() => LensManager.getActiveLens())));
    if (scout) emit("lens with SCOUT selected: " + J(await lensFor(scout, LensManager)) + " (RECON setting -> bz-commander-lens; default -> not)");
    if (warrior) emit("lens with WARRIOR selected: " + J(await lensFor(warrior, LensManager)) + " (both settings -> bz-commander-lens)");
  }
  emit("CD CONFIG: " + J(await safe(async () => { const m = await import("/cultural-diffusion/ui/cd-config.js"); const c = m.CONFIG; return { diffusionEnabled: c.diffusionEnabled, claimOnlyUnowned: c.claimOnlyUnowned, recedeBorders: c.recedeBorders, preset: c.presetName }; })));
  emit("Canals pin: " + J(safe(() => Configuration.getGame().getValue("ModOptions_tower-canals"))) + " getMode=" + J(await safe(async () => (await import("/tower-canals/ui/canals-settings.js")).getMode())));
  emit("DONE func " + PHASE);
}
emit("func attached " + PHASE);
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e + " " + (e && e.stack))); }, 20000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
