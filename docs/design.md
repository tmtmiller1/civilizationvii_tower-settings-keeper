# Tower Settings Keeper: design

## The engine bug

Civilization VII 1.5.0 and earlier implement `localStorage` in `GameCore_Serializer_LocalStorage` on top of a SQLite
file, `LocalStorage.sqlite`, table `Values(id, key, value)`. This is what each call does, as seen in the game
(Firaxis bug report 01 and the storage-survival and storage-ways probes in the Tower repo):

| Call | What happens |
|---|---|
| `setItem(k, v)` | correct. Keyed insert or replace. The empty key and keys that start with NUL are dropped. |
| `getItem(k)` | wrong. Returns the first row in key order whatever `k` is. A missing key also returns row 1. |
| `removeItem(k)`, `clear()` | correct, keyed |
| `length` | correct, `count(*)` |
| `key(i)` | always null |

Reads work for exactly one key, the lowest in sort order. A read-modify-write on any other key copies row 1 into
it. `"\u0001"` is the lowest key the engine will store.

## What the keeper does

There is one real row, the root, which the keeper owns. Its key is normally `modSettings`, the key the options
helpers already share. The public part of the row is the same `{ "<mod id>": { ... } }` object those helpers read
and write today.

```
modSettings = {
  "<mod id>": { ... },            one section per mod, as the helpers keep them (public)
  ...,
  "__ls": { "<key>": "<value>" }, every other localStorage key, as a string (internal)
  "__settings-keeper": { v, root, since },   the keeper's mark (internal)
  "__blocked": { at, bytes, value }          after a rebuild: a copy of the row it could not identify (internal)
}
```

Every method on the engine's `localStorage` object is replaced in place, as own properties that shadow
`Storage.prototype`. A reference a mod captured before the keeper ran therefore still goes through it.

- `getItem(k)`. For `modSettings`, the public part as JSON, or null when there are no sections. For any other key,
  `__ls[k]` or null.
- `setItem(k, v)`. For `modSettings`, the public part is replaced. The value must parse to an object, and the
  internal fields are carried over. For any other key, `__ls[k]` is set.
- `removeItem(k)`. The same, in reverse.
- `length` is 1 while the store holds anything. `key(i)` is null, as the engine answers (since 1.0.2). The helper
  that about fifty Workshop mods ship calls `clear()` when `length > 1`. It never runs.
- `clear()` empties the real store and writes the root back with `__ls` kept. Demographics' "Repair storage", which
  calls `clear()` and then writes `modSettings`, therefore keeps the other mods' keys.

The row is read from the engine on every call. That is one SQLite query: about 1.8 ms for a 530 KB row on
2026-10-06, and 1.5 ms for the 776,451-character row timed in a game on 2026-10-15. It is parsed again only when its
text changed, and the public part's text is cached the same way, so `getItem("modSettings")` on an unchanged row
costs that read and a string compare, 1.9 ms in all on 2026-10-15. The mod then parses what it gets, and that parse
is most of what a read costs it: 4.5 ms of the 6.3 ms a read plus parse took (see What a read and a write cost,
2026-10-15). Serialising the root costs milliseconds too, about 7.5 ms at 530 KB on 2026-10-06. After start-up a
write therefore only updates the root in memory and queues one engine write for the end of the current JavaScript
task, with `Promise.resolve().then(flush)`. A burst of writes costs one
serialisation, reads in between are served from memory, and nothing else can run before the queued write lands.
Start-up repairs, `clear()`, `status()` and `uninstall()` write synchronously.

Measured on 2026-10-06 (run `P1`, before this change): one own-key write 5.4 ms median, sixty 6 KB chunk writes
595 ms in total, an options-helper save 27 ms end to end (about 16 ms before the keeper, since those helpers already
rewrote this row). After the change (run `P2`): sixty own-key writes 1.2 ms inside the task, sixty chunk writes
0.1 ms, reads while a write is queued 0 ms, an options-helper save 15 ms. The one queued write, serialise plus engine
write, takes about 8 ms at the end of the task.

## Start-up: making the root row 1

Reads only work when the root is row 1. On install the keeper looks at row 1 and repeats these steps:

1. Row 1 carries the keeper's mark. Confirm the key with the probe described below and use it. Done.
2. Row 1 matches an entry in the `KNOWN_KEYS` list of `ui/settings-keeper.js` by content. The list covers the
   archive shape of ozq Chronicle and History and Rankings, AutoMissionary's settings, and Compact Policy Cards'
   store. Confirm the key with the probe, remove the row, keep its text, and look at the new row 1.
3. Row 1 is an unmarked settings root and it is the only row. Adopt it as `modSettings`. Done.
4. Row 1 cannot be identified but it is the only row. Nothing can hide behind it, so the keeper takes its text,
   clears the store and writes a normal `modSettings` root. The row's object-valued entries become sections and its
   full text is kept under `__blocked`. The row's key name is lost, which costs nothing because no mod could read it
   anyway. A later key list that recognises the text moves it under its key (`reclaimBlocked`).
5. Otherwise, with two or more rows that cannot be identified, the keeper goes into fallback mode. It writes the
   root under `"\u0001"`, which sorts before everything the engine stores, with the same salvage as in step 4. The
   unidentified rows stay on disk as they are.

Rows removed in step 2 are written into `__ls` at the end, so their mods read them back through the keeper.

The way out of fallback mode is the "Rebuild storage" row in `ui/sk-options.js`. It is a second shell and game
script, and it may import the Options model because it only has to run once the Options screen opens. The row is
registered hidden and shown only while `status().blocked`. A confirmation states how many rows will go. `rebuild()`
drops them and writes every section and key the keeper holds back as the one normal row.

Several mods may carry `settings-keeper.js`. See `embed/README.md`. `install()` keeps the first copy unless a later
one has a higher `BUILD`. In that case the older copy writes out its queued write and uninstalls, and the newer one
installs. Each copy logs the mod folder it ran from, taken from `import.meta.url`, and a handoff names both copies.

