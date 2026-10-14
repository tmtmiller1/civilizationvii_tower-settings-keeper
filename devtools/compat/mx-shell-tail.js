// mx shell: the main-menu steps of each launch's chain
const SHELL_PLAN = {
  L1: { 0: async () => { await setTagged("M1"); setStep(1); playNow(); },
        2: async () => { await readTagged("game->exit to menu"); setStep(3); playNow(); },
        6: async () => { await readTagged("game->exit to menu (2)"); setStep(7); await quickLoadFromMenu(); } },
  L2: { 0: async () => { await readTagged("game->relaunch: menu"); setStep(1); await quickLoadFromMenu(); },
        2: async () => { setStep(3); playNow(); },
        4: async () => { await setTagged("M2"); setStep(5); await quickLoadFromMenu(); } },
  L3: { 0: async () => { await readTagged("menu->relaunch: menu"); setStep(1); await quickLoadFromMenu(); },
        2: async () => { setStep(3); playNow(); } }
};
setTimeout(async () => {
  const s = step(), f = (SHELL_PLAN[PHASE] || {})[s];
  emit("shell attached, phase " + PHASE + " step " + s);
  if (!f) { emit("shell has nothing to do at step " + s); return; }
  try { await f(); } catch (e) { emit("shell step threw " + e + " " + (e && e.stack)); }
}, 12000);
