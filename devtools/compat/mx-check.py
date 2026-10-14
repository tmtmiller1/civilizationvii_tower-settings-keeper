#!/usr/bin/env python3
"""mx-check.py <run dir>...: the transition matrix. Every READ must equal the latest SET of that setting (carried across
launches), except Canals' rule after a save is loaded, which by design comes from the save (its main-menu default must
still be the latest SET)."""
import json, os, re, sys
latest, save_canals, rows, ok_all = {}, None, [], True
for d in sys.argv[1:]:
    for raw in open(os.path.join(d, "probe.log"), errors="replace"):
        l = raw.split("\t", 1)[-1].rstrip()
        m = re.match(r"\[MX\] (shell|game) (SET|READ) (.+?) ([a-z-]+)=(.*)$", l)
        if l.endswith("ACTION quick save"): save_canals = latest.get("canals")
        if not m: continue
        scope, kind, tag, name, v = m.groups(); v = json.loads(v)
        if kind == "SET": latest[name] = v; continue
        loaded = "load save" in tag
        if name == "canals" and loaded:
            exp, note = save_canals, "the save's own rule (by design)"
        else:
            exp, note = latest.get(name), ""
        good = v == exp
        ok_all &= good
        rows.append((os.path.basename(d), tag, name, v, exp, good, note))
by = {}
for launch, tag, name, v, exp, good, note in rows: by.setdefault((launch, tag), []).append((name, v, exp, good, note))
for (launch, tag), items in by.items():
    bad = [i for i in items if not i[3]]
    notes = [f"{n}={json.dumps(v)} ({note})" for n, v, e, g, note in items if note]
    print(("PASS " if not bad else "FAIL ") + f"{launch} | {tag}: {len(items) - len(bad)}/{len(items)} as expected"
          + ("" if not bad else " | WRONG " + "; ".join(f"{n}={json.dumps(v)} expected {json.dumps(e)}" for n, v, e, g, _ in bad))
          + ("" if not notes else " | " + "; ".join(notes)))
print("SUMMARY matrix: " + ("ALL PASS" if ok_all else "FAILED"))
