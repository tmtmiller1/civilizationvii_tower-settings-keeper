# Changelog

## [1.1.3] - 2026-10-07

- Clearer wording in the in-game text, the Options row and the documentation. No change in behaviour.

## [1.1.2] - 2026-10-07

- The mod folder now includes the modder kit (`embed/README.md` next to `ui/settings-keeper.js`), so a Workshop
  subscription is all another mod author needs. Steam Workshop manifest and description added. No change in game.

## [1.1.1] - 2026-10-07

- Modder kit: `embed/README.md` and the release asset `settings-keeper-embed-<version>.zip` (the file plus
  instructions) for shipping the fix inside another mod.
- The log line names the mod whose copy is running. When a newer copy replaces an older one, the log says which.

## [1.1.0] - 2026-10-07

- A "Rebuild storage" row in Options, Add-ons. It appears only while the mod is in its fallback layout, which happens
  when two or more stored entries it cannot identify sit ahead of the shared settings. A confirmation says how many
  entries will be deleted. Rebuilding deletes them and writes everything the mod holds back as one row.
- Several mods may ship the file. The newest build on the machine is the one that runs.

## [1.0.3] - 2026-10-06

- Writes made in the same moment are combined into one engine write. Reads in between see the new values at once.
  A mod that saves many pieces in a row no longer stalls the game for the sum of them. With a 530 KB store, sixty
  consecutive writes went from 0.6 s to one write of about 8 ms.

## [1.0.2] - 2026-10-06

- `key(i)` returns null, as the game does. A mod that lists keys in order to remove them has always done nothing,
  and still does.

## [1.0.1] - 2026-10-06

- When the only remaining entry cannot be identified, the store is rebuilt around it and its contents are kept,
  instead of being left in the fallback layout. The store is then one row, and removing the mod later is safe.
- A kept copy of an unidentified entry moves under its name once a later version recognises it.
- Old raw copies hidden behind the root, for keys the mod already holds, are removed.

## [1.0.0] - 2026-10-06

- First release. Every `localStorage` key is kept inside the one row the game reads correctly. `modSettings` is
  passed through for the options helpers. The store reports one entry. Entries another mod pushed ahead of the root
  are moved into place when they can be identified and left alone when they cannot.
- The root always carries the mod's mark and is never built on a row without it. A row another mod writes raw can
  never be copied over the shared settings.
- A store the mod could not sort out is checked again on every launch and brought back to the normal layout once
  the row in the way can be identified.
