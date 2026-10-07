# Changelog

## 1.1.0 (2026-10-07)

- A "Rebuild storage" row in Options, Add-ons, shown only while the keeper is in its fallback layout (two or more
  stored entries it could not tell apart ahead of the shared settings). A confirm dialog says how many entries go;
  rebuilding drops them and writes everything the keeper holds back as the one normal row. Nothing shows otherwise.
- Several mods may ship this file; the newest build on the machine is the one that runs.

## 1.0.3 (2026-10-06)

- Writes made in the same moment are combined into one engine write (reads in between see them at once), so a mod
  that saves many pieces in a row no longer stalls the game for the sum of them. Measured with a 530 KB store: sixty
  consecutive writes went from 0.6 s to one write of about 8 ms.

## 1.0.2 (2026-10-06)

- `key(i)` answers null, exactly as the game does, so a mod that lists keys to remove them changes nothing, as before.

## 1.0.1 (2026-10-06)

- A store whose only remaining entry cannot be named is rebuilt around that entry (its text and slices kept) instead
  of being left in the fallback layout, so the store is one row and removing the keeper later is safe.
- A kept copy of an unnamed entry moves under its name once a later key list recognises it.
- Stale raw copies hiding behind the root for keys the keeper already holds are removed.

## 1.0.0 (2026-10-06)

- First release. Every `localStorage` key kept inside the one row the game reads correctly; `modSettings` passed
  through for the options helpers; the store reports one entry; entries another mod pushed ahead of the root are
  moved into place when they can be named and left untouched when they cannot.
- The root always carries the keeper's mark and is never built on a row without it, so a row another mod writes
  raw can never be copied over the shared settings.
- A store the keeper could not sort out is re-examined on every launch and brought back to the normal layout once
  the row in the way can be named.
