// sk-options.js - the two rows the keeper can show in Options, Add-ons. Both are hidden unless needed.
//   "Rebuild storage" shows while the keeper is in its fallback layout, which means two or more stored entries it
//   could not identify sit ahead of the shared settings. Rebuilding deletes those entries and writes everything the
//   keeper holds back as the one normal row. A confirmation says how many entries will go.
//   "Storage limit reached" shows after the keeper has refused a write that would have taken the row past its size
//   limit. The dialog names the mod and the sizes; OK clears the notice.
// This is a separate file from settings-keeper.js because that file must stay free of imports so the loader runs it
// first. This one can wait for the Options screen.
import { CategoryType, OptionType, Options } from "/core/ui/options/model-options.js";
import DialogBoxManager, { DialogBoxAction } from "/core/ui/dialog-box/manager-dialog-box.js";

const TAG = "[settings-keeper]";
const REBUILD_ROW = "tsk-rebuild";
const LIMIT_ROW = "tsk-limit";
const GROUP = "tower_settings_keeper";

function keeper() {
  try {
    return typeof window !== "undefined" && window.SettingsKeeper ? window.SettingsKeeper : null;
  } catch (_) {
    return null;
  }
}

function status() {
  const k = keeper();
  return k ? k.status() : null;
}

function blockedRows() {
  const s = status();
  return s && s.blocked ? Math.max(1, s.rows - 1) : 0;
}

function refusal() {
  const s = status();
  return s ? s.refused : null;
}

/** Button rows have no forceRender in 1.5.0, so the row element is hidden directly as well. */
function hideRow(id, info) {
  if (info) info.isHidden = true;
  info?.forceRender?.();
  try {
    const cell = document.querySelector('[optionID="' + id + '"]');
    if (cell && cell.parentElement) cell.parentElement.classList.add("hidden");
  } catch (_) {
    /* the screen will hide it next time it opens */
  }
}

function rebuildNow(info) {
  const k = keeper();
  if (!k) return;
  const r = k.rebuild();
  console.warn(TAG + " rebuild from Options: " + JSON.stringify(r));
  hideRow(REBUILD_ROW, info);
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

const mb = (bytes) => (Number(bytes) / (1024 * 1024)).toFixed(1);

function showRefusal(info) {
  const r = refusal();
  const k = keeper();
  if (!r || !k) return true;
  DialogBoxManager.createDialog_Confirm({
    title: "LOC_TSK_LIMIT_TITLE",
    body: Locale.compose("LOC_TSK_LIMIT_BODY", String(r.by), mb(r.bytes), mb(r.limit)),
    canClose: true,
    callback: () => {
      k.dismissRefusal();
      console.warn(TAG + " size notice dismissed from Options: " + JSON.stringify(r));
      hideRow(LIMIT_ROW, info);
    }
  });
  return true;
}

function addRow(id, labels, isNeeded, activate) {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Editor,
    id,
    label: labels.label,
    caption: labels.caption,
    description: labels.description,
    isHidden: !isNeeded(),
    initListener: (info) => {
      info.isHidden = !isNeeded();
    },
    activateListener: function () {
      return activate(Options.data.get(id));
    }
  });
}

try {
  Options.addInitCallback(() => {
    addRow(REBUILD_ROW, { label: "LOC_TSK_REBUILD_LABEL", caption: "LOC_TSK_REBUILD_CAPTION", description: "LOC_TSK_REBUILD_DESCRIPTION" },
      () => blockedRows() > 0, confirmRebuild);
    addRow(LIMIT_ROW, { label: "LOC_TSK_LIMIT_LABEL", caption: "LOC_TSK_LIMIT_CAPTION", description: "LOC_TSK_LIMIT_DESCRIPTION" },
      () => !!refusal(), showRefusal);
  });
} catch (e) {
  console.error(TAG + " Options rows not added: " + e);
}
