# Tower Settings Keeper

A Civilization VII mod. With it installed, the options you set in other mods stay set after you restart the game.
It has no options of its own and does not change gameplay.

## The problem

Mods keep their settings in the game's `localStorage`. In Civilization VII 1.5.0 that store has a bug. A read returns
the first entry in the store no matter which entry was asked for, and there is no way to list the entries. A mod can
read its own settings only if its entry happens to sort first. Every other mod gets a different mod's data, treats it
as its own, and writes it back under its own name the next time it saves.

Players see options panels that reset between launches, and sometimes one mod's settings showing up inside another.

Most options panels share one entry called `modSettings`, with a section for each mod. About fifty Workshop mods
also include a helper that clears the whole store as soon as it sees a second entry. One mod that stores its
settings under its own entry is enough to wipe every other mod's settings on the next save.

## What the mod does

It keeps every entry inside the one row the game can read, and answers every `localStorage` call from that row.

- A mod that uses its own key gets it stored and read back under that key.
- The shared `modSettings` entry works as before, one section per mod, so existing options panels need no changes.
- The store always reports a single entry, so the clear-on-second-entry helper never runs.
- If another mod has already pushed the store out of order, the mod moves the entries it can identify into place
  and leaves the rest alone. It checks again on every launch.

## Works with every mod, no changes needed

This mod fixes the problem for every mod that stores settings, as those mods are today. Mod authors do not have to
change anything, and there is nothing for them to register. A player who installs this mod gets working settings in
all of their mods at once.

Mod authors have one extra option. They can ship the same file inside their own mod, so their players are covered
even if they never install this mod. That is described under For modders below. A mod that ships the file and this
mod can be installed together. Only one copy runs, the newest one, and the rest do nothing.

## Screenshots

Options changed in the main menu, then read back from the Options screen after a restart:

| Before | After the change | After a restart |
|---|---|---|
| ![](docs/images/1-menu-before.png) | ![](docs/images/1-menu-after.png) | ![](docs/images/2-menu-persisted.png) |

Options changed during a game, then read back after another restart, in the menu and in a game:

| In game, before | In game, after | Menu, after a restart | Game, after a restart |
|---|---|---|---|
| ![](docs/images/3-ingame-before.png) | ![](docs/images/3-ingame-after.png) | ![](docs/images/4-menu-after-game.png) | ![](docs/images/5-ingame-persisted.png) |

The other mods use the stored values, not only display them. Map Trix's "Commander lens activation" was set to
Military and Recon Units and saved. In a fresh process, selecting a scout turns on its commander lens, which does not
happen with the default setting:

![](docs/images/lens-persisted-scout.png)

Tested on 1.5.0 with 28 mods, including Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued,
Better Ribbon Info, Compact Policy Cards, History and Rankings, a settings manager and AutoMissionary. The full
record is in [docs/design.md](docs/design.md).

## Install

Subscribe on the Steam Workshop, or download the zip from the latest release and unpack it into
`~/Library/Application Support/Civilization VII/Mods/` on macOS or
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` on Windows. Then enable it under Additional
Content. There is nothing to configure.

## Things to know

- Settings you save from now on stay. Settings that were lost before you installed the mod are gone, unless they
  are still on disk under an entry the mod can identify.
- If the store was already broken, the mod does not guess which mod wrote an entry it cannot identify. If that
  entry is the only one left, the mod rebuilds the store around it and keeps the entry's contents. The entry's name
  is lost. A later version that recognises the contents puts them back under the right name. If two or more such
  entries are in the way, the mod starts a fresh root ahead of them, leaves them on disk, and tries again on the next
  launch. It never overwrites another mod's data.
- The game does not guarantee the order mod scripts run in. A mod that reads its settings at the moment its script
  loads, before this mod has run, sees the old behaviour for that one launch. In every test launch so far this mod
  ran first.
- The mod's own text is translated into all eleven languages the game supports.
- Nothing appears on screen, apart from one line in `Logs/UI.log` that starts with `[settings-keeper] ready:`. The
  exception is the fallback case above. Then Options, Add-ons shows a "Rebuild storage" row. Press it, confirm, and
  the entries the mod could not identify are deleted and the store is written back as one entry. The row goes away
  once the store is normal.

  | The row, shown only when needed | The confirmation |
  |---|---|
  | ![](docs/images/rebuild-row.png) | ![](docs/images/rebuild-dialog.png) |

## Removing the mod

Usually there is nothing to do. The store is one row, so the game reads `modSettings` first as it did before, and
other mods find their sections. The only extra content is a few internal fields they ignore. If Options shows the
"Rebuild storage" row, press it before you disable the mod. Otherwise the clear-on-second-entry helper in other
mods will wipe the store on its next save.

## For modders

Nothing is required of you. Your mod's settings work with this mod installed, whether your mod uses the shared
`modSettings` entry or its own key, and whatever helper code it uses.

If you want your players covered without them installing this mod, you can ship the fix inside your own mod.
Players then get it without installing anything else. It is one file and two lines in your modinfo, and your
settings code stays as it is. See [embed/README.md](embed/README.md), or
download `settings-keeper-embed-<version>.zip` from the latest release. Several mods can carry the file at once.
The first copy to load installs, later copies find it and do nothing, and a newer build replaces an older one.

If your mod stores its settings under its own key and you want already-broken stores repaired for your players,
send the key name and a check that identifies your data. See the `KNOWN_KEYS` list in `ui/settings-keeper.js`. The
mod only moves entries it can identify.

## Licence

MIT.