Once the root is row 1, `tidy()` removes raw rows hidden behind it for keys the root already holds. Those are older
copies nobody can read. The real store is then one row, and the clear-on-second-entry helpers stay quiet even if
the keeper is removed later. Only unknown keys hidden behind the root, or a fallback store, keep the row count above
one. The log says so when that is the case.

On each later launch in fallback mode the keeper lifts its own root, whose text it holds, and looks at the rows behind
it with the current key list. If every one can be identified, or the way to a lone `modSettings` is clear, it moves
back to the normal layout. The sections found behind are kept, the fallback root's newer sections win, and identified
rows become keys under `__ls`. Otherwise it puts its root back exactly as it was.

The root always carries the keeper's mark. After start-up, a row 1 without the mark means another mod wrote a row
raw since then, which can happen when a script that ran before the keeper writes at load. The keeper then reads
empty and refuses writes for the rest of the launch rather than copy that row over the shared settings. The next
start-up scan sorts it out.

The probe. `setItem(key, text)` with row 1's own text, then compare `length`. Unchanged means the key exists and
the row was rewritten with its own text. Grown means the key did not exist, and the probe row is removed. The one
residual risk is a probe on a key that exists as a hidden row somewhere else, which would overwrite that row with
row 1's text. That is why step 2 only tries keys whose content matched, and why step 3 only runs on a single-row
store. An unmarked settings root with rows behind it, such as a stale copy under a foreign key or a `modSettings`
clobbered with foreign data, goes to step 4 or 5 instead of being guessed at.

## Script order

The mod loader did not follow `LoadOrder` in one of three launches. A LoadOrder-9500 script ran before a
LoadOrder-1 script of the same mod. The keeper therefore assumes nothing about order. It patches the engine object in
place, so a mod that captured `localStorage` earlier is covered from the moment the keeper runs. Only a read made at
module load before that moment gets the engine's answer, and such mods read again when their options open.

### What the saved logs show, 2026-10-15

`devtools/compat/ready-order.py` read back every saved launch since the keeper became one file: the 2026-10-06 runs
from `C2` on and the 72 launches of 2026-10-07 in `runs/EMB`. It splits each `UI.log` where the game unloads a page,
so the main menu and every game load count once. That gives 225 loads with a keeper line, in 112 launches.

- In 224 of the 225 loads the keeper's first `ready` line came before any line from another mod. The lines ahead of
  it were the game's own (a CSS warning, the shell's ViewManager notice, three missing button icons, the game page's
  HTML warning), which is why it shows up as the third to tenth line of a load rather than the first.
