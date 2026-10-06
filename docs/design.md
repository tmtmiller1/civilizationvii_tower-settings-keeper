# Tower Settings Keeper: design

## The engine defect

Civilization VII 1.5.0 (and earlier) implements `localStorage` in `GameCore_Serializer_LocalStorage` over a SQLite file
(`LocalStorage.sqlite`, table `Values(id, key, value)`). Watched behaviour (Firaxis bug report 01, the storage-survival and storage-ways probes in the
Tower repo):

| Call | Behaviour |
|---|---|
| `setItem(k, v)` | correct: keyed insert-or-replace; the empty key and keys starting with NUL are dropped |
| `getItem(k)` | WRONG: returns the first row in key order whatever `k` is; a missing key also returns row 1 |
| `removeItem(k)`, `clear()` | correct, keyed |
| `length` | correct `count(*)` |
| `key(i)` | always null |

So reads work for exactly one key, the lowest in sort order, and a read-modify-write on any other key copies row 1
into it. `"\u0001"` is the lowest key the engine stores.

## What the keeper does

One real row, the root, owned by the keeper. Normally its key is `modSettings`, the key the options helpers already
share, so the row's public part is the same `{ "<mod id>": { ... } }` object they read and write today.

```
modSettings = {
  "<mod id>": { ... },            one slice per mod, as the helpers keep them (public)
  ...,
  "__ls": { "<key>": "<value>" }, every other localStorage key, as a string (internal)
  "__settings-keeper": { v, root, since },   the keeper's mark (internal)
  "__blocked": { at, bytes, value }          only in fallback mode: a copy of the row it could not name (internal)
}
```

Every method on the engine's `localStorage` object is replaced in place (own properties that shadow
`Storage.prototype`), so a reference captured before the keeper ran still goes through it:

- `getItem(k)`: `modSettings` returns the public part as JSON, or null when there are no slices; any other key returns
  `__ls[k]` or null.
- `setItem(k, v)`: `modSettings` replaces the public part (the value must parse to an object; the internal fields are
  carried over); any other key sets `__ls[k]`.
- `removeItem(k)`: likewise.
- `length` reports 1 while the store holds anything; `key(i)` is null as the engine has it (1.0.2). The helper that
  ~50 Workshop mods ship calls `clear()` when `length > 1`; it never fires.
- `clear()` empties the real store and rewrites the root with `__ls` kept. Demographics' "Repair storage" (clear, then
  write `modSettings` back) therefore keeps the other mods' keys and returns a fallback-mode store to the normal
  layout.

The row is re-read from the engine on every call (one SQLite query) and re-parsed only when its text changed.

## Start-up: making the root row 1

Reads only work when the root IS row 1. On install the keeper looks at row 1 and loops:

1. Row 1 carries the keeper's mark: confirm the key with a probe (below) and use it. Done.
2. Row 1 matches one of the known foreign keys in the `KNOWN_KEYS` list of `ui/settings-keeper.js` by content (the archive shape of ozq Chronicle /
   History & Rankings, AutoMissionary's settings, Compact Policy Cards' store): confirm the key with the probe, remove
   the row, keep its text, continue with the next row 1.
3. Row 1 is an unmarked settings root and it is the ONLY row: adopt it as `modSettings`. Done.
4. Row 1 cannot be named but is the ONLY row: nothing can hide behind it, so the keeper takes its text, clears the
   store and writes a normal `modSettings` root with the row's object-valued entries as slices and its full text
   under `__blocked`. The row's key name is the one thing lost (no mod could read it anyway); a later key list that
   recognises the text moves it under its key (`reclaimBlocked`).
5. Otherwise (two or more rows that cannot be named) fallback mode: write the root under `"\u0001"`, which sorts
   before everything the engine stores, with the same salvage; the unnamed rows stay on disk untouched.

Once the root is row 1, `tidy()` removes raw rows hiding behind it for keys the root already holds (older copies
nobody can read), so the real store is one row and the erase-on-second-entry helpers stay quiet even after the keeper
is removed. Only unknown keys hiding behind the root, or a fallback store, keep the row count above one; the log says
so.

Rows removed in step 2 are written into `__ls` at the end, so their mods read them back through the keeper.

On every later launch in fallback mode the keeper lifts its own root (its text is in hand), looks at the rows behind
it with the current key list, and if every one can be named, or the way to a lone `modSettings` is clear, moves back
to the normal layout: the slices found behind are kept, the fallback root's newer slices win, named rows become
virtual keys. Otherwise the root is put back exactly as it was.

