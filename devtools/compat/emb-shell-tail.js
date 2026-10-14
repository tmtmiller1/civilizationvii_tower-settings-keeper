// shell scope: probe, then start a Play Now game (Exploration when START_AGE is set, for National Parks)
setTimeout(async () => {
  try { await body(); } catch (e) { emit("body threw " + e); }
  emit("DONE-SHELL");
  try {
    Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
    if (START_AGE) Configuration.editGame().setStartAgeType(START_AGE);
    engine.call("startGame");
    emit("startGame called (Play Now" + (START_AGE ? ", " + START_AGE : "") + ")");
  } catch (e) { emit("startGame threw " + e); }
}, 12000);