- With other authors' mods on, their first lines came after it too: the options helpers' `LOAD <mod>.<option>=...`
  lines, Celebratory Celebrations' banner and the bz mods, in T6 and T7 (13 other authors' mods) and in the
  2026-10-06 runs (the player's 22 to 28 mods).
- The one exception is `S1-dams`, game load: Dams' `[Dams] active` line came one line before the keeper copy listed
  ahead of it in the same UIScripts group. `dams.js` runs its `install()` at module load, so its whole module ran
  first. In `S2-dams` and `S3-dams` the keeper came first. Dams keeps no settings, so nothing read the store early,
  but the order in which one mod's UIScripts are listed isn't a promise either.
- Which copy installs varies as well. With all 11 carriers on, Build Wonders' copy installed in 41 of 42 loads and
  All Display Options' in the other (`MX-L3`, the last game load). In the S3 launches the standalone and the
  carrier's copy traded places: the carrier's copy ran first in the main menu for Build Wonders, Canals, Dams,
  National Parks and Universal Auto Explore, and in the game as well for Build Wonders. The standalone ran first in
  every other load.

So the order does vary a little, and the keeper still lands ahead of every mod line seen so far but one. A log only
shows scripts that write a line when they load, so a mod that reads the store silently at load can't be placed this
way. The saved runs also predate four carriers (Numpad Unit Movement, Zoom, Tilt, & Rotate, Strategic Resources That
Matter, Partisans) and were all launched from `Mods/emb-*` copies, not the Workshop and `Mods/` folders players have.

Lab check for those gaps: five launches with the usual set and five with only the keeper, Canals, Numpad Unit
Movement and Partisans on, each to the main menu and into a Play Now game. Run `ready-order.py` on each saved
`UI.log` and note the keeper's line in each load and anything listed ahead of it. A Tower mod's settings line ahead
of the keeper in any launch is the cue to use the import below in that mod.

Usual-set launches from the overnight run of 2026-10-15 (installed copies, Workshop and `Mods/`, as players have
them; `ready-order.py` on each saved `UI.log`; the logs are in `working_screenshots/overnight-2026-10-15/L*-logs/`):

- L1 (Antiquity lab game): load 1 (main menu) line 3, load 2 (game) line 9, both from Numpad Unit Movement's copy;
  nothing from another mod ahead of it in either load.
- L2 (Exploration, Japanese), L3 (Modern, German), L4 (Antiquity, Polish): the same in each, lines 3 and 9, Numpad's
  copy, nothing ahead of it.
- L5 (Antiquity, with a save, a quit to the main menu and a load): four loads, lines 3, 9, 3 and 9, Numpad's copy,
  nothing ahead of it.

So the usual-set half: 5 launches, 12 loads, the keeper's line first in all 12, always Numpad Unit Movement's copy.

The launches with only the keeper, Canals, Numpad Unit Movement and Partisans on weren't part of that run: switching
the other mods off changes the registry, which the run didn't do. They ran the next day, below.

Four-mod launches, 2026-10-16 (watch run 2 block 1, K1-K5, runs `2026-10-16T18-36-53` to `18-39-30`): five lab
launches with only the keeper, Canals, Numpad Unit Movement and Partisans on (`Mods/` copies, working trees deployed),
each to the main menu and into a Play Now game. `ready-order.py` on each `UI.log`: 10 loads, the keeper's line first
in all 10, at line 3 in the main menu and line 9 in the game. Numpad Unit Movement's copy installed in 8 loads and
Canals' in 2 (the K1 and K4 game loads). Nothing from another mod came ahead of it. Logs in
`working_screenshots/watch2-block1/K1-logs/` to `K5-logs/`. With the usual-set half from 2026-10-15, that closes the
check.

### Waiting for the keeper (proposal, not rolled out)

A mod that has to read its settings the moment its script loads needs to know the keeper ran first. Two ways,
cheapest first:

1. Import the copy the mod already carries. Every Tower mod ships `settings-keeper.js`. The module that reads at load
   adds one line, `import "./settings-keeper.js";`, with the path relative to that module (a module in Demographics'
   `ui/` imports `./core/settings-keeper.js`). A module's imports run before the module itself, so the keeper has
   installed before that module's first line. The import names the same file the UIScripts entry loads, so it
   should run once; if it ever ran twice, the second copy would find the first and step aside. The keeper file
   itself doesn't change, so BUILD stays 112 and nothing has to be copied into the other carriers. Cost: one line in
   each module that reads at load, then a release of each mod that gets one. Risk: the importing module now waits
   for the keeper file, so it may run a little later than it did, which only matters to a module that relies on
   running early for some other reason. Confirm it once in the lab before relying on it: log a line from the
   importing module and check it lands after the keeper's `ready` in every load.
2. A ready event for mods that don't carry the file. After it installs, the keeper would dispatch
   `settings-keeper-ready` on `window`, next to the `window.SettingsKeeper` it already sets. A mod checks for
   `window.SettingsKeeper` first, listens for the event if it isn't there, and gives up after a short wait for
   players who don't have the keeper. This changes the shared file, so it means a new BUILD copied into all 16
   carriers and a release of each (see Sending out a new build), and it turns each mod's start-up read into one
   that waits, a bigger change in every mod than one import line. Other authors' mods would have to adopt it
   themselves.

Neither is rolled out. If a Tower mod is ever seen reading its settings before the keeper, give that mod the import.

## Removal

With the keeper gone the game reads row 1 again. In the normal layout that is `modSettings`. The helpers find their
sections, and the only difference is three internal fields they ignore. In fallback mode row 1 is the `"\u0001"`
root. The helpers would read its sections, write `modSettings`, see two rows and clear the store. Press the Rebuild
storage row, or save any option, while the keeper is still installed.

## Sending out a new build

Sixteen Tower mods carry `settings-keeper.js` next to this repo's copy: All Display Options, Build Wonders, Canals,
Cultural Diffusion, Dams, Demographics (under `ui/core/`), Emigration, Geographic Labels, Mod Commons, National
Parks, Numpad Unit Movement, Partisans, Readable Tool Tips, Strategic Resources That Matter, Universal Auto Explore
and Zoom, Tilt, & Rotate. On 2026-10-15 all 17 copies were BUILD 112 with the same hash (`npm run carriers`).

A new build reaches players only through each carrier's own release. Because the newest copy on a player's machine
wins, a rollout that's only part done still works: players get the new build from whichever mod brought it, and the
older copies step aside. The thing to prevent is the opposite, a copy whose bytes changed without a BUILD bump, which
would win or lose by load order alone.

`scripts/carriers.mjs` does the bookkeeping. With no options it lists every copy a modinfo loads, with its BUILD, its
hash and whether it's listed first in each UIScripts group, and exits 1 when any of that is off. `--dist` adds the
copies in each mod's `dist/`, which shows what its last built release carries. `--write` shows which copies a write
would replace, and `--write --yes` copies this repo's file over every copy with a lower BUILD whose repo has no
uncommitted change to it. It stops on a copy with the same BUILD and different bytes, on a newer BUILD, and on a
folder outside git. It never commits or releases; CONTRIBUTING.md has the steps that follow.

The cost of one rollout, as it stands: one matrix run in the lab before anything ships (`run-embed-matrix.sh`, now
15 carriers alone and together, about 52 launches, roughly an hour), then 16 releases, each with its own gate,
changelog line and Workshop change note. Mod Commons isn't released for now, so its copy waits in its repo.

## Review before release, 2026-10-06

Found and fixed:

- `readRoot()` accepted any plain-object row 1 as the root. A lower-sorting key written raw after start-up by a mod
  that ran before the keeper would have been read as the root and written back under `modSettings`. That is the
  contamination the mod exists to stop. The root is now always marked, and an unmarked row 1 is refused.
- Fallback mode was permanent. It is now checked again on every launch, a lone unidentified row collapses into a
  normal root (1.0.1), and stale hidden copies are removed so the store is one row.
- `getItem("modSettings")` serialised the public part on every call. It is now cached until the row changes.

Known limits:

- A row the keeper cannot identify is never touched, and the sections behind it stay out of sight until it can be
  identified. Players in that state see defaults for settings they had saved before the keeper. They could not read
  those settings before either, since the same row was in front. Demographics' Repair storage, which calls
  `clear()`, deletes those hidden rows as it did before the keeper. `__ls` survives it.
- The loader does not promise script order. See Script order. As one file the keeper ran first in every launch of
  this review. The 2026-10-07 runs found one game load where another mod's script ran ahead of it.
- The probe can overwrite a hidden row that happens to carry a guessed key. The key list only tries keys whose
  content matched, and the single-row rule applies to unmarked roots. No probe has hit a hidden row in any run or
  test.
- Every write serialises the whole row, several hundred KB with Demographics' history in it, once per task that
  writes, whatever the number of writes in it (1.0.3). On 2026-10-15 a write the way a mod makes it, `setItem` plus
  that engine write, took 13.9 ms, and a read plus parse 6.3 ms. Demographics saves every turn, so each turn pays a
  read, a write and a read-back; the other Tower mods write only when an option changes. The row is capped at 4 MB
  (1.3.0). See Load and limits, and Cutting the cost for what could bring it down.
- If the keeper is removed while in fallback mode, the clear-on-second-entry helpers clear the store on their next
  save. The Rebuild storage row is the way out, and the README says to press it first.

## Verification

Unit tests: 39 in a real `npm test` run on 2026-10-15, 35 in `tests/sk-core.test.mjs` and 4 in
`tests/i18n.test.mjs`. The core tests run the keeper against a fake Storage that behaves exactly like the engine:
round trips, `modSettings` pass-through, the helper's clear guard, Tower's shape guards, write refusal, `clear()`, the
2026-10-06 store, three foreign rows of two shapes, an unidentified row, a marked root next to a stale copy, a restart,
idempotent install, the cache, write coalescing, rebuild, the build handoff, and the size limit (a refused own-key
write keeps the old value, a refused `modSettings` write names the section that grew, the notice survives a restart,
and `removeItem` lowers the size estimate). The text tests check that every tag the code, data and modinfo use has
English text, that no tag is defined twice, and that each of the eleven translations has the same tags, placeholders
and markup and is registered for the menu and the game. `npm run verify` is the gate.

In-game record, 2026-10-06, Civilization VII 1.5.0 (1311346), macOS, `devtools/compat/run-all.sh` plus one extra
launch (runs `A`, `B`, `C`, `C2`, `D`). Mod set: the player's 22 enabled mods (Tower's Demographics, Emigration,
Cultural Diffusion, Geographic Labels, Canals, Universal Auto Explore, Readable Tooltips, All Display Options; bz
Map Trix, City Hall, Army Trix, Trix Fix, Zoom; Leonardfactory's Policy Yield Previews; Enhanced Town Focus Info;
QD's plot tooltip; Settlement Limit; JNR's age progression and warehouses; Readable Happiness Icons; sib Celebratory
Celebrations) plus Better Ribbon Info, Compact Policy Cards, History and Rankings, Wonders Screen Continued,
Mattifus's Mod Settings Manager and AutoMissionary 1.18. Play Now game, no turns played.

