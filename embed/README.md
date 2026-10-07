# Shipping the fix inside your own mod

One file and two lines in your modinfo. Your players get settings that survive a restart without installing
anything else, and your settings code does not change.

## The bug

In Civilization VII, `localStorage.getItem(key)` returns the first stored entry no matter which key was asked for,
and there is no way to list the entries. A mod can read its settings back only if its entry sorts first. Every other
mod reads some other mod's data and writes it back under its own name on its next save. The options helper many
mods share clears the whole store as soon as it sees a second entry. Details and the test record are in
[docs/design.md](../docs/design.md).

## What the file does

`settings-keeper.js` patches the game's `localStorage` object in place. Every key then lives inside the one entry
the game reads correctly, `modSettings`.

- `getItem`, `setItem` and `removeItem` on your own key read and write `modSettings.__ls[<your key>]`.
- `getItem("modSettings")` returns the usual `{ "<mod id>": { ... } }` object and `setItem("modSettings", ...)`
  merges it back. The shared-section pattern works unchanged.
- `length` reports 1 and `key(i)` returns null, so the clear-on-second-entry helper never runs.
- At start-up it repairs a store that another mod has already pushed out of order, without overwriting anything.

## Steps

1. Copy `settings-keeper.js` into your mod without changing it, for example as `ui/settings-keeper.js`. It is the
   file next to this README in the kit, and `ui/settings-keeper.js` in a subscribed copy of the Tower Settings
   Keeper mod.
2. List it as the first `<Item>` in `<UIScripts>` of both your shell action group and your game action group:

   ```xml
   <UIScripts>
       <Item>ui/settings-keeper.js</Item>
       <Item>ui/my-mod.js</Item>
   </UIScripts>
   ```

   The file imports nothing, so the loader runs it as early as any script can run. The loader does not follow
   `LoadOrder` for scripts. A script's imports decide when it runs. That is why this file has no imports and why
   it should be listed first.

3. Keep your settings code as it is.

To confirm it ran, look for one line per scope in `Logs/UI.log`:

```
[settings-keeper] ready (build 111 from <your mod folder>): root "modSettings", rows 1, slices 7, keys kept 2
```

## Several mods carrying the file

This is expected. The first copy to run installs itself. Every later copy finds it under
`localStorage.__settingsKeeper` and does nothing. A copy with a higher build number than the installed one takes
over. The older copy writes out anything it still holds and uninstalls, the newer one installs, and the log says
which mod's copy replaced which. The newest file on the player's machine is the one that runs, whichever mod
brought it.

New builds are published with this repository's releases as `settings-keeper-embed-<version>.zip`. Replace your
copy when you next release. Nothing else is needed.

## Rules

- Do not edit the file. A changed copy with the same build number would win or lose against the original by load
  order alone, and other mods rely on the layout described below.
- Do not add imports to it, and do not load it through a wrapper that imports something. Either one delays it.
- Avoid reading `localStorage` at the top level of your module. If your script happens to run before the keeper in
  some launch, that one read gets the engine's answer. Reads made later, when the player opens your panel or a game
  starts, go through the keeper.
- The "Rebuild storage" row belongs to the standalone mod. Do not copy `sk-options.js`. An embedded copy covers
  persistence. The row covers one rare repair for players who have the standalone mod.

## Layout (version 1, build 111)

The real `modSettings` row is a JSON object with these keys:

| Key | Meaning |
|---|---|
| `"<mod id>": { ... }` | a mod's section, as the options helpers keep it |
| `"__ls": { "<key>": "<string>" }` | every other `localStorage` key, stored as a string |
| `"__settings-keeper": { v: 1, root, since }` | the keeper's mark. A root without it is never used. |
| `"__blocked": { at, bytes, value }` | present only after a rebuild: the text of a row the keeper could not identify |

`window.SettingsKeeper` (also `localStorage.__settingsKeeper`) has `build`, `origin`, `status()`, `flush()`,
`rebuild()` and `uninstall()`. Use it for diagnostics only. `rebuild()` exists for the standalone mod's Options row.

## Licence

MIT, the same as the mod. No credit needed.
