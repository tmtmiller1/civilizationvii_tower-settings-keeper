// sko-rebuild.js - shell scope. __PHASE__ 1 on a store with two unidentifiable entries: the keeper is in fallback
// layout, the Rebuild row shows in Options, pressing it opens the confirmation, accepting rebuilds the store.
// __PHASE__ 2, with the store carried over: the keeper is in the normal layout and the row is hidden.
const PHASE = "__PHASE__";
const ROW = "tsk-rebuild";
function rowState() {
  const info = safe(() => OptionsModel.data.get(ROW), null);
  const cell = document.querySelector('[optionID="' + ROW + '"]');
  const row = cell ? cell.parentElement : null;
  return { registered: !!info, isHidden: info ? info.isHidden : null, inDom: !!row, hiddenClass: row ? row.classList.contains("hidden") : null };
}
function pressRow() {
  const cell = document.querySelector('[optionID="' + ROW + '"]');
  const btn = cell && (cell.matches("fxs-button") ? cell : cell.querySelector("fxs-button"));
  if (!btn) return "no button";
  btn.dispatchEvent(new CustomEvent("action-activate", { bubbles: true }));
  return "pressed";
}
function dialogButtons() {
  return Array.from(document.querySelectorAll("fxs-button")).filter((b) => b.closest("screen-dialog-box, .screen-dialog-box, fxs-modal-frame")).map((b) => ({ caption: b.getAttribute("caption"), el: b }));
}
function dialogState() {
  const el = document.querySelector("screen-dialog-box");
  if (!el) return "no screen-dialog-box element";
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  const frame = el.querySelector("fxs-modal-frame"); const fr = frame ? frame.getBoundingClientRect() : null;
  const opts = document.querySelector("screen-options");
  const order = opts && el ? (opts.compareDocumentPosition(el) & 4 ? "dialog after options in DOM" : "dialog before options in DOM") : "?";
  return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], display: cs.display, visibility: cs.visibility, opacity: cs.opacity, zIndex: cs.zIndex, frameRect: fr && [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)], order, parent: el.parentElement && el.parentElement.tagName, title: safe(() => el.querySelector("fxs-header") && el.querySelector("fxs-header").getAttribute("title")) };
}
emit("shell attached phase " + PHASE + "; keeper=" + J(status()));
setTimeout(async () => {
  try {
    await openOptions();
    emit("rebuild row at open: " + J(rowState()) + " keeper=" + J(status()));
    const found = scrollTo(ROW);
    await later(3000);
    emit("SHOT rebuild-" + PHASE + "-row" + (found ? "" : "-norow"));
    await later(6000);
    if (PHASE === "1") {
      emit("press: " + pressRow());
      await later(1000);
      emit("dialog DOM +1s: " + J(dialogState()));
      emit("SHOT rebuild-1-dialog-1s");
      await later(3000);
      emit("dialog DOM +4s: " + J(dialogState()));
      emit("SHOT rebuild-1-dialog-4s");
      await later(6000);
      const btns = dialogButtons();
      emit("dialog buttons: " + J(btns.map((b) => b.caption)));
      const accept = btns.find((b) => /OK|ACCEPT|CONFIRM/i.test(String(b.caption))) || btns[0];
      if (accept) { accept.el.dispatchEvent(new CustomEvent("action-activate", { bubbles: true })); emit("accepted via dialog button " + J(accept.caption)); }
      else { emit("no dialog button found; calling rebuild() directly"); window.SettingsKeeper.rebuild(); }
      await later(2500);
      emit("after rebuild: row " + J(rowState()) + " keeper=" + J(status()));
      emit("SHOT rebuild-1-after");
      await later(6000);
    }
    emit("shell " + confirm());
    emit("DONE rebuild phase " + PHASE);
  } catch (e) { emit("shell threw " + e + " " + (e && e.stack)); emit("DONE shell error"); }
}, 20000);
