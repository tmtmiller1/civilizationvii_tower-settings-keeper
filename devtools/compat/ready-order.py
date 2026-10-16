#!/usr/bin/env python3
"""ready-order.py <UI.log or run dir>...: where the keeper's first "ready" line lands in each page load.

Read-only. A log is split wherever the game unloads a page (its "unloaded its document" font lines), so the main menu
and every game load count once each. For each load with a keeper line it prints the line it came on, which mod's
copy installed (from "ready (build N from <folder>)"), and any line ahead of it that isn't the game's own. The
summary counts the loads where the keeper's line came before every other mod's.

A log only shows scripts that write a line when they load. A mod that reads the store silently can't be placed.
"""
import os, re, sys

BOUNDARY = re.compile(r"unloaded its document")
READY = re.compile(r"\[settings-keeper\] ready(?: \(build (\d+) from ([^)]+)\))?[:(]")
# lines the game itself writes while a page loads; anything else ahead of the keeper is another mod's
GAME = re.compile(r"^(Unable to parse|VM: Unable to find harness|The font .* hasn't been loaded|HTML Parser Error|"
                  r"Failed to open file|ResourceRequestJob|No handler specified|\w+ is not supported for border-style|"
                  r"Unsupported CSS|lens-manager|model-|Attempt to switch|Attempting to read using a null|"
                  r"CSS parsing error|Custom CSS expressions|\[settings-keeper\])")


def loads(path):
    """The log's lines, without the engine's 'While executing JS' continuations, split into page loads."""
    out, cur, in_boundary = [], [], False
    for raw in open(path, errors="replace"):
        if raw.startswith(" While executing JS") or not raw.strip():
            continue
        line = raw.split("\t", 1)[-1].rstrip()
        if BOUNDARY.search(line):
            in_boundary = True
            continue
        if in_boundary:
            out.append(cur)
            cur, in_boundary = [], False
        cur.append(line)
    out.append(cur)
    return out


def main(args):
    total = first = 0
    exceptions = []
    for arg in args:
        path = os.path.join(arg, "full-UI.log") if os.path.isdir(arg) else arg
        name = os.path.basename(os.path.normpath(arg)) if os.path.isdir(arg) else path
        if not os.path.isfile(path):
            print(name + ": no UI.log")
            continue
        cells = []
        for seg in loads(path):
            at = next((i for i, l in enumerate(seg) if READY.search(l)), None)
            if at is None:
                continue
            m = READY.search(seg[at])
            others = [l for l in seg[:at] if not GAME.search(l)]
            total += 1
            first += not others
            cells.append("load %d: line %d, %s" % (len(cells) + 1, at + 1, m.group(2) or "?"))
            for o in others:
                exceptions.append("%s load %d: %s" % (name, len(cells), o[:160]))
        print(name + ": " + ("; ".join(cells) if cells else "no keeper line"))
    print("\n%d loads with a keeper line; in %d of them it came before every other mod's line" % (total, first))
    for e in exceptions:
        print("  ahead of the keeper: " + e)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
