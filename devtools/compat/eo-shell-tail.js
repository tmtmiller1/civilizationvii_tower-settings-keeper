// shell scope: phase R reads in the main menu; both phases then start a Play Now game
setTimeout(async () => {
  if (PHASE === "R") { try { await readAll(false); } catch (e) { emit("read threw " + e); } }
  emit("DONE-SHELL");
  try {
    Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
    if (START_AGE) Configuration.editGame().setStartAgeType(START_AGE);
    engine.call("startGame");
    emit("startGame called");
  } catch (e) { emit("startGame threw " + e); }
}, 12000);
