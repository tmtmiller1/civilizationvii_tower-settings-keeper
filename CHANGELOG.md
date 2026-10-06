# Changelog

## 1.0.0 (2026-10-06)

- First release. Every `localStorage` key kept inside the one row the game reads correctly; `modSettings` passed
  through for the options helpers; the store reports one entry; entries another mod pushed ahead of the root are
  moved into place when they can be named and left untouched when they cannot.
- The root always carries the keeper's mark and is never built on a row without it, so a row another mod writes
  raw can never be copied over the shared settings.
- A store the keeper could not sort out is re-examined on every launch and brought back to the normal layout once
  the row in the way can be named.
