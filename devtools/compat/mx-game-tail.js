// mx game: the in-game steps of each launch's chain
async function quickSave() { (await SaveLoad()).handleQuickSave(); emit("ACTION quick save"); await later(8000); }
async function quickLoad() { (await SaveLoad()).handleQuickLoad(); emit("ACTION quick load (in game)"); }
function exitToMenu() { emit("ACTION exit to main menu"); engine.call("exitToMainMenu"); }
function restart() { emit("ACTION restart"); Network.restartGame(); }
const GAME_PLAN = {
  L1: { 1: async () => { await readTagged("menu->new game"); await quickSave(); await setTagged("G1"); setStep(2); exitToMenu(); },
        3: async () => { await readTagged("game->exit->new game"); await setTagged("G2"); setStep(4); restart(); },
        4: async () => { await readTagged("game->restart"); await setTagged("G3"); setStep(5); await quickLoad(); },
        5: async () => { await readTagged("game->load save in game"); await setTagged("G4"); setStep(6); exitToMenu(); },
        7: async () => { await readTagged("game->exit->load save"); await setTagged("G5"); setStep(8); emit("DONE-CHAIN"); } },
  L2: { 1: async () => { await readTagged("game->relaunch->load save"); setStep(2); exitToMenu(); },
        3: async () => { await readTagged("game->relaunch->new game"); setStep(4); exitToMenu(); },
        5: async () => { await readTagged("menu->load save (same session)"); setStep(6); emit("DONE-CHAIN"); } },
  L3: { 1: async () => { await readTagged("menu->relaunch->load save"); setStep(2); exitToMenu(); },
        3: async () => { await readTagged("menu->relaunch->new game"); setStep(4); emit("DONE-CHAIN"); } }
};
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) {
    setTimeout(async () => {
      const s = step(), f = (GAME_PLAN[PHASE] || {})[s];
      emit("game started, phase " + PHASE + " step " + s + " age=" + J(safe(() => GameInfo.Ages.lookup(Game.age).AgeType)));
      if (!f) { emit("game has nothing to do at step " + s); return; }
      try { await f(); } catch (e) { emit("game step threw " + e + " " + (e && e.stack)); }
    }, 12000);
    return;
  }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