- A. Every options-helper mod logged `LOAD <mod>.<option>=undefined (stored|persistent)` at start. 27 options across
  bz-city-hall, bz-map-trix, sib-celebratory-celebrations (22) and wonders-screen-continued had never persisted.
- B. Each of the 27 was written by importing that mod's own `mod-options.js` and calling its `save()`. All read
  back. AutoMissionary's own `AutoMissionarySettings.set`, Compact Policy Cards' `setGlobalSettings`, Canals'
  `setMode`, Cultural Diffusion's `setClaimOnlyUnowned` and Geographic Labels' `setGlobalSettings` were also called.
- C. New process, store carried from B. The mods' own start-up lines read `LOAD ...=true (stored|persistent)` and
  `LOAD wonders-screen-continued={"skc":true}` for all 27. Canals `one-tile`, Cultural Diffusion `true`, Compact
  Policy Cards' own key and AutoMissionary's key read back. Demographics' 530 KB Hall of Fame section was intact.
  Sections grew from 5 to 11 with nothing lost. One real row throughout. No `erasing storage` line in any launch.
  No crash.
- D. The poisoned store from 2026-10-06, AutoMissionary's row in front of a clobbered `modSettings`. The keeper moved
  AutoMissionary's row, could not identify the clobbered root, and went into fallback mode without touching it.
  Reads worked. Mattifus's manager had already written into the clobbered row before the keeper ran in that launch.
- Script order. Split over three modules, the keeper ran after the probe and after AutoMissionary in both scopes, so
  AutoMissionary's module-time read got the engine's answer. As one file without imports (C2), the keeper's line was
  the first script line in both scopes and AutoMissionary's in-memory settings showed the saved values. The loader
  seems to run scripts as their imports resolve, not by LoadOrder. A single file is the lever, and still not a
  guarantee.

Options-screen record, 2026-10-06, `devtools/compat/run-options.sh` (runs `O1`, `O2`, `O3`, pictures in
`runs/proof/index.html`). Every change was made on the real Options screen by calling the control's own `toggle()`
or `onItemSelected()` and pressing Confirm, with the same mod set.

- O1, main menu. bz Map Trix "restyle yield banner" on to off, sib "Enable Celebration Fanfare" on to off, Canals
  rules By age to One-tile canals, Cultural Diffusion "claim empty land only" off to on. Confirm, quit without a game.
- O2, new process, main menu. The Options model and the screen show all four as set (`yieldBanner=0 (stored)`,
  `masterEnable=0 (persistent)` in the mods' own start-up lines). Then in a game: Commander lens All Military Units to
  Military and Recon, sib "Show Fireworks" on to off, Cultural Diffusion "borders recede" off to on. Confirm.
- O3, new process. The menu and the in-game Options screen both show all seven values (`commanders=3 (stored)`,
  `showFireworks=0 (persistent)`). One real row throughout.

Behaviour record, 2026-10-06, `devtools/compat/run-func.sh` and `sko-lens.js` (runs `F-control`, `F-persisted`,
`L-control`, `L-persisted`). The same probe on the player's untouched store (defaults) and on the store the Options
run left, each in a fresh process.

| Behaviour | Control (defaults) | Saved values |
|---|---|---|
| bz Map Trix yield banner: `body.bz-yield-banner` and the computed style of `yield-bar-entry` | class present; colour rgba(194,196,204), background rgba(246,206,85,.5) | class absent; colour rgba(217,200,173), background transparent |
| bz Map Trix `bzSetUnitLens` with the scout selected, after 14 AI turns | `fxs-discovery-lens` (the mod hands off) | `bz-commander-lens` (RECON setting) |
| bz options object at runtime | `commanders 2, yieldBanner true` | `commanders 3, yieldBanner false` |
| Cultural Diffusion live `CONFIG` after its `applyTunableOverrides()` | `claimOnlyUnowned false, recedeBorders false` | `true, true` |
| Canals start line and GameConfiguration pin | `rules: by age`, `{"mode":"ages"}` | `rules: one-tile canals`, `{"mode":"one-tile"}` |
| sib Celebratory Celebrations | `masterEnable=undefined`, `showFireworks=undefined` read into its CONFIG | `0`, `0` read into its CONFIG. The effect needs a celebration, which was not triggered. |

1.0.1 (runs `V2-poison`, `V2-clean`, `O-regress`). The 2026-10-06 store ends in the normal layout with one real row,
AutoMissionary's values read through the keeper and the clobbered row's section salvaged. The clean store is
unchanged. The Options screen in the menu and in a game reads back all seven values set in the 1.0.0 run.

1.1.0 (runs `R1`, `R1b`, `R1g2`, `R2`). On a store with two unidentifiable entries plus AutoMissionary's, the keeper
went into fallback mode (4 rows). The Rebuild storage row showed in Options, Add-ons from the main menu and from a
game. The game's own OK/Cancel dialog opened with the count ("3 stored entries..."). OK rebuilt the store (3 rows
dropped, sections and keys kept, one row) and the row disappeared. The next launch was in the normal layout with the
row hidden. Text is loaded in both scopes; the first in-game run showed raw LOC keys, which was fixed before release.

