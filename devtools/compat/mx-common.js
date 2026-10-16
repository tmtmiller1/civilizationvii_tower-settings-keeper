// mx-common.js - the settings transition matrix (the runner prepends SCOPE, TOKEN, PHASE and START_AGE; PHASE names
// the launch, L1 to L3). The first half is eo-common.js's Options-screen driver. The second half runs one chain per
// launch: change one row per tower mod on the real Options screen and press Confirm ("SET"), move between the menu and
// a game (new game, exit to menu, restart, quick save and load, relaunch), and read every setting back through the
// mods' own code after each move ("READ"). The steps are in mx-shell-tail.js and mx-game-tail.js; mx-check.py checks
// each READ against the latest SET.
const TAG = "[MX] " + SCOPE + " ";
function emit(m) { try { console.error(TAG + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? "ERR:" + e : fb; } }
const later = (ms) => new Promise((r) => setTimeout(r, ms));
// [name, option id, control, module path, read(m), next value for the control given the current reading]
const ROWS = [
  ["canals", "canals-mode", "dropdown", "/tower-canals/ui/canals-settings.js", (m) => m.getMode(), (v) => (v === "one-tile" ? 0 : 1)],
  ["cultural-diffusion", "cd-require-adjacency", "checkbox", "/cultural-diffusion/ui/cd-settings.js", (m) => m.getRequireAdjacency(), null],
  ["emigration", "emigration-number-mode", "dropdown", "/emigration/ui/emigration-settings.js", (m) => m.getNumberMode(), (v) => (v === 1 ? 2 : 1)],
  ["geographic-labels", "geo-labels-terrain-following", "checkbox", "/tmt-geographic-labels/ui/geo-labels-utils.js", (m) => !!(m.getGlobalSettings() || {}).flat, null],
  ["national-parks", "np-overlay", "checkbox", "/tower-national-park/ui/np-settings.js", (m) => m.getMarks(), null],
  ["universal-auto-explore", "uae-class-civilian", "checkbox", "/universal-auto-explore/ui/uae-settings.js", (m) => m.isClassEnabled("civilian"), null],
  ["demographics", "demographics-smooth-chart", "checkbox", "/demographics/ui/core/demographics-settings.js", (m) => !!(m.DemographicsSettings || m.default).getSetting("smoothChart", false), null]
];
function keeper() {
  const k = safe(() => window.SettingsKeeper, null);
  if (!k || typeof k !== "object") return { keeper: null };
  const s = safe(() => k.status(), {});
  return { build: k.build, origin: k.origin, rows: s.rows, rawRows: safe(() => k.engine.length(), "?"), folded: s.folded, blocked: s.blocked };
}
async function present() {
  const out = [];
  for (const r of ROWS) { try { out.push({ r, m: await import(r[3]) }); } catch (_) { /* that mod is not loaded */ } }
  return out;
}
let OptionsModel = null;
async function openOptions() {
  const cm = (await import("/core/ui/context-manager/context-manager.js")).ContextManager;
  OptionsModel = (await import("/core/ui/options/model-options.js")).Options;
  cm.push("screen-options", { singleton: true, createMouseGuard: true, attributes: { "selected-tab": "0" } });
  await later(5000);
}
function modelValue(id) {
  const info = safe(() => OptionsModel.data.get(id), null);
  if (!info) return "not registered";
  return info.type === 2 || "selectedItemIndex" in info && info.dropdownItems ? info.selectedItemIndex : info.currentValue;
}
function control(id) {
  const cell = document.querySelector('[optionID="' + id + '"]');
  if (!cell) return null;
  const sel = "fxs-checkbox, fxs-switch, fxs-dropdown";
  return cell.matches(sel) ? cell : cell.querySelector(sel);
}
function drive(id, kind, want) {
  const el = control(id);
  if (!el) return "no control";
  const c = el.component;
  if (kind === "dropdown") {
    if (c && typeof c.onItemSelected === "function") { c.onItemSelected(want); return "onItemSelected(" + want + ")"; }
    return "dropdown has no onItemSelected";
  }
  if (c && typeof c.toggle === "function") { c.toggle(); return "toggle()"; }
  return "checkbox has no toggle";
}
function confirmOptions() {
  const b = document.querySelector("#options-confirm");
  if (!b) return "no confirm button";
  b.dispatchEvent(new CustomEvent("action-activate", { bubbles: true }));
  return "confirm pressed";
}
async function readAll(withScreen) {
  const mods = await present();
  emit("keeper " + J(keeper()) + " mods " + J(mods.map((x) => x.r[0])));
  if (withScreen) await openOptions();
  for (const { r, m } of mods) {
    emit("READ " + r[0] + " module=" + J(safe(() => r[4](m))) + (withScreen ? " screen=" + J(modelValue(r[1])) : ""));
  }
  if (withScreen) emit(confirmOptions());
}
async function writeAll() {
  const mods = await present();
  emit("keeper " + J(keeper()) + " mods " + J(mods.map((x) => x.r[0])));
  await openOptions();
  for (const { r, m } of mods) {
    const before = safe(() => r[4](m));
    const want = r[5] ? r[5](before) : undefined;
    const how = drive(r[1], r[2], want);
    await later(800);
    emit("CHANGED " + r[0] + " before=" + J(before) + " via " + how + " screen=" + J(modelValue(r[1])));
  }
  emit(confirmOptions());
  await later(3000);
  for (const { r, m } of mods) emit("AFTER " + r[0] + " module=" + J(safe(() => r[4](m))));
  emit("keeper after " + J(keeper()));
}

// ---- mx: a chain of transitions inside one launch.
const STEP_KEY = "embMx_" + TOKEN;
// The step is kept under its own localStorage key (one per run label), which lives through every in-session
// transition; Configuration.getUser() values set in the main menu were not visible in the game.
function step() { const v = safe(() => localStorage.getItem(STEP_KEY), null); return v == null || v === "" ? 0 : Number(v); }
function setStep(n) { safe(() => localStorage.setItem(STEP_KEY, String(n))); }
function canalsDefault() {
  return safe(() => ((JSON.parse(localStorage.getItem("modSettings") || "{}") || {})["tower-canals"] || {}).mode || null, null);
}
async function readTagged(tag) {
  const mods = await present();
  emit("keeper " + J(keeper()) + " step " + step());
  for (const { r, m } of mods) emit("READ " + tag + " " + r[0] + "=" + J(safe(() => r[4](m))));
  emit("READ " + tag + " canals-default=" + J(canalsDefault()));
}
async function setTagged(tag) {
  const mods = await present();
  await openOptions();
  for (const { r, m } of mods) drive(r[1], r[2], r[5] ? r[5](safe(() => r[4](m))) : undefined);
  await later(800);
  emit(confirmOptions());
  await later(2500);
  for (const { r, m } of mods) emit("SET " + tag + " " + r[0] + "=" + J(safe(() => r[4](m))));
  emit("SET " + tag + " canals-default=" + J(canalsDefault()));
}
async function SaveLoad() { return (await import("/core/ui/save-load/model-save-load.js")).default; }
function playNow() {
  Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
  if (START_AGE) Configuration.editGame().setStartAgeType(START_AGE);
  engine.call("startGame");
  emit("ACTION play now");
}
// The main menu loads through the save list (handleQuickLoad there starts nothing): query the quick saves, wait for the
// list, then handleLoadSave the newest one, as the Load screen does.
async function quickLoadFromMenu() {
  const SL = await SaveLoad();
  Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
  const got = new Promise((res) => {
    const f = () => { window.removeEventListener("model-save-load-query-complete", f); res(); };
    window.addEventListener("model-save-load-query-complete", f);
    setTimeout(res, 20000);
  });
  SL.querySaveGameList(SaveLocations.LOCAL_STORAGE, GameStateStorage.getGameConfigurationSaveType(),
    SaveLocationCategories.QUICKSAVE, SaveFileTypes.GAME_STATE, { isOverwriteQueryIds: true });
  await got;
  const quick = (SL.saves || []).filter((x) => x && (x.locationCategories & SaveLocationCategories.QUICKSAVE));
  quick.sort((a, b) => (b.saveTime || 0) - (a.saveTime || 0));
  emit("quick saves listed: " + (SL.saves || []).length + " total, " + quick.length + " quick: " + J(quick.map((x) => x.fileName)));
  if (!quick.length) { emit("LOAD-FAIL no quick save in the list"); return; }
  const ok = SL.handleLoadSave(quick[0], ServerType.SERVER_TYPE_NONE);
  emit("ACTION quick load (main menu) " + quick[0].fileName + " -> " + ok);
}
