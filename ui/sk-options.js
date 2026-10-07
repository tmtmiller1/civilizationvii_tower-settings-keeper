// sk-options.js - the one row the keeper ever shows in Options, Add-ons: "Rebuild storage", and only while the
// keeper is in its fallback layout (two or more stored entries it could not name sit ahead of the shared settings).
// Rebuilding drops those entries and writes everything the keeper holds back as the one normal row. A confirm
// dialog states how many entries go. Separate from settings-keeper.js on purpose: that file must stay import-free so
// the loader runs it first; this one can wait for the Options screen.
import { CategoryType, OptionType, Options } from "/core/ui/options/model-options.js";
import DialogBoxManager, { DialogBoxAction } from "/core/ui/dialog-box/manager-dialog-box.js";

const TAG = "[settings-keeper]";
const ROW_ID = "tsk-rebuild";

function keeper() {
  try {
    return typeof window !== "undefined" && window.SettingsKeeper ? window.SettingsKeeper : null;
  } catch (_) {
    return null;
  }
}

function blockedRows() {
  const k = keeper();
  if (!k) return 0;
  const s = k.status();
  return s.blocked ? Math.max(1, s.rows - 1) : 0;
}

function rebuildNow(info) {
  const k = keeper();
  if (!k) return;
  const r = k.rebuild();
  console.warn(TAG + " rebuild from Options: " + JSON.stringify(r));
  info.isHidden = true;
  info.forceRender?.(); // button rows have no forceRender in 1.5.0, so hide the row element directly as well
  try {
    const cell = document.querySelector('[optionID="' + ROW_ID + '"]');
    if (cell && cell.parentElement) cell.parentElement.classList.add("hidden");
  } catch (_) {
    /* the screen will hide it next time it opens */
  }
}

function confirmRebuild(info) {
  const count = blockedRows();
  DialogBoxManager.createDialog_ConfirmCancel({
    title: "LOC_TSK_REBUILD_CONFIRM_TITLE",
    body: Locale.compose("LOC_TSK_REBUILD_CONFIRM_BODY", count),
    canClose: true,
    callback: (action) => {
      if (action === DialogBoxAction.Confirm) rebuildNow(info);
    }
  });
  return true; // handled; no editor screen to push
}

try {
  Options.addInitCallback(() => {
    Options.addOption({
      category: CategoryType.Mods,
      group: "tower_settings_keeper",
      type: OptionType.Editor,
      id: ROW_ID,
      label: "LOC_TSK_REBUILD_LABEL",
      caption: "LOC_TSK_REBUILD_CAPTION",
      description: "LOC_TSK_REBUILD_DESCRIPTION",
      isHidden: blockedRows() === 0,
      initListener: (info) => {
        info.isHidden = blockedRows() === 0;
      },
      activateListener: function () {
        return confirmRebuild(Options.data.get(ROW_ID));
      }
    });
  });
} catch (e) {
  console.error(TAG + " Options row not added: " + e);
}
