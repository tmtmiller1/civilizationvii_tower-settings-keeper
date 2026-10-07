#!/bin/zsh
# run-all.sh - the four-launch compatibility run. A harvests, B writes, C reads back after a restart with the store
# carried from B, D starts on the poisoned store from 2026-10-06. The player's store is put back after every launch.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; R="$HERE/runs"
POISONED="$HOME/Library/Application Support/Civilization VII/cd-harness-backup/localstorage-recovery-2026-10-06/live-copy.sqlite"
zsh "$HERE/run-compat.sh" A A
python3 - "$R/A/full-UI.log" "$R/pairs.json" <<'EOF'
import re, sys, json
log, out = sys.argv[1], sys.argv[2]
seen = {}
for line in open(log, errors="replace"):
    m = re.search(r"LOAD ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)=(.*?) \((stored|persistent)\)", line)
    if m:
        seen[(m.group(1), m.group(2))] = m.group(3); continue
    m = re.search(r"LOAD ([A-Za-z0-9_-]+)=(\{.*\}|null|undefined)\s*$", line.rstrip())
    if m:
        seen[(m.group(1), None)] = m.group(2)
pairs = [{"mod": k[0], "opt": k[1], "cur": v} for k, v in sorted(seen.items(), key=lambda kv: (kv[0][0], kv[0][1] or ""))]
json.dump(pairs, open(out, "w"))
print("harvested", len(pairs), "option reads from", len({p["mod"] for p in pairs}), "mods:", sorted({p["mod"] for p in pairs}))
EOF
sleep 20
PAIRS_JSON="$R/pairs.json" zsh "$HERE/run-compat.sh" B B "$R/A/LocalStorage.sqlite.post"
sleep 20
PAIRS_JSON="$R/pairs.json" zsh "$HERE/run-compat.sh" C C "$R/B/LocalStorage.sqlite.post"
sleep 20
zsh "$HERE/run-compat.sh" D D "$POISONED"
echo "=== A: what the mods loaded at start"; sort -u "$R/A/mod-load-lines.log" | sed -E 's/^\[[^]]*\]\s*//' | grep -E "^LOAD" | sort | head -80
echo "=== C: what the mods loaded at start (after B wrote)"; sort -u "$R/C/mod-load-lines.log" | sed -E 's/^\[[^]]*\]\s*//' | grep -E "^LOAD" | sort | head -80
for p in A B C D; do echo "=== probe lines $p"; cut -c1-1200 "$R/$p/probe-UI.log"; echo "=== other errors $p"; head -20 "$R/$p/other-errors.txt"; done
echo "ALL_FINISHED"