The root always carries the keeper's mark. After start-up, a row 1 without the mark is a row another mod wrote raw
since (a script that ran before the keeper and writes at load); the keeper then reads empty and refuses writes for
the rest of the launch rather than copy that row over the shared settings, and the next start-up scan sorts it out.

The probe: `setItem(key, text)` with row 1's own text, then compare `length`. Unchanged means the key exists and the
row was rewritten with itself; grown means it did not exist and the probe row is removed. The one residual risk is a
probe on a key that exists as a hidden row elsewhere, which would overwrite that row with row 1's text. That is why
step 2 only tries keys whose content matched and step 3 only runs on a single-row store; an unmarked settings root
with rows behind it (a stale copy under a foreign key, or a `modSettings` clobbered with foreign data) goes to step 4
instead of being guessed at.

## Script order

The mod loader did not honour `LoadOrder` in one of three watched launches (a LoadOrder-9500 script ran before a
LoadOrder-1 script of the same mod). The keeper therefore makes no assumption: it patches the engine object in place,
so a mod that captured `localStorage` earlier is still covered from the moment the keeper runs; only a read made at
module load before that moment saw the engine's answer, and such mods read again when their options open.

## Removal

With the keeper gone the game reads row 1 again. In the normal layout that is `modSettings`, the helpers find their
slices, and the only oddity is three internal fields they ignore. In fallback mode row 1 is the `"\u0001"` root: the
helpers would read its slices, write `modSettings`, see two rows and erase the store. Run a repair (clear) or save any
option while the keeper is still installed first.

## Audit, 2026-10-06

Reviewed before the first release. Found and fixed:

- `readRoot()` accepted any plain-object row 1 as the root. A lower-sorting key written raw after start-up by a mod
  that ran before the keeper would have been read as the root and written back under `modSettings`: the very
  contamination the mod exists to stop. The root is now always marked and an unmarked row 1 is refused.
- Fallback mode was permanent. It is now re-examined on every launch (above), a lone unnamed row collapses into a
  normal root (1.0.1), and stale hidden copies are removed so the store is one row.
- `getItem("modSettings")` re-serialised the public part on every call; now cached until the row changes.

Known limits, by design:

- A row the keeper cannot name is never touched and the slices behind it stay out of sight until it can be named.
  Players in that state see defaults for settings they had saved before the keeper (which they could not read
  anyway, since the same row was first). Demographics' Repair storage (`clear()`) deletes those hidden rows, as it did
  before the keeper; `__ls` survives it.
- Script order is not promised by the loader; see Script order. Watched first in every launch as one file.
- The probe can overwrite a hidden row that happens to carry a guessed key; the key list is content-gated and the
  single-row rule applies to unmarked roots, so no probe has hit a hidden row in any run or test.
- Every write rewrites the whole row (the shared root can be several hundred KB with Demographics' history in it);
  mods that write every turn (History and Rankings) now write that much per turn.
- With the keeper removed in fallback mode, the erase-on-second-entry helpers would clear the store on their next
  save; the README says to repair first.

## Verification

Unit tests (`tests/sk-core.test.mjs`, 23 tests) run the keeper against a fake Storage with the engine's exact
behaviour: round trips, `modSettings` pass-through, the helper's erase guard, Tower's shape guards, write refusal,
clear(), the 2026-10-06 store, three foreign rows of two shapes, an unrecognised row (fallback), a marked root beside
a stale copy, restart, idempotent install, cache. `npm run verify` is the gate.

In-game record, 2026-10-06, Civilization VII 1.5.0 (1311346), macOS, `devtools/compat/run-all.sh` plus one extra
launch (`runs/A`, `B`, `C`, `C2`, `D`). Mod set: the player's 22 enabled mods (Tower's Demographics, Emigration,
Cultural Diffusion, Geographic Labels, Canals, Universal Auto Explore, Readable Tooltips, All Display Options; bz
Map Trix, City Hall, Army Trix, Trix Fix, Zoom; Leonardfactory's Policy Yield Previews; Enhanced Town Focus Info;
QD's plot tooltip; Settlement Limit; JNR's age progression and warehouses; Readable Happiness Icons; sib Celebratory
Celebrations) plus Better Ribbon Info, Compact Policy Cards, History & Rankings, Wonders Screen Continued,
Mattifus's Mod Settings Manager and AutoMissionary 1.18. Play Now game, no turns. Watched:

