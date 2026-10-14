#!/usr/bin/env python3
"""eo-check.py <W run dir> <R run dir>: did each option changed on the in-game Options screen survive a full restart?"""
import json, os, re, sys
W, R = sys.argv[1:3]
def lines(d): return [l.split("\t", 1)[-1].rstrip() for l in open(os.path.join(d, "probe.log"), errors="replace")]
def val(t): return json.loads(t)
w, r = lines(W), lines(R)
ok_all = True
for l in w:
    m = re.match(r"\[EO\] game CHANGED (\S+) before=(.*?) via (\S+) screen=(.*)$", l)
    if not m: continue
    name, before, how, screen = m.group(1), val(m.group(2)), m.group(3), val(m.group(4))
    after = next((val(x.split("module=", 1)[1]) for x in w if x.startswith("[EO] game AFTER " + name + " ")), "MISSING")
    shell = next((val(x.split("module=", 1)[1]) for x in r if x.startswith("[EO] shell READ " + name + " ")), "MISSING")
    g = next((x for x in r if x.startswith("[EO] game READ " + name + " ")), "")
    gmod = val(re.search(r"module=(.*?) screen=", g).group(1)) if g else "MISSING"
    gscr = val(g.split("screen=", 1)[1]) if g else "MISSING"
    changed = after != before and after != "MISSING"
    # what the screen should show for the value set: the checkbox state, or the dropdown index of that value
    want_screen = {"canals": {"ages": 0, "one-tile": 1}.get(after)}.get(name, after)
    ok = changed and shell == after and gmod == after and gscr == want_screen
    ok_all &= ok
    print(("PASS " if ok else "FAIL ") + f"{name}: in game {json.dumps(before)} -> {json.dumps(after)} ({how}); after restart: menu {json.dumps(shell)}, new game {json.dumps(gmod)}, screen {json.dumps(gscr)}")
for d, ls in ((W, w), (R, r)):
    ks = [json.loads(re.search(r"keeper (\{.*?\})", l).group(1)) for l in ls if re.match(r"\[EO\] (shell|game) keeper \{", l)]
    origins = sorted({k.get("origin") for k in ks}); rows = sorted({k.get("rawRows") for k in ks})
    good = all(k.get("build") == 112 for k in ks) and rows == [1] and bool(ks)
    ok_all &= good
    crash = [f for f in os.listdir(d) if f.endswith(".ips")]
    ok_all &= not crash
    print(("PASS " if good and not crash else "FAIL ") + f"{os.path.basename(d)}: keeper origin {origins}, raw rows {rows}, crash reports {crash}")
print("SUMMARY " + os.path.basename(W)[5:] + ": " + ("ALL PASS" if ok_all else "FAILED"))
