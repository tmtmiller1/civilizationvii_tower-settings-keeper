#!/usr/bin/env python3
"""emb-check.py <run dir> [<previous run dir>] : verdicts for one run-embed.sh launch.

Checks, each printed as PASS or FAIL:
  enabled     the game's Target Mods list holds exactly the expected tower mods (from mods-dir.txt) and the probe
  copies      every installed settings-keeper.js matches the keeper repo byte for byte
  ready       one keeper "ready" line per scope from a copy of this repo's BUILD; which copies logged it
  keeper      in both scopes the probe sees that BUILD, one raw row, length shadowed
  fold        a poisoned AutoMissionary row was moved under __ls (the store ends with one row)
  restart     own keys, the shared slice and each mod's own setting read back what the previous run wrote
  in-launch   writes read back at once; the game scope reads the settings the shell scope wrote
  store       the post-run store is one modSettings row that holds this run's tokens and kept the player's data
  errors      UI.log errors that name a carrier's files
The expected BUILD is read from ui/settings-keeper.js; SK_BUILD=<n> overrides it, to recheck runs from before a bump.
"""
import json, os, re, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.environ.get("SK_BUILD") or re.search(r"export const BUILD = (\d+)", open(
    os.path.join(HERE, "..", "..", "ui", "settings-keeper.js")).read()).group(1)

def jl(t):
    t = t.strip()
    return "undefined" if t == "undefined" else json.loads(t)

run = sys.argv[1]; prev = sys.argv[2] if len(sys.argv) > 2 else None
label = os.path.basename(run.rstrip("/"))
results = []
def verdict(name, ok, detail=""):
    results.append((name, ok, detail)); print(("PASS " if ok else "FAIL ") + name + (": " + detail if detail else ""))

ID = {"all-display-options": "all-display-options", "build_wonders_over_antiquated_buildings": "tower-build-wonders-over-antiquated-buildings",
      "canals": "tower-canals", "cultural_diffusion": "cultural-diffusion", "dams": "tower-dams", "emigration": "emigration",
      "geographic_labels": "tmt-geographic-labels", "national_parks": "tower-national-park", "readable-tooltips": "readable-tooltips",
      "universal_auto-explore": "universal-auto-explore", "demographics": "demographics",
      "numpad-unit-movement": "tmt-numpad-unit-movement", "zoom-tilt-rotate": "tmt-zoom-tilt-rotate",
      "strategic_resources_that_matter": "tower-strategic-resources-that-matter", "partisans": "tower-partisans",
      "tower_settings_keeper": "tower-settings-keeper"}
carriers = [l.strip()[4:] for l in open(os.path.join(run, "mods-dir.txt")) if l.startswith("emb-") and l.strip() != "emb-probe"]
expected = sorted(ID[c] for c in carriers) + ["emb-probe"]

# enabled: the Target Mods list, minus anything Firaxis ships (bundle ids are read from the run's own list of mods
# with a path under steamapps/common is not available here, so compare against the known tower and probe ids)
lines = open(os.path.join(run, "Modding.log"), errors="replace").read().split("\n")
targets = []; grab = False
for l in lines:
    t = l.split("\t", 1)[-1]
    if t.startswith("Target Mods"): grab = True; cur = []; continue
    if grab:
        m = re.match(r"^(\S+) \(", t)
        if m: cur.append(m.group(1)); continue
        grab = False; targets.append(cur)
watch = set(ID.values()) | {"emb-probe", "tmt-geographic-labels-dev", "AutoMissionary"}
seen = sorted({x for c in targets for x in c if x in watch})
third = sorted({x for c in targets for x in c if x not in watch})
verdict("enabled", seen == sorted(expected), "tower+probe " + json.dumps(seen) + ("" if seen == sorted(expected) else " expected " + json.dumps(sorted(expected))))
open(os.path.join(run, "enabled.txt"), "w").write("\n".join(sorted({x for c in targets for x in c})) + "\n")

copies = open(os.path.join(run, "copies.txt")).read().split("\n") if os.path.exists(os.path.join(run, "copies.txt")) else []
copies = [c for c in copies if c]
verdict("copies", all(c.endswith("identical") for c in copies), ", ".join(copies) or "no carriers")

