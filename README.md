# Tower Settings Keeper

A Civilization VII mod that makes mod settings survive a restart. Install it and the options you set in other mods
stay set, in the main menu and in a game. It has no settings of its own and no effect on gameplay.

## The problem it fixes

Civilization VII's UI runtime has a defect in `localStorage`, the store mods use for their settings: every read
returns the first entry in the store, whichever entry was asked for, and the store cannot be listed. A mod can only
read its settings back if its entry happens to sort first. Every other mod gets some other mod's data, treats it as
its own, and when it saves, writes that data back under its own name. The visible result is options panels that
forget everything between launches, or one mod's settings turning up inside another.

Most options panels on the Workshop share one entry, `modSettings`, with a slice per mod, and about fifty of them
carry a helper that erases the whole store the moment it sees a second entry. So a single mod that keeps an entry of
its own silently wipes every other mod's settings on the next save.

## What the keeper does

It keeps every entry inside the one row the game reads correctly and answers every `localStorage` call from it:

- a mod's own key is stored and read back under its name;
- the shared `modSettings` entry is passed through unchanged, one slice per mod, so options panels work as written;
- the store never looks like it holds more than one entry, so the erase-on-second-entry helper never fires;
- on a store another mod has already pushed out of order, it moves the entries it can name into place and leaves
  anything it cannot name untouched; it looks again on every launch.

Mods do not need to be updated for it. It works with the ones that already exist.

## What it looks like

Settings changed in the main menu, then read back on the Options screen after a restart:

| Before | After the change | New process |
|---|---|---|
| ![](docs/images/1-menu-before.png) | ![](docs/images/1-menu-after.png) | ![](docs/images/2-menu-persisted.png) |

Settings changed inside a game, then read back after another restart, in the menu and in a game:

| In game, before | In game, after | Menu, new process | Game, new process |
|---|---|---|---|
| ![](docs/images/3-ingame-before.png) | ![](docs/images/3-ingame-after.png) | ![](docs/images/4-menu-after-game.png) | ![](docs/images/5-ingame-persisted.png) |

The mods act on the values, not only show them: with "Commander lens activation" set to Military and Recon Units
and persisted, selecting a scout in a fresh process activates Map Trix's commander lens (it does not with the
default):

![](docs/images/lens-persisted-scout.png)

Tested on 1.5.0 with 28 mods, Tower's and others' (Map Trix, City Hall, Celebratory Celebrations, Wonders Screen
Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, a settings manager, AutoMissionary, among
others). The record is in [docs/design.md](docs/design.md).

## Install

Subscribe on the Steam Workshop, or download the zip from the latest release and unpack it into
`~/Library/Application Support/Civilization VII/Mods/` (macOS) or
`%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows), then enable it under Additional
Content. Nothing to configure.

## What to expect

- **Settings saved from now on stay.** Settings lost before the keeper was installed are gone unless they are
  still on disk in an entry the keeper can name; see the next point.
- **A store that was already broken.** If some mod's entry sorts ahead of `modSettings` and the keeper cannot
  tell which mod wrote it, the keeper does not guess. It starts a fresh root ahead of everything, copies what it can
  see, keeps the rest untouched on disk, and tries again on every launch. In that state the settings you had before
  installing are not visible until the entry in the way is recognised (a later version may learn it). Existing
  mod data is never overwritten.
- **One launch may miss.** The game does not promise the order mod scripts run in. A mod that reads its settings
  at the very moment it loads, before the keeper has run, sees the old behaviour for that launch; it reads normally
  as soon as it next looks. Watched on three launches the keeper ran first every time.
- **Nothing shows on screen.** The keeper has no panel. The only trace is one line in `Logs/UI.log` beginning
  `[settings-keeper] ready:` on every launch.

## Removing it

With the keeper gone the game is back to reading the first entry. In the normal case that entry is `modSettings`
and the other mods find their slices as before, with a few extra fields they ignore. If the keeper is in its
fallback layout (the log line says `BLOCKED`), run Demographics' Storage options, Repair storage, or any mod's
options save, before disabling it; otherwise the erase-on-second-entry helpers would clear the store on their next
save.

## For modders

Nothing changes in how you write settings code. The shared-slice pattern and own-key pattern both work. If your mod
keeps a key of its own and you want an already-broken store repaired for your players, send the key name and a
content check that identifies your data (see the `KNOWN_KEYS` list in `ui/settings-keeper.js`); the keeper only
moves entries it can name.

## Licence

MIT. Code in `ui/`, text in `text/`.
