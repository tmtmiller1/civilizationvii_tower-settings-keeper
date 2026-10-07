// sko-lens.js - game scope. bz Map Trix activates its commander lens on unit selection according to the saved
// "Commander lens activation" setting: the default MILITARY (2) means military units only, RECON (3) adds recon units.
// A Play Now start has only a Founder, so the AI plays a few turns until a scout and a warrior exist. Then each is
// selected and the active lens is read. Control against saved values.
const PHASE = "__PHASE__";
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const local = () => GameContext.localPlayerID;
function myUnits() {
  const out = [];
  for (const u of safe(() => Players.get(local()).Units.getUnits(), []) || []) {
    const info = safe(() => GameInfo.Units.lookup(u.type), null);
    out.push({ id: u.id, type: info ? info.UnitType : "?", core: info ? info.CoreClass : "?", recon: !!safe(() => GameInfo.TypeTags.find((t) => t.Type === info.UnitType && t.Tag === "UNIT_CLASS_AUTOEXPLORE")) });
  }
  return out;
}
async function autoplayTurn() {
  const t0 = safe(() => Game.turn);
  safe(() => { Autoplay.setTurns(1); Autoplay.setReturnAsPlayer(local()); Autoplay.setObserveAsPlayer(local()); Autoplay.setActive(true); });
  for (let i = 0; i < 40; i++) { await later(3000); if (safe(() => Game.turn) !== t0) break; }
  safe(() => Autoplay.setActive(false));
  await later(4000);
}
async function lensFor(unit, LensManager) {
  safe(() => UI.Player.deselectAllUnits());
  await later(1000);
  safe(() => UI.Player.selectUnit(unit.id));
  await later(2500);
  const lens = safe(() => LensManager.getActiveLens());
  const selected = safe(() => { const s = UI.Player.getHeadSelectedUnit(); return s ? s.id : null; });
  safe(() => UI.Player.deselectAllUnits());
  await later(1000);
  return { lens, selectedId: selected };
}
async function run() {
  emit("START lens " + PHASE + " turn=" + safe(() => Game.turn));
  const bz = await safe(async () => (await import("/bz-map-trix/ui/options/bz-map-trix-options.js")).default.commanders);
  emit("bz commanders setting at runtime=" + J(bz) + " (2 MILITARY default, 3 RECON)");
  const LensManager = (await import("/core/ui/lenses/lens-manager.js")).default;
  let units = myUnits();
  for (let i = 0; i < 14 && !(units.some((u) => u.recon) && units.some((u) => u.core === "CORE_CLASS_MILITARY" && !u.recon)); i++) {
    await autoplayTurn();
    units = myUnits();
    emit("turn " + safe(() => Game.turn) + " units " + J(units.map((u) => u.type)));
  }
  const scout = units.find((u) => u.recon);
  const warrior = units.find((u) => u.core === "CORE_CLASS_MILITARY" && !u.recon);
  emit("picked scout=" + J(scout && scout.type) + " warrior=" + J(warrior && warrior.type) + " lens before=" + J(safe(() => LensManager.getActiveLens())));
  if (scout) emit("SCOUT selected -> " + J(await lensFor(scout, LensManager)) + " (RECON setting -> bz-commander-lens; default -> fxs-default-lens)");
  if (warrior) emit("WARRIOR selected -> " + J(await lensFor(warrior, LensManager)) + " (either setting -> bz-commander-lens)");
  if (scout) { safe(() => UI.Player.selectUnit(scout.id)); await later(2500); emit("SHOT lens-" + PHASE + "-scout"); await later(7000); safe(() => UI.Player.deselectAllUnits()); }
  emit("DONE lens " + PHASE);
}
emit("lens attached " + PHASE);
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e + " " + (e && e.stack))); }, 20000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
