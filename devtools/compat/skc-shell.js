// skc-shell.js - shell scope. Logs the keeper's state in the main menu, then starts a Play Now game.
function emit(m) { try { console.error("[SKC] shell " + m); } catch (_) {} }
function J(o) { try { return JSON.stringify(o); } catch (e) { return "unserializable:" + e; } }
emit("attached; keeper=" + J(typeof window.SettingsKeeper === "object" ? window.SettingsKeeper.status() : null) +
  " localStorage.length=" + localStorage.length + " key0=" + J(localStorage.key(0)));
setTimeout(() => {
  try {
    emit("keeper before start: " + J(window.SettingsKeeper ? window.SettingsKeeper.status() : null));
    Configuration.editGame()?.reset(GameModeTypes.SINGLEPLAYER);
    engine.call("startGame");
    emit("startGame called (Play Now)");
  } catch (e) { emit("startGame threw " + e); }
}, 20000);