Build 111 next to an embedded build 110 (run `H-both`). The standalone copy ran first and logged
`ready (build 111 from tower-settings-keeper)`. The origin comes from `import.meta.url`, which the runtime provides.
Demographics' older copy found it and did nothing. The reverse order, an older copy installed first and replaced by a
newer one, is covered by the unit tests. Which copy runs first is up to the loader.

Embedded copy (runs `E-clean`, `E-poison`, `E-both`, 2026-10-07). The same file listed first in Demographics' shell
and game UIScripts, with the standalone mod not installed. It was the first script line in both scopes, the clean
store stayed in the normal layout, and the 2026-10-06 store was folded and collapsed to one row. With the standalone
installed as well there was one keeper, the second copy found it and did nothing, and both copies logged `ready`.

### Every carrier, 2026-10-07

72 launches in `devtools/compat/runs/EMB`, Civilization VII 1.5.0, macOS. `run-embed.sh` installs the repo copies of
the chosen carriers as `Mods/emb-<folder>` with every other user mod off, unless a run says otherwise, plus a probe
mod. In the main menu and then in a Play Now game the probe writes and reads back an own key, a `modSettings` section
and one real setting per Tower mod that has an option, through that mod's own settings module. Every installed copy
was BUILD 112 and byte-identical to this repo's file. The verdicts below come from rerunning the committed checkers
(`emb-check.py`, `eo-check.py`, `mx-check.py`) read-only on a copy of the runs on 2026-10-15.

| Runs | What they did | Launches |
|---|---|---|
| `S1`-`S3` per carrier | the 11 carriers of the day one at a time: S1 on the saved store with AutoMissionary's row in front, S2 a restart on what S1 left, S3 the row planted again with the standalone installed too. National Parks ran in Exploration, and again in Modern (`S1m`-`S3m`). | 36 |
| `S1b`-`S3b` | Emigration and Geographic Labels again, after a probe fix | 6 |
| `T1`-`T7` | all 11 carriers in Exploration: carriers only (T1, T2), with the standalone (T3, T4), an unknown row in front (T5), and with the player's 13 other mods on as well (T6 with the standalone, T7 without) | 7 |
| `T5b`-`T5d` | follow-ups to T5: a restart (T5b), the unknown row with carriers only (T5c), and its restart (T5d) | 3 |
| `EO-W`, `EO-R` | each of the 7 carriers with an option row, then all 7 together: the row changed on the in-game Options screen through its own control and Confirm (W), then read back after a full restart in the menu, in a new game and on the Options screen (R) | 16 |
| `MX-L1`-`L3` | all 11 carriers: settings changed on the real Options screen in the menu and in a game, then read back after each move in a chain of transitions | 3 |
| `CTRL-nokeeper` | no carrier, the control | 1 |

The player's other mods in T6 and T7: bz Map Trix, City Hall, Army Trix, Trix Fix and Zoom, sib Celebratory
Celebrations, Leonardfactory's Policy Yield Previews, Enhanced Town Focus Info, QD's plot tooltip, Settlement Limit,
JNR's age progression and warehouses, and Readable Happiness Icons.

- MX: every read matched the latest value set, for the 7 mods' settings and Canals' main-menu default, across all 14
  moves: a new game from the menu, exit to menu, exit then a new game, restart, a quick load in game, exit then a load
  from the menu, a load from the menu in the same session, and a relaunch followed by the menu, a load and a new game,
  from a game and from the menu. After a save loads, Canals' rule comes from the save, which is how Canals is built,
  and its menu default still read the latest value.
- EO: all 7 rows (`canals-mode`, `cd-require-adjacency`, `emigration-number-mode`, `geo-labels-terrain-following`,
  `np-overlay`, `uae-class-civilian`, `demographics-smooth-chart`) read back after the restart in the menu, in a new
  game and on the Options screen, one mod at a time and all together. One raw row and no crash report in each of the
  16 launches.
- S and T: 46 of the 53 launches passed every check. In every launch with a carrier, each copy logged `ready` from
  build 112 in both scopes, the store ended as one `modSettings` row with no section lost (or in fallback mode, with
  the rows behind it untouched, where an unknown row was planted), AutoMissionary's row was folded wherever it was
  planted, and no crash report was written. The 7 that failed:
  - S1-S3 Emigration: the probe wrote a snapshot interval of 7, which Emigration doesn't take, so it kept 1 and the
    read-back failed; S2 and S3 then compared against that 7. The probe now writes 3 or 4, and S1b-S3b passed.
  - S1-S3 Geographic Labels: the probe wrote the run's name into the `flat` setting, which is true or false, so the
    mod ignored it. The probe now flips the boolean, and S1b-S3b passed. In the 10-07 `verdicts.txt`, S1 shows a
    traceback from that morning's checker instead of a verdict; the committed checker reports a failed read-back.
  - T5b: it ran after S3b-geographic_labels and started from the store S3b left, not T5's, so its restart check
    compared against the wrong run. Every other check in it passed.

  The 10-07 `verdicts.txt` also lists T5 as failed, because that morning's checker expected the normal layout. An
  unknown row in front is what fallback mode is for, and that's what T5 shows: the root under `"\u0001"`, three rows,
  the unknown row untouched, reads and writes working. The committed checker expects fallback when the store starts
  with such a row, and T5 passes under it, as T5c and T5d did on the day.

The four carriers added since (Numpad Unit Movement, Zoom, Tilt, & Rotate, Strategic Resources That Matter,
Partisans) are now in the runner lists and in `emb-check.py`. The probe has no settings row for them yet, so a new
matrix run checks their copies, the store and the own keys, and not their own options.