- A: every ModOptions mod logged `LOAD <mod>.<option>=undefined (stored|persistent)` at start: 27 options across
  bz-city-hall, bz-map-trix, sib-celebratory-celebrations (22) and wonders-screen-continued had never persisted.
- B: each of the 27 was written by importing that mod's own `mod-options.js` and calling its `save()`; all read back.
  AutoMissionary's own `AutoMissionarySettings.set`, Compact Policy Cards' `setGlobalSettings`, Canals' `setMode`,
  Cultural Diffusion's `setClaimOnlyUnowned` and Geographic Labels' `setGlobalSettings` were called as well.
- C (new process, store carried from B): the mods' own start-up lines read `LOAD ...=true (stored|persistent)` and
  `LOAD wonders-screen-continued={"skc":true}` for all 27; Canals `one-tile`, Cultural Diffusion `true`, Compact
  Policy Cards' own key and AutoMissionary's key read back; Demographics' 530 KB Hall of Fame slice intact; slices
  grew from 5 to 11, nothing lost; one real row throughout; no `erasing storage` line in any launch; no crash.
- D (the poisoned store from 2026-10-06: AutoMissionary's row before a clobbered `modSettings`): the keeper moved
  AutoMissionary's row, could not name the clobbered root, went to fallback mode without touching it; reads worked;
  Mattifus's manager had already written into the clobbered row before the keeper ran in that launch.
- Script order: with the keeper split over three modules (install + core + keys) it ran AFTER the probe and after
  AutoMissionary in both scopes, so AutoMissionary's module-time read saw the engine's answer. As one import-free
  file (C2) the keeper's line was the first script line in both scopes and AutoMissionary's in-memory settings showed
  the persisted values. The loader appears to run scripts as their module graphs resolve, not by LoadOrder; a single
  file is the lever, and it is still not a guarantee.

Options-screen record, 2026-10-06, `devtools/compat/run-options.sh` (runs `O1`, `O2`, `O3`, pictures in
`runs/proof/index.html`). Every change was made on the REAL Options screen by calling the control's own `toggle()` /
`onItemSelected()` and pressing Confirm, with the same mod set as above. Watched:

- O1, main menu: bz Map Trix "restyle yield banner" on to off, sib "Enable Celebration Fanfare" on to off, Canals rules
  By age to One-tile canals, Cultural Diffusion "claim empty land only" off to on; Confirm; quit without a game.
- O2, new process, main menu: the Options model and the screen show all four as set (`yieldBanner=0 (stored)`,
  `masterEnable=0 (persistent)` in the mods' own start-up lines). Then in a game: Commander lens All Military Units to
  Military and Recon, sib "Show Fireworks" on to off, Cultural Diffusion "borders recede" off to on; Confirm.
- O3, new process: the menu and the in-game Options screen both show all seven values
  (`commanders=3 (stored)`, `showFireworks=0 (persistent)`); one real row throughout.

Behaviour record, 2026-10-06, `devtools/compat/run-func.sh` and `sko-lens.js` (runs `F-control`, `F-persisted`,
`L-control`, `L-persisted`): the same probe on the player's untouched store (defaults) and on the store the Options
run left, each a fresh process. Watched:

| Behaviour | Control (defaults) | Persisted |
|---|---|---|
| bz Map Trix yield banner: `body.bz-yield-banner`, computed style of `yield-bar-entry` | class present; colour rgba(194,196,204), background rgba(246,206,85,.5) | class absent; colour rgba(217,200,173), background transparent |
| bz Map Trix `bzSetUnitLens` with the scout selected (after 14 AI turns) | `fxs-discovery-lens` (hands off) | `bz-commander-lens` (RECON setting) |
| bz options object at runtime | `commanders 2, yieldBanner true` | `commanders 3, yieldBanner false` |
| Cultural Diffusion live `CONFIG` after its `applyTunableOverrides()` | `claimOnlyUnowned false, recedeBorders false` | `true, true` |
| Canals start line and GameConfiguration pin | `rules: by age`, `{"mode":"ages"}` | `rules: one-tile canals`, `{"mode":"one-tile"}` |
| sib Celebratory Celebrations | `masterEnable=undefined`, `showFireworks=undefined` read into its CONFIG | `0`, `0` read into its CONFIG; the effect needs a celebration and was not triggered |

1.0.1 (runs `V2-poison`, `V2-clean`, `O-regress`): the 2026-10-06 store ends in the normal layout, one real row, with
AutoMissionary's values read through the keeper and the clobbered row's slice salvaged; the clean store is unchanged;
the Options screen in the menu and in a game reads back all seven values set in the 1.0.0 run.
