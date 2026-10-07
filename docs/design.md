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

The row is read from the engine on every call. That is one SQLite query, about 1.8 ms for a 530 KB row, the same
cost the engine's own read has. It is parsed again only when its text changed. Serialising the root costs about
7.5 ms at that size. After start-up a write therefore only updates the root in memory and queues one engine write
for the end of the current JavaScript task, with `Promise.resolve().then(flush)`. A burst of writes costs one
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

## Removal

With the keeper gone the game reads row 1 again. In the normal layout that is `modSettings`. The helpers find their
sections, and the only difference is three internal fields they ignore. In fallback mode row 1 is the `"\u0001"`
root. The helpers would read its sections, write `modSettings`, see two rows and clear the store. Press the Rebuild
storage row, or save any option, while the keeper is still installed.

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
- The loader does not promise script order. See Script order. As one file the keeper ran first in every launch.
- The probe can overwrite a hidden row that happens to carry a guessed key. The key list only tries keys whose
  content matched, and the single-row rule applies to unmarked roots. No probe has hit a hidden row in any run or
  test.
- Every write serialises the whole row, several hundred KB with Demographics' history in it. That is about 8 ms per
  task that writes, whatever the number of writes in it (1.0.3). A mod that saves every turn adds that much per turn.
- If the keeper is removed while in fallback mode, the clear-on-second-entry helpers clear the store on their next
  save. The Rebuild storage row is the way out, and the README says to press it first.

## Verification

Unit tests in `tests/sk-core.test.mjs` (31 tests) run the keeper against a fake Storage that behaves exactly like the
engine: round trips, `modSettings` pass-through, the helper's clear guard, Tower's shape guards, write refusal,
`clear()`, the 2026-10-06 store, three foreign rows of two shapes, an unidentified row, a marked root next to a stale
copy, a restart, idempotent install, the cache, write coalescing, rebuild, and the build handoff. `npm run verify`
is the gate.

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
