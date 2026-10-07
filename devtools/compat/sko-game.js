// sko-game.js - game scope. __PHASE__ 2: open the in-game Options screen, change GAME_SET, confirm. Phase 3: open it
// and record and screenshot what it shows after the restart. Phase 1 never reaches the game.
const PHASE = "__PHASE__";
emit("game attached phase " + PHASE + "; keeper=" + J(status()));
async function run() {
  emit("START game phase " + PHASE + " turn=" + safe(() => Game.turn));
  await openOptions();
  emit("game options open; model=" + J(modelValues()));
  if (PHASE === "2") {
    await shots("3-ingame-before", GAME_SET);
    const how = {};
    how["bz-commander-lens"] = drive("bz-commander-lens", "dropdown", 3);
    how["sib-celebratory-celebrations-show-fireworks"] = drive("sib-celebratory-celebrations-show-fireworks", "checkbox");
    how["cd-recede"] = drive("cd-recede", "checkbox");
    await later(1500);
    emit("game changed " + J(how) + "; model now=" + J(modelValues()));
    await shots("3-ingame-after", GAME_SET);
    emit("game " + confirm() + "; keeper=" + J(status()));
    await later(3000);
    emit("game GAME-WRITTEN " + J(modelValues()));
  } else {
    await shots("5-ingame-persisted", [...MENU_SET, ...GAME_SET]);
    emit("game 5-ingame-persisted " + J(modelValues()));
    emit("game " + confirm());
  }
  emit("DONE game phase " + PHASE);
}
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) { setTimeout(() => { run().catch((e) => emit("run threw " + e + " " + (e && e.stack))); }, 15000); return; }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
if (PHASE !== "1") setTimeout(beginPoll, 3000);
