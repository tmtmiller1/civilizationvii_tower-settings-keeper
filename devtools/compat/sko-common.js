// sko-common.js - shared by the Options-screen probes (the runner concatenates it ahead of each phase script).
// Drives the REAL Options screen: opens it on the Add-ons tab, reads the Options model, flips a checkbox / switch
// through its component's toggle(), picks a dropdown item through onItemSelected(), scrolls a row into view for a
// screenshot, and presses Confirm. Nothing here calls a mod's save() directly.
const TAG = "[SKC]";
function emit(m) { try { console.error(TAG + " " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
function safe(fn, fb) { try { return fn(); } catch (e) { return fb === undefined ? ("ERR:" + e) : fb; } }
function later(ms) { return new Promise((r) => setTimeout(r, ms)); }
const status = () => safe(() => (window.SettingsKeeper ? window.SettingsKeeper.status() : "NO KEEPER"));

// the rows this probe looks at: [option id, control kind, group label for the screenshot name]
const MENU_SET = [
  ["bz-restyle-yield-banner", "checkbox", "bz"],
  ["sib-celebratory-celebrations-master-enable", "switch", "sib"],
  ["canals-mode", "dropdown", "canals"],
  ["cd-claim-only", "checkbox", "cd"]
];
const GAME_SET = [
  ["bz-commander-lens", "dropdown", "bz"],
  ["sib-celebratory-celebrations-show-fireworks", "checkbox", "sib"],
  ["cd-recede", "checkbox", "cd"]
];
const ALL_IDS = [...MENU_SET, ...GAME_SET].map((r) => r[0]);

let OptionsModel = null;
async function openOptions() {
  const cm = (await import("/core/ui/context-manager/context-manager.js")).ContextManager;
  OptionsModel = (await import("/core/ui/options/model-options.js")).Options;
  cm.push("screen-options", { singleton: true, createMouseGuard: true, attributes: { "selected-tab": "0" } });
  await later(4000);
  return cm;
}
function modelValues() {
  const out = {};
  for (const id of ALL_IDS) {
    const info = safe(() => OptionsModel.data.get(id), null);
    out[id] = info ? (info.type === 2 ? { index: info.selectedItemIndex } : { value: info.currentValue }) : "not registered";
  }
  return out;
}
function controlFor(id) {
  const cell = document.querySelector('[optionID="' + id + '"]');
  if (!cell) return null;
  const sel = "fxs-checkbox, fxs-switch, fxs-dropdown";
  return cell.matches(sel) ? cell : cell.querySelector(sel);
}
function rowFor(id) {
  const cell = document.querySelector('[optionID="' + id + '"]');
  return cell ? cell.parentElement : null;
}
function scrollTo(id) {
  const row = rowFor(id); if (!row) return false;
  const sc = document.querySelector("screen-options fxs-scrollable");
  const ok = safe(() => { if (sc && sc.component && typeof sc.component.scrollIntoView === "function") { sc.component.scrollIntoView(row); return true; } return false; }, false);
  if (!ok) safe(() => row.scrollIntoView());
  return true;
}
/** Change one control the way a click would: toggle() for checkbox/switch, onItemSelected() for a dropdown. */
function drive(id, kind, want) {
  const el = controlFor(id);
  if (!el) return "no control";
  const c = el.component;
  if (kind === "dropdown") {
    if (c && typeof c.onItemSelected === "function") { c.onItemSelected(want); return "onItemSelected(" + want + ")"; }
    el.setAttribute("selected-item-index", String(want)); return "attribute selected-item-index=" + want;
  }
  if (c && typeof c.toggle === "function") { c.toggle(); return "toggle()"; }
  const cur = el.getAttribute("selected") === "true"; el.setAttribute("selected", cur ? "false" : "true"); return "attribute selected=" + !cur;
}
/** What the screen shows right now for the rows in `set`: on screen or not, and the control's DOM state. */
function viewState(set) {
  const sc = document.querySelector("screen-options fxs-scrollable");
  const box = sc ? sc.getBoundingClientRect() : { top: 0, bottom: 99999 };
  const out = {};
  for (const [id, kind] of set) {
    const row = rowFor(id); const el = controlFor(id);
    if (!row || !el) { out[id] = "no row"; continue; }
    const r = row.getBoundingClientRect();
    const visible = r.bottom > box.top + 60 && r.top < box.bottom - 60;
    const state = kind === "dropdown" ? "index " + el.getAttribute("selected-item-index") : "selected " + el.getAttribute("selected");
    out[id] = (visible ? "ON SCREEN, " : "off screen, ") + state;
  }
  return out;
}
async function shots(prefix, set) {
  const groups = [...new Set(set.map((r) => r[2]))];
  for (const g of groups) {
    const id = set.find((r) => r[2] === g)[0];
    const found = scrollTo(id);
    await later(4000);
    const name = prefix + "-" + g + (found ? "" : "-norow");
    emit("VIEW " + name + " " + J(viewState(set)));
    emit("SHOT " + name);
    await later(6000);
  }
}
function confirm() {
  const b = document.querySelector("#options-confirm");
  if (!b) return "no confirm button";
  b.dispatchEvent(new CustomEvent("action-activate", { bubbles: true }));
  return "confirm pressed";
}
