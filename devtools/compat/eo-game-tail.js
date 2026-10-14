// game scope: phase W changes the rows on the in-game Options screen; phase R reads them in the new game
let tries = 0;
function beginPoll() {
  const st = safe(() => UI.getGameLoadingState(), -1);
  if (st === 8) {
    setTimeout(async () => {
      emit("age=" + J(safe(() => GameInfo.Ages.lookup(Game.age).AgeType)));
      try { if (PHASE === "W") await writeAll(); else await readAll(true); } catch (e) { emit("threw " + e + " " + (e && e.stack)); }
      await later(2000);
      emit("DONE-GAME");
    }, 12000);
    return;
  }
  tries++; safe(() => UI.notifyUIReady());
  if (tries < 150) setTimeout(beginPoll, 2000); else emit("LOAD gave up at state " + st);
}
setTimeout(beginPoll, 3000);
