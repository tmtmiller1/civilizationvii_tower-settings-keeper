// sko-shell.js - shell scope, the main menu. __PHASE__ 1: change MENU_SET on the real Options screen, confirm, quit.
// Phases 2 and 3: open the Options screen, record and screenshot what it shows after the restart, confirm, start a game.
const PHASE = "__PHASE__";
emit("shell attached phase " + PHASE + "; keeper=" + J(status()));
setTimeout(async () => {
  try {
    await openOptions();
    emit("shell options open; model=" + J(modelValues()));
    if (PHASE === "1") {
      await shots("1-menu-before", MENU_SET);
      const how = {};
      how["bz-restyle-yield-banner"] = drive("bz-restyle-yield-banner", "checkbox");
      how["sib-celebratory-celebrations-master-enable"] = drive("sib-celebratory-celebrations-master-enable", "switch");
      how["canals-mode"] = drive("canals-mode", "dropdown", 1);
      how["cd-claim-only"] = drive("cd-claim-only", "checkbox");
      await later(1500);
      emit("shell changed " + J(how) + "; model now=" + J(modelValues()));
      await shots("1-menu-after", MENU_SET);
      emit("shell " + confirm() + "; keeper=" + J(status()));
      await later(3000);
      emit("shell MENU-WRITTEN " + J(modelValues()));
      emit("DONE phase 1 (no game)");
      return;
    }
    const prefix = PHASE === "2" ? "2-menu-persisted" : "4-menu-after-game";
    await shots(prefix, PHASE === "2" ? MENU_SET : [...MENU_SET, ...GAME_SET]);
    emit("shell " + prefix + " " + J(modelValues()));
    emit("shell " + confirm());
    await later(3000);
    Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
    engine.call("startGame");
    emit("shell startGame called (Play Now)");
  } catch (e) { emit("shell threw " + e + " " + (e && e.stack)); emit("DONE shell error"); }
}, 20000);
