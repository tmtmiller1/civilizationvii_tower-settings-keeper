# Contributing

The Tower Settings Keeper makes the game's `localStorage` keep every mod's settings, and sixteen other Tower mods ship
its main file inside them. A change here reaches players through all of them, so keep it small and careful.

## Ground rules

- `ui/settings-keeper.js` stays one file with no imports. A script with no imports runs as early as the loader runs
  any script, and an import delays it: split into three modules, the keeper ran after other mods (`docs/design.md`,
  Script order).
- Any change to `ui/settings-keeper.js`, a comment included, raises `BUILD`. The newest build on a player's machine
  wins, so two files with the same BUILD and different bytes would win or lose by load order alone.
- Keep the row readable by older builds. A player who removes the mod that brought the newest copy goes back to an
  older one, which still has to find its root and every mod's section. A change to the row's layout raises `VERSION`
  and is spelled out in `embed/README.md`.
- Another mod's data is only ever moved, never guessed at or overwritten. A row the keeper can't identify stays on
  disk. A `KNOWN_KEYS` entry needs a strict check of the row's content, because trying a key the row doesn't belong
  to would overwrite a hidden row of that name.
- The public part of `modSettings` keeps the `{ "<mod id>": { ... } }` shape the options helpers read. The keeper's
  own fields start with `__`.
- `ui/sk-options.js` belongs to the standalone mod. It isn't part of the kit other mods copy.

## Layout

- `ui/settings-keeper.js` is the keeper, in the main menu and in a game. `install()` is exported for the tests.
- `ui/sk-options.js` adds the "Rebuild storage" and "Storage limit reached" rows under Options, Add-ons, shown only
  when they're needed.
- `tower-settings-keeper.modinfo` loads both files in the shell and game scopes, the keeper first.
- `text/` holds the mod's text, English in `en_us/` and eleven languages beside it. `docs/readme/` holds the README in
  the same languages.
- `embed/README.md` is the kit's instructions for other modders. It ships in the mod folder and in the kit zip.
- `docs/design.md` is the design and the test record. `docs/steam-workshop-description.txt` is the local Workshop
  draft, and `docs/images/` and `steam/` hold the pictures.
- `tests/`, `eslint.config.js` and `package.json` are the dev gate: `npm run verify` runs lint, a syntax check and
  the unit tests, which drive the keeper against a fake store with the engine's bug in it
  (`tests/fake-engine-storage.mjs`).
- `scripts/steam-changelog.mjs` keeps `CHANGELOG.steam.txt` in step with `CHANGELOG.md`. `scripts/carriers.mjs`
  lists the copies in the other Tower mods and updates them (`npm run carriers`).
- `release.sh` runs the gate and builds the mod zip, the `settings-keeper-embed` kit zip and the Workshop manifest.
- `devtools/` holds the in-game runs and their checkers; `devtools/README.md` says what each one is for.

## Sending out a new BUILD

1. Change `ui/settings-keeper.js` here and nowhere else. Raise `BUILD`, and `VERSION` if the row's layout changed.
   Update the build number in `embed/README.md` (its sample `ready` line and the Layout heading).
2. Add a unit test for the change, and one for the handoff from the build players have now if `install()` changed.
   `npm run verify` has to pass.
3. `npm run carriers -- --write` shows which copies would be replaced. `node scripts/carriers.mjs --write --yes`
   copies the file into each carrier's working tree. It stops if a carrier has uncommitted changes to its copy, a
   copy with the same BUILD and different bytes, or a newer BUILD; sort those out first. `npm run carriers` should
   then list every copy as the same.
4. Watch it in the game before anything ships: `devtools/compat/run-embed.sh init`, `run-embed-matrix.sh`, then
   `run-embed.sh restore`. The matrix copies each carrier from its repo and checks every copy matches this file.
   Read `runs/EMB/verdicts.txt`, and write the result into `docs/design.md`, Verification.
5. Release this repo first, so the kit on GitHub carries the build other modders copy.
6. In each carrier: run its own gate, add a changelog line that names the new build and what it changes for players,
   commit, and release it the usual way. The order doesn't matter to players, since the newest copy on a machine wins
   whichever mod brought it, but every carrier should get it in its next release.
7. When they're all out, `npm run carriers -- --dist` shows each mod's last built zip carrying the new build.

A carrier that isn't released (Mod Commons, for now) gets the copy in its working tree and ships it whenever it's
released.