The same logs also answer part of Script order; see What the saved logs show.

## Load and limits

Everything the keeper holds is one row, so its size is the one quantity that can grow without bound. On the test
machine the row was 530 KB with 28 mods on 2026-10-06, and 776,451 characters with the 16 Tower mods on 2026-10-15.
Demographics' Hall of Fame section is almost all of the part mods read (519,264 of 521,244 characters on
2026-10-15), and the options panels add a few hundred bytes each. Demographics caps that section at 512 KB
(`SLICE_BYTE_CAP` in its `history-archive.js`), so a player who keeps playing reaches about that size and stays
there. Most of the rest of the test machine's row is Mod Commons' `mod-commons-forks` key, 244,193 characters, which
players don't have while Mod Commons is unreleased. The number of mods doesn't matter on its own. What they store
does.

### The guard (1.3.0)

A write that would take the row past `LIMIT_BYTES` (4 MB) is refused. The keeper keeps a running estimate of the
row's size: exact after every read or flush, adjusted by the write's delta in between, so no write costs an extra
serialisation. For an own key the delta is the new value's length against the old one's. For a `modSettings` write it
is the new text against the cached public text. A refused write throws the `QuotaExceededError` browsers throw when
localStorage is full, built with `DOMException` where the runtime has it. The earlier value stays. The keeper records
`{ by, key, bytes, limit, at }` under `mark.refused` so the notice survives a restart, and logs one error line with
the same facts. `by` is the own key, or for a `modSettings` write the section that grew the most (the largest one
when none grew). The `ready` line reports the row size and any refusal.

An own-key refusal clears when a write for that key fits. A `modSettings` refusal clears only from the Options row,
because every mod writes that key and the next writer would clear another mod's notice. The row is "Storage limit
reached" under Options, Add-ons, hidden unless `status().refused` is set. Pressing it opens the game's OK dialog with
the mod, the size the write would have reached and the limit; OK calls `dismissRefusal()` and hides the row. The row
and its text are in `sk-options.js` and the text files; an embedded copy refuses and logs but shows no row.

`removeItem` lowers the estimate by the removed value, so a replace-by-remove-and-add of the same size fits. The
keeper's own start-up writes (folding, the fallback copy, rebuild) are not guarded.

### Where the engine gives up, 2026-10-06

Probes in `devtools/compat`: `sko-volume.js`, `sko-volume-quiet.js`, `sko-volume-raw.js`, `sko-volume-raw2.js`,
`sko-volume-start.js` (runs `VOL-grow`, `VOL-grow2`, `VOL-raw`, `VOL-raw2`, `VOL-start`, `VOL-quiet`). Play Now
game with the player's 28 mods, the probe starting 15 s after the game loaded. Each run started from the real 530 KB
store and the runner put the store back afterwards. Sizes are JSON characters of the `modSettings` row.

| Run | What it did | Result |
|---|---|---|
| `VOL-grow` | 1 MB per step through the keeper; after each step a flush, a raw engine read of the row, a keeper read of a missing key (which re-parses the row), a read-back of chunk 1 and two `status()` calls | 13 steps clean; at the 14 MB step the process stopped after `setItem`, inside the flush. No crash report. |
| `VOL-grow2` | the same with a log line after each sub-step | the same, at the same step |
| `VOL-raw` | plain strings of 14.2, 14.7, 15.2, 16.0, 16.8 and 17.0 million characters: `JSON.stringify` of each, then a raw engine `setItem` of each | all pass; stringify about 60 ms, engine write 19 to 26 ms |
| `VOL-raw2` A | raw engine writes growing 1 MB per step to 20 MB, no keeper | all pass, 5 to 56 ms |
| `VOL-raw2` B | the keeper with one 15 MB value, one flush | pass, 102 ms, row 16.26 MB |
| `VOL-raw2` C | the keeper with 15 one-MB keys written in one task, one flush | pass, 110 ms, row 16.26 MB, last chunk reads back |
| `VOL-start` | a fresh launch on the 14 MB store `VOL-grow` left | main menu and game loaded, keeper `ready` with 13 keys and all 5 sections; the 13 chunks read back intact; the process then stopped during a raw parse of the row followed by a flush |
| `VOL-quiet` | 1 MB per step through the keeper, one flush per step and nothing read back | 20 steps clean (15 to 197 ms per flush); the process stopped at the 21 MB step inside the flush, at 1.9 GB resident. No crash report. |

Per-step timings from `VOL-grow` (flush is serialise plus engine write; the key read re-parses the row because the
write invalidated the cache):

| Row | Flush | Key read | Raw engine read |
|---|---|---|---|
| 1.6 MB | 19 ms | 5 ms | 4 ms |
| 5.8 MB | 71 ms | 20 ms | 14 ms |
| 11.0 MB | 101 ms | 64 ms | 32 ms |
| 14.2 MB | 141 ms | 67 ms | 68 ms |

What this says: the storage itself took every size tried, up to 20 MB in a raw write, and the keeper's reads and
writes stayed correct at every size. The ceiling is the game process, which stops without a crash report somewhere
between 14 MB (with repeated re-reads of the row) and 21 MB (without), with resident memory near 2 GB. The 4 MB
limit is a quarter of the lower figure, about eight times the 0.5 MB a full hall of fame makes, and five times the
test machine's whole row on 2026-10-15. No mod in the corpus stores more than
Demographics' history, and nothing but a history-keeping mod grows over a game.

### Many small keys, 2026-10-06

Run `BURST-1`, `sko-burst.js`, main menu, the real 530 KB store.

| What | Result |
|---|---|
| 2000 `setItem` calls in one task | 10 ms for the loop, 11 ms for the one flush; row 568 KB; `many-1999` reads back |
| 200 writes each in its own task, 200 flushes | 1148 ms, 5.7 ms per write |
| 2000 `getItem` calls | all correct, 1888 ms, 0.9 ms per read |
| remove all 2200 keys | row back to 530 KB, keys 0, one engine row throughout |

