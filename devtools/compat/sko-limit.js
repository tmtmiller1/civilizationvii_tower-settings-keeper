// sko-limit.js - shell scope. The size guard on the real Options screen. Writes 5 MB through the keeper, which must
// refuse it with QuotaExceededError and keep the earlier value; then opens Options, Add-ons, where the "Storage
// limit reached" row must show; presses it for the dialog; presses OK; the row must hide and the notice clear.
//__COMMON__
const ROW = "tsk-limit";
function rowState() {
  const info = safe(() => OptionsModel.data.get(ROW), null);
  const cell = document.querySelector('[optionID="' + ROW + '"]');
  const row = cell ? cell.parentElement : null;
  return { registered: !!info, isHidden: info ? info.isHidden : null, inDom: !!row, hiddenClass: row ? row.classList.contains("hidden") : null,
    label: row ? safe(() => Locale.compose(row.querySelector(".option-label") ? "" : "")) : null };
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
function dialogText() {
  const el = document.querySelector("screen-dialog-box");
  return el ? String(el.textContent || "").replace(/\s+/g, " ").slice(0, 400) : "no dialog";
}
emit("shell attached; keeper=" + J(status()));
setTimeout(async () => {
  try {
    emit("LIMIT step 1: DOMException alone: " + safe(() => { const d = new DOMException("t", "QuotaExceededError"); return d.name + "/" + d.code; }));
    await later(1500);
    emit("LIMIT step 2: small write");
    localStorage.setItem("limit-test", "small");
    await later(1500);
    emit("LIMIT step 3: 5 MB write begin");
    let threw = null;
    try { localStorage.setItem("limit-test", "x".repeat(5 * 1024 * 1024)); } catch (e) { threw = { name: e.name, message: String(e.message).slice(0, 160), isDOMException: typeof DOMException === "function" && e instanceof DOMException }; }
    emit("LIMIT step 3 done");
    await later(1500);
    emit("LIMIT 5 MB write: threw=" + J(threw) + " value after=" + J(localStorage.getItem("limit-test")) + " refused=" + J(status().refused) + " rowBytes=" + status().rowBytes);
    emit("LIMIT step 4: open Options");
    await openOptions();
    emit("LIMIT row at open: " + J(rowState()));
    const found = scrollTo(ROW);
    await later(3000);
    emit("SHOT limit-row" + (found ? "" : "-norow"));
    await later(6000);
    emit("press: " + pressRow());
    await later(1000);
    emit("LIMIT dialog text: " + dialogText());
    emit("SHOT limit-dialog-1s");
    await later(4000);
    emit("SHOT limit-dialog-5s");
    await later(6000);
    const btns = dialogButtons();
    emit("dialog buttons: " + J(btns.map((b) => b.caption)));
    const ok = btns.find((b) => /OK|ACCEPT|CONFIRM/i.test(String(b.caption))) || btns[0];
    if (ok) { ok.el.dispatchEvent(new CustomEvent("action-activate", { bubbles: true })); emit("pressed dialog button " + J(ok.caption)); }
    await later(2500);
    emit("LIMIT after OK: row " + J(rowState()) + " refused=" + J(status().refused) + " value=" + J(localStorage.getItem("limit-test")));
    emit("SHOT limit-after");
    await later(6000);
    localStorage.removeItem("limit-test");
    emit("DONE limit");
  } catch (e) { emit("shell threw " + e + " " + (e && e.stack)); emit("DONE shell error"); }
}, 20000);
