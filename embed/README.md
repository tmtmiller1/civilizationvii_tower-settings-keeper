# Shipping the keeper inside your own mod

One file, two modinfo lines. Your players get working, persistent settings without installing anything else, and
your mod's settings code does not change.

## Why

Civilization VII's `localStorage.getItem(key)` returns the first stored entry whatever key is asked for, and the
store cannot be listed. A mod can read its settings back only if its entry sorts first; everything else reads some
other mod's data and, on its next save, writes that data back under its own name. The widely copied options helper
erases the whole store the moment it sees a second entry. Details and the test record:
[docs/design.md](../docs/design.md).

## What the file does

`settings-keeper.js` patches the engine's `localStorage` object in place so that every key lives inside the one
entry the game reads correctly, `modSettings`:

- `getItem` / `setItem` / `removeItem` on your own key read and write `modSettings.__ls[<your key>]`;
- `getItem("modSettings")` returns the usual `{ "<mod id>": { ... } }` object and `setItem("modSettings", ...)`
  merges it back, so the shared-slice pattern works unchanged;
- `length` reports 1 and `key(i)` is null, so the erase-on-second-entry helper never fires;
- at start-up it sorts out a store another mod has already pushed out of order, without overwriting anything.

## Steps

1. Copy `settings-keeper.js` into your mod, unchanged, for example as `ui/settings-keeper.js`. It is the file beside
   this README in the kit, and `ui/settings-keeper.js` in a subscribed copy of the Tower Settings Keeper mod.
2. List it as the **first** `<Item>` in `<UIScripts>` of **both** your shell and your game action groups:

   ```xml
   <UIScripts>
       <Item>ui/settings-keeper.js</Item>
       <Item>ui/my-mod.js</Item>
   </UIScripts>
   ```

   It imports nothing, so the loader runs it as early as any script. (The loader does not honour `LoadOrder`
   across scripts; a script's module graph decides when it runs. That is why the file has no imports and why yours
   should list it first.)

3. Nothing else. Keep your settings code as it is.

To check it ran, look for one line per scope in `Logs/UI.log`:

```
[settings-keeper] ready (build 111 from <your mod folder>): root "modSettings", rows 1, slices 7, keys kept 2
```

## Several mods carrying it

That is the intended case. The first copy to run installs; every later copy finds it (`localStorage.__settingsKeeper`)
and stands down. A copy with a higher build number than the installed one takes over: the older copy lands any write
it still holds, uninstalls, and the newer one installs; the log says which mod's copy replaced which. So the newest
file on the player's machine is the one that runs, whichever mod it came in.

Take new builds from this repository's releases (`settings-keeper-embed-<version>.zip`) and replace your copy when
you next release; no other step.

## Rules

- Do not edit the file. A changed copy with the same build number would win or lose against the original by load
  order alone, and the contract below is what other mods rely on.
- Do not add imports to it or to a wrapper that loads it first; that delays it.
- Do not read `localStorage` at your module's top level if you can avoid it. If your script happens to run before the
  keeper in some launch, that one read sees the engine's answer; reads made later, when the player opens your panel
  or a game starts, go through the keeper.
- The "Rebuild storage" row stays with the standalone mod; do not copy `sk-options.js`. An embedded copy covers
  persistence; the row covers one rare repair for players who have the standalone mod.

## Contract (layout v1, build 111)

The real `modSettings` row is a JSON object:

| Key | Meaning |
|---|---|
| `"<mod id>": { ... }` | a mod's slice, as the options helpers keep it (public) |
| `"__ls": { "<key>": "<string>" }` | every other `localStorage` key, as a string |
| `"__settings-keeper": { v: 1, root, since }` | the keeper's mark; a root without it is never built on |
| `"__blocked": { at, bytes, value }` | only after a rebuild: the text of a row the keeper could not name |

`window.SettingsKeeper` (also `localStorage.__settingsKeeper`): `build`, `origin`, `status()`, `flush()`,
`rebuild()`, `uninstall()`. Treat it as read-only diagnostics; `rebuild()` is for the standalone mod's row.

## Licence

MIT, same as the mod. No credit needed.