probe = [l.split("\t", 1)[-1].rstrip() for l in open(os.path.join(run, "probe.log"), errors="replace")]
split = next((i for i, l in enumerate(probe) if "startGame called" in l), len(probe))
def readies(part): return [re.search(r"ready \(build (\d+) from ([^)]+)\)", l).groups() for l in part if "[settings-keeper] ready" in l]
r_shell, r_game = readies(probe[:split]), readies(probe[split:])
other_ks = [l for l in probe if "[settings-keeper]" in l and "ready" not in l]
want_keeper = bool(carriers)
if want_keeper:
    ok = len(r_shell) >= 1 and len(r_game) >= 1 and all(b == BUILD for b, _ in r_shell + r_game)
    verdict("ready", ok, "shell " + json.dumps(r_shell) + " game " + json.dumps(r_game) + (" | other keeper lines: " + json.dumps(other_ks) if other_ks else ""))
else:
    verdict("ready", not r_shell and not r_game, "no carrier, no keeper expected; saw " + json.dumps(r_shell + r_game))

def find(prefix, part=None):
    for l in (part if part is not None else probe):
        if l.startswith(prefix): return l
    return None
def jfield(line, key):
    m = re.search(re.escape(key) + r"=(\"(?:[^\"\\]|\\.)*\"|null|true|false|-?\d+(?:\.\d+)?|\{.*?\}(?= |$))", line or "")
    return json.loads(m.group(1)) if m else "MISSING"

_pre_keys = [k for (k,) in sqlite3.connect(os.path.join(run, "LocalStorage.pre.sqlite")).execute('select key from "Values"')]
FALLBACK = "!emb-unknown" in _pre_keys or "\u0001" in _pre_keys
for scope in ("shell", "game"):
    k = find("[EMB] " + scope + " keeper {")
    st = json.loads(re.search(r"keeper (\{.*?\}) length", k).group(1)) if k else {}
    if want_keeper and FALLBACK:
        ok = st.get("build") == int(BUILD) and st.get("root") == "\u0001" and st.get("blocked") is True and st.get("lengthShadowed") is True
        verdict("keeper " + scope + " (fallback mode expected)", ok, json.dumps({x: st.get(x) for x in ("build", "origin", "root", "rows", "rawRows", "blocked")}))
    elif want_keeper:
        ok = st.get("build") == int(BUILD) and st.get("rawRows") == 1 and st.get("lengthShadowed") is True and st.get("rows") == 1
        verdict("keeper " + scope, ok, json.dumps({x: st.get(x) for x in ("build", "origin", "rows", "rawRows", "lengthShadowed", "folded", "blocked")}))
    else:
        verdict("keeper " + scope, st.get("keeper", "x") is None, "none expected")

pre = sqlite3.connect(os.path.join(run, "LocalStorage.pre.sqlite")).execute('select key, value from "Values"').fetchall()
post = sqlite3.connect(os.path.join(run, "LocalStorage.post.sqlite")).execute('select key, value from "Values"').fetchall()
pre_d = dict(pre); post_d = dict(post)
if want_keeper and FALLBACK:
    root = json.loads(post_d.get("\u0001", "{}")); ls = root.get("__ls", {})
    untouched = all(post_d.get(k) == v for k, v in pre_d.items() if k != "\u0001")
    ok = untouched and ls.get("emb-own-shell") == label and ls.get("emb-own-game") == label and \
        root.get("emb-probe", {}).get("shell") == label and root.get("emb-probe", {}).get("game") == label
    verdict("store (fallback)", ok, "rows " + json.dumps({k: len(v) for k, v in post_d.items()}) + ", rows behind the root unchanged: " + str(untouched))