A read costs an engine read of the whole row, because the keeper re-reads row 1 on every call to notice a raw write
by a mod that ran before it. At 530 KB that was about a millisecond (0.9 ms per own-key read above); on 2026-10-15
the engine's read of the 776,451-character row took 1.5 ms. A read of `modSettings` adds the mod's own parse, 4.5 ms
of the 6.3 ms it took on 2026-10-15. A mod that reads a few values when its panel opens doesn't notice. A loop over
thousands of keys does, and so does a mod that reads `modSettings` on every key press or unit selection.

### The guard in game, 2026-10-06

Runs `LIMIT-1` to `LIMIT-3`, `sko-limit.js` on the real Options screen from the main menu, the real store.

- `LIMIT-1` crashed 40 s after launch with the vanilla signature from the engine-closed notes (SIGSEGV on a worker
  thread, `CivilizationVII+0x21091fc`, the same frames as the 2026-09-17 reports shifted by the 1.5.0 build). The
  store showed the refusal mark had been written before the crash. Reran, as that signature requires.
- `LIMIT-2`: `DOMException` is not defined in the game's runtime, so the quota error is a plain `Error` named
  `QuotaExceededError` with `code` 22. A 5 MB `setItem` threw it with the message naming the key and the sizes, the
  earlier value `"small"` read back, and `status().refused` held `{ by: "limit-test", bytes: 5773039, limit:
  4194304 }`. Options, Add-ons showed "Storage limit reached" with a Details button under the mod's group. Pressing
  it opened the game's dialog with the title, the body naming `limit-test`, 5.5 MB and 4.0 MB, and one OK. OK
  cleared the notice (`refused: null`), the row hid, and the value was still `"small"`.
- `LIMIT-3`: the same again for the pictures in `docs/images`.

### What a read and a write cost, 2026-10-15

Lab game of 2026-10-15: Civilization VII 1.5.0, seed 4242, Antiquity, the 16 Tower mods with every other user mod
off. The keeper that ran was BUILD 112 from Numpad Unit Movement's copy. One script timed each step with
`performance.now()`, 20 reads and 10 writes (`working_screenshots/lab-probes-2026-10-15/NOTES.md` in the workspace,
probe 4; the script and its result are in Tower Bench's evidence log for that day).

The row, in characters. The split of the parts that aren't timed comes from the store on disk, which held the
pre-launch 771,019-character row; the hall of fame grew by about 5,000 characters during the game.

| Part | Characters |
|---|---|
| The engine's `modSettings` row in the game | 776,451 |
| The public part, what `getItem("modSettings")` returns | 521,244 |
| of that, `demographics-halloffame` | 519,264 |
| of that, every other section (`demographics` and six more) | under 2,000 |
| `__ls`, the keys mods store under their own names (on disk) | 255,978 |
| of that, Mod Commons' `mod-commons-forks` (on disk) | 244,193 |

The timings, in milliseconds:

| Step | Mean | Median | Range |
|---|---|---|---|
| Engine read of the row (`SettingsKeeper.engine.get`) | 1.54 | 1.47 | 1.21 to 2.37 |
| `getItem("modSettings")` through the keeper | 1.91 | 1.75 | 1.53 to 3.06 |
| `JSON.parse` of the 521,244 characters | 4.54 | 3.93 | 3.41 to 6.79 |
| Read plus parse, timed as one | 6.31 | 5.73 | 4.78 to 12.39 |
| The mod's `JSON.stringify` of the root it read | 2.58 | 2.63 | 1.73 to 4.21 |
| `setItem("modSettings", text)`, the engine write left queued | 9.14 | 9.24 | 7.12 to 12.63 |
| `setItem` plus `SettingsKeeper.flush()` | 13.95 | 14.41 | 11.30 to 16.85 |
| Engine write of the row (`SettingsKeeper.engine.set`) | 1.48 | 1.48 | 1.44 to 1.55 |

What the numbers say:

- The keeper's own share of a read is small: 1.9 ms against the engine's 1.5 ms. The row's text matched the cache,
  so the keeper compared strings and handed back the cached public text. Most of a read is the mod parsing half a
  megabyte. The 1 to 1.8 ms these docs gave before was the engine's read alone, not what a mod sees.
- `setItem` takes 9.1 ms because the keeper parses the text it's handed (521,244 characters, about the 4.5 ms of any
  parse that size) and, to size the write against the limit, serialises the old public part again, since the
  previous write cleared that cache. A write that comes straight after a read finds the public text cached and should
  skip that step, roughly the 2.6 ms the mod's own stringify of the same root took. That case wasn't timed.
- The queued engine write, serialise the whole row and store it, is the difference of two lines, about 4.8 ms, of
  which the engine's write is 1.5 ms. It wasn't timed on its own. The 2026-10-06 runs gave about 8 ms for the same
  step at 530 KB; the gap isn't explained.
- A mod's whole save (read, change, stringify, write) adds up to about 6.3 + 2.6 + 13.9 = 22.8 ms, a little less
  when the write follows its read with nothing written in between.
- After the 10 writes the row read back unchanged.

The same game timed the mods that read on events. Numpad Unit Movement reads and parses `modSettings` on every
key-down, 7.7 ms a press. Universal Auto Explore made 6 reads per unit selection, about 44 ms, and 6 per move, about
35 ms. Demographics saves its hall of fame every local turn: a read and parse, a stringify of its slice to fit the
budget and another of the root, `setItem`, a read-back to verify, and the queued engine write. Adding the parts above
puts that at around 30 ms a turn; it wasn't timed.

### Cutting the cost (proposals, nothing built)

The cost players feel comes from mods that read on every event, not from one read. The store's size multiplies it.
These are in order of gain against risk. The first three leave the keeper as it is. The rest change
`ui/settings-keeper.js`, which every Tower mod carries as BUILD 112, so each means a new BUILD copied into all 17
copies and 16 releases (see Sending out a new build); bundle them if any go ahead.

