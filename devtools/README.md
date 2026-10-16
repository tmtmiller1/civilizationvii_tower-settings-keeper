# devtools

In-game test runs for the keeper and for the mods that carry it. None of it ships in the Workshop download. Every
runner starts Civilization VII through Steam, so only one runs at a time, and never while another session has the game.
Each one backs up what it touches (the mod registry, the store, the game options, the Hall of Fame, the autosaves)
and puts it back afterwards. Output lands in `compat/runs/<label>/`, which is gitignored. What the runs showed is
written up in `docs/design.md`, under Verification and Load and limits.

## The 2026-10-06 runs: the standalone keeper with the player's mods

- `run-compat.sh <label> <phase> [store]` is one launch with the player's mods, the standalone keeper and a probe mod
  (`skc-probe.modinfo`, `skc-shell.js`, `skc-game.js`). Phase A reports the keeper's state so the other mods' `LOAD`
  lines can be collected, B writes each option through that mod's own code, and C reads them back after a restart.
  The third argument starts the launch from a saved store. `NO_KEEPER=1` leaves the standalone out, and
  `PROBE_SHELL` and `PROBE_GAME` swap in another probe.
- `run-all.sh` runs A, B and C in a row, then D, which starts from the broken store of 2026-10-06.
- `run-options.sh` makes three launches through the real Options screen, with screenshots. It pastes `sko-common.js`
  into `sko-shell.js` and `sko-game.js` as `_built-*.js` (gitignored).
- `run-func.sh` checks behaviour that depends on saved options, defaults against saved values (`sko-func.js`;
  `sko-lens.js` for Map Trix's commander lens).
- The other `sko-*.js` probes run through `run-compat.sh` with `PROBE_SHELL` or `PROBE_GAME`: `sko-perf.js` (what a
  write costs), `sko-burst.js` (many small keys), the `sko-volume*.js` set (the row grown until the game stops, and a
  launch on the big row), `sko-limit.js` (the 4 MB guard on the Options screen), and `sko-rebuild.js` and
  `sko-rebuild-game.js` (the Rebuild storage row in the menu and in a game).
- `winid.swift` prints the game window's id for `screencapture -l`. Build it once to `winid-bin` (gitignored).

## The 2026-10-07 runs: the copies embedded in every carrier

- `run-embed.sh init`, `run <label>` and `restore`. `init` backs up once for a whole matrix and moves the subscribed
  Workshop keeper aside. Each `run` is one launch with the chosen carriers copied from their repos into
  `Mods/emb-<folder>`, set through `CARRIERS`, `WITH_K`, `STORE`, `POISON`, `START_AGE` and `USER_MODS` (see the
  script's header). `PROBE_PREFIX` picks the probe. `restore` puts everything back.
- `run-embed-matrix.sh` is the whole matrix: S1 to S3 for each carrier, then T1 to T7 with all of them. Verdicts go
  to `runs/EMB/verdicts.txt`. `run-embed-followup.sh` holds the 10-07 follow-ups (S1b to S3b, T5b to T5d).
- The probes: `emb-probe.modinfo` with `emb-common.js` and its two tails writes and reads an own key, a `modSettings`
  section and one real setting per Tower mod. `eo-common.js` and its tails (`PROBE_PREFIX=eo`, `PHASE=W` or `R`)
  change rows on the in-game Options screen. `mx-common.js` and its tails (`PROBE_PREFIX=mx`, `PHASE=L1` to `L3`)
  run the transition chains; set `DONE_RE` to their `DONE-CHAIN` line.
- The checkers only read a run folder: `emb-check.py <run> [<previous run>]`, `eo-check.py <W run> <R run>` and
  `mx-check.py <run>...`. They expect the BUILD in `ui/settings-keeper.js`; `SK_BUILD=<n>` checks older runs.
- `ready-order.py <run folder or UI.log>...` shows where the keeper's `ready` line lands in each page load and lists
  any other mod's line that came ahead of it.

`emb-check.py` and `run-embed.sh` know each carrier by its folder and mod id. A new carrier goes into `TOWER_IDS` in
`run-embed.sh`, `ALL` in the two matrix scripts and `ID` in `emb-check.py`.