elif want_keeper:
    root = json.loads(post_d.get("modSettings", "{}"))
    ls = root.get("__ls", {})
    if "AutoMissionary.settings.v2" in pre_d:
        verdict("fold", list(post_d) == ["modSettings"] and "AutoMissionary.settings.v2" in ls, "post rows " + json.dumps(list(post_d)) + ", __ls keys " + json.dumps(sorted(ls)))
    pre_root = json.loads(pre_d.get("modSettings", "{}"))
    lost = [s for s in pre_root if s not in root]
    ok = list(post_d) == ["modSettings"] and ls.get("emb-own-shell") == label and ls.get("emb-own-game") == label and \
        root.get("emb-probe", {}).get("shell") == label and root.get("emb-probe", {}).get("game") == label and not lost
    verdict("store", ok, "rows " + json.dumps({k: len(v) for k, v in post_d.items()}) + ", slices kept " + str(len([s for s in pre_root if s in root])) + "/" + str(len(pre_root)) + (", LOST " + json.dumps(lost) if lost else ""))
else:
    verdict("store", True, "control: rows " + json.dumps({k: len(v) for k, v in post_d.items()}))

# in-launch
shell_w = {re.match(r"\[EMB\] shell WROTE mod (\S+?)=", l).group(1): l for l in probe if l.startswith("[EMB] shell WROTE mod ")}
bad = []
for name, l in shell_w.items():
    w = jl(re.search(r"=(.*?) readback=", l).group(1)); rb = jl(re.search(r"readback=(.*)$", l).group(1))
    if w != rb: bad.append(name + " shell readback " + json.dumps(rb) + " != " + json.dumps(w))
    g = find("[EMB] game READ mod " + name + "=")
    if g is None: bad.append(name + " not read in game")
    elif jl(g.split("=", 1)[1]) != w: bad.append(name + " game read " + g.split("=", 1)[1] + " != shell write " + json.dumps(w))
for scope in ("shell", "game"):
    l = find("[EMB] " + scope + " WROTE own-")
    if l and jfield(l, "readback") != label: bad.append(scope + " own-key readback " + json.dumps(jfield(l, "readback")))
gr = find("[EMB] game READ own-shell")
if gr and jfield(gr, "own-shell") != label: bad.append("game read own-shell " + json.dumps(jfield(gr, "own-shell")))
if want_keeper: verdict("in-launch", not bad, "; ".join(bad) or (str(len(shell_w)) + " mod settings + own keys + slice"))
else: verdict("in-launch (control: expected to fail)", True, "; ".join(bad)[:400])

# restart
if prev:
    pprobe = [l.split("\t", 1)[-1].rstrip() for l in open(os.path.join(prev, "probe.log"), errors="replace")]
    plabel = os.path.basename(prev.rstrip("/"))
    bad = []; checked = 0
    r = find("[EMB] shell READ own-shell")
    for key in ("own-shell", "own-game"):
        checked += 1
        if jfield(r, key) != plabel: bad.append(key + "=" + json.dumps(jfield(r, key)))
    sl = jfield(r, "slice"); checked += 1
    if not isinstance(sl, dict) or sl.get("shell") != plabel or sl.get("game") != plabel: bad.append("slice=" + json.dumps(sl))
    for l in pprobe:
        m = re.match(r"\[EMB\] shell WROTE mod (\S+?)=(.*?) readback=", l)
        if not m: continue
        cur = find("[EMB] shell READ mod " + m.group(1) + "=")
        if cur is None: continue  # that mod is not loaded in this run
        checked += 1
        if jl(cur.split("=", 1)[1]) != jl(m.group(2)): bad.append(m.group(1) + " read " + cur.split("=", 1)[1] + " != " + m.group(2))
    verdict("restart (from " + plabel + ")", not bad, "; ".join(bad) or (str(checked) + " values read back"))

errs = [l for l in open(os.path.join(run, "other-errors.txt"), errors="replace")]
mine = [l.strip() for l in errs if any(("/" + ID[c] + "/") in l or ("emb-" + c) in l for c in carriers)]
verdict("errors", not mine, (str(len(mine)) + " naming carriers: " + json.dumps(mine[:4])) if mine else str(len(errs)) + " other lines, none naming a carrier")
if third: print("INFO third-party enabled: " + str(len(third)) + " (Firaxis content included)")
crash = [f for f in os.listdir(run) if f.endswith(".ips")]
verdict("no crash", not crash, json.dumps(crash))
print("SUMMARY " + label + ": " + ("ALL PASS" if all(ok for _, ok, _ in results) else "FAILED: " + ", ".join(n for n, ok, _ in results if not ok)))