1. **Mods read once and keep the values.** The keeper stays as it is. A mod that keeps its settings and reads them again
   only when they may have changed pays the 6.3 ms once instead of per event. Zoom, Tilt, & Rotate and Build Wonders
   already work this way. Universal Auto Explore does now (unreleased): one read, then a fresh read when this script
   writes an option, when the save's copy in `GameConfiguration` changes, and at each local turn. Numpad Unit Movement
   is next (its 2026-10-15 prompt, step 3). Gain: the whole per-event cost; for Universal Auto Explore about 44 ms a
   selection becomes a lookup. Risk: a value kept in one script context goes stale when another context writes, so each
   mod needs a refresh it can trust, such as a window event in its own context, an engine-side stamp like the save's
   copy, or a re-read at turn start. Cost: a release of each mod. Lab check: `modSettings` read once, on the first
   selection or key press, and an Options change taking effect without a restart.
2. **Move Demographics' hall of fame out of `modSettings`.** A Demographics release; the keeper stays as it is.
   Demographics keeps it in the shared row because a second top-level key used to be wiped by the clear-on-second-entry
   helpers. With the keeper an own key lives in `__ls` inside the same row, `length` stays 1, and
   `getItem("modSettings")` returns only the sections. Demographics carries the keeper, so it always has one. Gain:
   every other mod's read of `modSettings` shrinks from 521,244 characters to about 1,950, so the parse drops from
   4.5 ms to a fraction of a millisecond and a read plus parse to about the 1.9 ms of `getItem`. Their writes lose the
   parse and stringify of half a megabyte, and Demographics' own write gets cheaper too, since the keeper's own-key
   write doesn't parse anything. The engine's read and the queued write still handle the whole row, so those stay.
   Risks:
   - Stored as a string inside the row, the slice's quotes are escaped: 513,832 characters of JSON became 579,886.
     That's 13% more room in the row, against the 4 MB guard, and a little more for the engine's read and write.
   - Migration: write the slice under the new key, read it back, then drop the section, and read both places with the
     merge `mergeSlices` already does until the section is gone. A crash between the steps leaves two copies, which
     the merge handles.
   - Going back a version: an older Demographics finds its section gone and shows an empty hall of fame. The games are
     still in `__ls`, and the next new version reads them again.
   - With the keeper not working (start-up failed, or row 1 isn't its root), an own-key read returns null. Demographics
     should fall back to the section then and say so in its footer, as it does for an unverified archive today.
   - Repair storage calls `clear()` and writes the slices back into `modSettings`; it would have to write the hall of
     fame under its key instead. The keeper's `clear()` keeps `__ls`, so the key survives a clear.

   Lab check: with Demographics on, `getItem("modSettings")` is a few thousand characters, a read plus parse about
   2 ms, the hall of fame shows every game after a restart, and the released Demographics, put back, shows what a
   downgrade looks like.
3. **A smaller hall of fame.** Demographics only. `SLICE_BYTE_CAP` is 512 KB, about 30 long games with timelines. A
   128 KB cap would make every read and write of the shared row about a quarter of today's for a player with a full
   hall of fame. Risk: players lose history they can see; `fitSlice` drops older games' maps and timelines first,
   then whole games, oldest first. Owner decision, and 2 makes it unnecessary for every mod but Demographics.
4. **Keep the text a mod wrote as the cached public text.** Keeper BUILD. `setRoot` clears `cachePublic`, so the next
   read or write serialises the public part again: the step inside `setItem`'s 9.1 ms, and the same again on the first
   read after a write, such as Demographics' read-back. When the written object holds only mod sections, the text the
   mod passed is the public text, and the keeper can keep it, through the flush as well. Gain: about 2.5 ms per write
   and per first read after one. Risk: low. The kept text has the mod's formatting and key order, which parse to the
   same object; it mustn't be kept when the text carried an internal key, and `flushRoot`'s `setCache` mustn't clear it.
   Unit tests can pin each case.
5. **Skip a write that leaves the row as it was.** Keeper BUILD. When the text handed to `setItem("modSettings")` equals
   the cached public text, return before parsing. Gain: the whole write, about 14 ms, for each save of unchanged
   settings. How often mods do that isn't known; count it first in a lab game with a probe wrapper around `setItem`.
   Risk: very low. The comparison is against the row as just read, so a write that would change the row always goes
   through.
6. **A section API.** Keeper BUILD, then each mod. `SettingsKeeper.getSection(id)` hands out a copy of one section
   from the keeper's parsed root, and `setSection(id, obj)` replaces it and queues the write. A mod then skips the
   parse of half a megabyte on a read (6.3 ms to about 1.9) and the read, stringify and parse on a write. Risk: a new
   API in a file 17 mods carry; a mod has to fall back to `localStorage` when an older build is the one installed; it
   must hand out copies, never the keeper's own objects; other authors' mods won't use it. After 2 the gain is well
   under a millisecond, so do 2 first.
7. **Build the row text from cached parts.** Keeper BUILD. Instead of `JSON.stringify(root)` on each flush, join the
   cached public text, a cached serialisation of `__ls` and the mark. Gain: most of the flush's serialise, about 3 ms
   of its 4.8. Risk: high for the gain. Hand-built JSON in the one row every mod shares, where a missing comma or a
   reordered key corrupts everyone's settings. Only worth it if a measurement shows the flush matters.
8. **Hold the engine write longer.** Keeper BUILD. Writes are joined within one task today; holding the write for a
   frame or a few hundred milliseconds would join writes from several tasks. Gain: one serialise and engine write per
   extra writer in a burst, and there's little sign of bursts (Demographics writes once a turn, Options rows once a
   click). Risk: a quit or crash inside the window loses the write, and a keeper in another script context that reads
   the row in that window gets the old text and can write over the new one. The end-of-task write rules that out,
   because nothing else runs before it lands. Not recommended.
9. **Skip the engine read on each call.** Keeper BUILD. Trusting the cache would save the 1.5 ms read, but that read
   is how a keeper notices a write from another script context or from a mod that ran before it. Without it a stale
   root could be written back over another mod's change. Not recommended.

On the test machine a third of the row is Mod Commons' `mod-commons-forks` key, so every engine read and flush there
handles it, and the 1.5 ms read and 4.8 ms write above are larger than a player's would be. If Mod Commons ships, that
cache belongs in a key that stays small or gets pruned; that's for its own prompt.
