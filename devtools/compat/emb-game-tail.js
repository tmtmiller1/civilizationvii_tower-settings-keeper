// game scope: press Begin Game, wait for the started state, probe, then report done
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) {
    setTimeout(async () => {
      emit("age=" + J(safe(() => GameInfo.Ages.lookup(Game.age).AgeType)) + " turn=" + safe(() => Game.turn));
      try { await body(); } catch (e) { emit("body threw " + e); }
      await later(1500);
      emit("DONE-GAME");
    }, 8000);
    return;
  }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
