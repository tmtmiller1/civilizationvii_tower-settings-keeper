#!/bin/zsh
# run-compat.sh <label> <phase> [seed LocalStorage.sqlite]
#   PAIRS_JSON=<file>   the harvested [{mod,opt,cur}] list for phases B and C (default [])
#   PROBE_SHELL=<js> PROBE_GAME=<js>   probe scripts to install (default skc-shell.js / skc-game.js); __PHASE__ and
#                                      __PAIRS__ are substituted in both. A "[SKC] SHOT <name>" line captures the game
#                                      window (by window id, never the display) to <run>/shot-<name>.png.
# One launch of Civ VII with the player's enabled mods PLUS the disabled local settings mods, AutoMissionary (corpus
# copy), the Tower Settings Keeper (dev copy) and the probe. Play Now game, no turns. Backs up and restores the registry,
# LocalStorage, autosaves, Hall of Fame and AppOptions. Run folder: devtools/compat/runs/<label>/.
set -u
LABEL="$1"; PHASE="$2"; SEED="${3:-}"
S="$HOME/Library/Application Support/Civilization VII"; DB="$S/Mods.sqlite"; MODS="$S/Mods"; LOG="$S/Logs/UI.log"
HERE="$(cd "$(dirname "$0")" && pwd)"; MOD="$(cd "$HERE/../.." && pwd)"; OUT="$HERE/runs/$LABEL"; mkdir -p "$OUT"
AM_SRC="${AM_SRC:-}"   # path to an AutoMissionary mod folder to install for the run; empty = skip
EXTRA_LOCAL=("better-ribbon-info" "tmt-compact-policy-cards" "history-and-rankings" "wonders-screen-continued" "civ-vii-mod-settings-manager")
TIMEOUT=${TIMEOUT:-600}
say() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT/runner.log"; }
if pgrep -x CivilizationVII >/dev/null; then say "game already running; refusing"; exit 1; fi

cp "$DB" "$OUT/Mods.sqlite.pre"; cp "$S/LocalStorage.sqlite" "$OUT/LocalStorage.sqlite.pre"; cp "$S/AppOptions.txt" "$OUT/AppOptions.txt.pre"
[ -f "$S/HallofFame.sqlite" ] && cp "$S/HallofFame.sqlite" "$OUT/HallofFame.sqlite.pre"
rm -rf "$OUT/auto.pre"; cp -R "$S/Saves/Single/auto" "$OUT/auto.pre"
ips_before=$(ls ~/Library/Logs/DiagnosticReports/CivilizationVII-*.ips 2>/dev/null | sort)
if [ -n "$SEED" ]; then cp "$SEED" "$S/LocalStorage.sqlite"; say "seeded store from $SEED"; fi
say "store rows: $(sqlite3 "$S/LocalStorage.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"

# enable the local settings mods for the run (their rows are restored from the backup afterwards)
for id in "${EXTRA_LOCAL[@]}"; do sqlite3 "$DB" "update Mods set Disabled=0 where ModId='$id' and ScannedFileRowId in (select ScannedFileRowId from ScannedFiles where Path like '%/Civilization VII/Mods/%')"; done
say "enabled for the run: ${EXTRA_LOCAL[*]}"

# install: keeper (dev copy, ui + text + modinfo only), AutoMissionary, probe
rm -rf "$MODS/tower-settings-keeper" "$MODS/AutoMissionary" "$MODS/skc-probe"
mkdir -p "$MODS/tower-settings-keeper"; cp -R "$MOD/ui" "$MOD/text" "$MOD/tower-settings-keeper.modinfo" "$MODS/tower-settings-keeper/"
if [ -n "$AM_SRC" ] && [ -d "$AM_SRC" ]; then cp -R "$AM_SRC" "$MODS/AutoMissionary"; rm -rf "$MODS/AutoMissionary/workshop"; fi
mkdir -p "$MODS/skc-probe/ui"; cp "$HERE/skc-probe.modinfo" "$MODS/skc-probe/"
PAIRS="$(cat "${PAIRS_JSON:-/dev/null}" 2>/dev/null)"; [ -z "$PAIRS" ] && PAIRS="[]"
python3 - "$HERE/${PROBE_SHELL:-skc-shell.js}" "$MODS/skc-probe/ui/skc-shell.js" "$HERE/${PROBE_GAME:-skc-game.js}" "$MODS/skc-probe/ui/skc-game.js" "$PHASE" "$PAIRS" <<'EOF'
import sys
a, b, c, d, phase, pairs = sys.argv[1:7]
for src, dst in ((a, b), (c, d)):
    s = open(src).read().replace("__PHASE__", phase).replace("__PAIRS__", pairs)
    open(dst, "w").write(s)
EOF
cp -R "$MODS/skc-probe" "$OUT/probe-as-installed"; say "installed keeper, AutoMissionary, probe (phase $PHASE, $(printf '%s' "$PAIRS" | grep -o '"mod"' | wc -l | tr -d ' ') pairs)"

: > "$LOG" 2>/dev/null
open steam://rungameid/1295660
n=0; until pgrep -x CivilizationVII >/dev/null; do sleep 2; n=$((n+1)); if [ $n -gt 90 ]; then say "GAME DID NOT START"; break; fi; done
say "game pid $(pgrep -x CivilizationVII | head -1)"
t=0; result=timeout; typeset -A shot
while [ $t -lt $TIMEOUT ]; do
  sleep 4; t=$((t+4))
  for name in $(grep -o "\[SKC\] SHOT [A-Za-z0-9_-]*" "$LOG" 2>/dev/null | awk '{print $3}'); do
    if [ -z "${shot[$name]:-}" ]; then
      shot[$name]=1
      if [ -x "$HERE/winid-bin" ]; then winid=$("$HERE/winid-bin" 2>/dev/null | awk '$3 > 600' | sort -k3 -n -r | head -1 | awk '{print $1}'); else winid=$(swift "$HERE/winid.swift" 2>/dev/null | awk '$3 > 600' | sort -k3 -n -r | head -1 | awk '{print $1}'); fi
      if [ -n "$winid" ]; then screencapture -x -o -l "$winid" "$OUT/shot-$name.png"; say "shot $name (window $winid)"; else say "shot $name skipped: no game window"; fi
    fi
  done
  if grep -q "\[SKC\] DONE" "$LOG" 2>/dev/null; then result=done; sleep 6; break; fi
  if grep -q "\[SKC\] LOAD gave up" "$LOG" 2>/dev/null; then result=loadfail; break; fi
  if ! pgrep -x CivilizationVII >/dev/null; then result=crashed; sleep 50; break; fi
done
say "result=$result after ${t}s"
cp "$LOG" "$OUT/full-UI.log" 2>/dev/null
grep -E "\[SKC\]|\[settings-keeper\]" "$LOG" | cut -c1-3000 > "$OUT/probe-UI.log"
grep -E "LOAD [A-Za-z0-9_.-]+=|SAVE [A-Za-z0-9_.-]+=|ModOptions|ModSettings|erasing" "$LOG" | cut -c1-400 > "$OUT/mod-load-lines.log"
grep -i "error\|exception" "$LOG" | grep -v -E "SKC|settings-keeper" | cut -c1-300 | tail -40 > "$OUT/other-errors.txt"
cp "$S/Logs/Modding.log" "$OUT/Modding.log" 2>/dev/null
cp "$S/LocalStorage.sqlite" "$OUT/LocalStorage.sqlite.post" 2>/dev/null
ips_after=$(ls ~/Library/Logs/DiagnosticReports/CivilizationVII-*.ips 2>/dev/null | sort)
for f in $(comm -13 <(printf '%s\n' "$ips_before") <(printf '%s\n' "$ips_after")); do cp "$f" "$OUT/"; say "crash report: $(basename "$f")"; done

if pgrep -x CivilizationVII >/dev/null; then pkill -TERM -x CivilizationVII; sleep 8; pgrep -x CivilizationVII >/dev/null && { sleep 10; pkill -KILL -x CivilizationVII; }; fi
# registry: drop the run's rows, put every pre-existing row's flag back, switch off anything that re-registered
sqlite3 "$DB" "delete from Mods where ModId in ('skc-probe','tower-settings-keeper','AutoMissionary')"
sqlite3 "$DB" "attach '$OUT/Mods.sqlite.pre' as pre; update Mods set Disabled=(select pm.Disabled from pre.Mods pm where pm.ModRowId=Mods.ModRowId) where ModRowId in (select ModRowId from pre.Mods)"
sqlite3 "$DB" "attach '$OUT/Mods.sqlite.pre' as pre; update Mods set Disabled=1 where ModRowId not in (select ModRowId from pre.Mods) and ScannedFileRowId in (select ScannedFileRowId from ScannedFiles where Path not like '%/steamapps/common/%')"
sqlite3 "$DB" "attach '$OUT/Mods.sqlite.pre' as pre; update Mods set Disabled=0 where ModRowId not in (select ModRowId from pre.Mods) and ScannedFileRowId in (select s.ScannedFileRowId from ScannedFiles s where s.Path in (select ps.Path from pre.Mods pm join pre.ScannedFiles ps on pm.ScannedFileRowId=ps.ScannedFileRowId where ifnull(pm.Disabled,0)=0 and ps.Path not like '%/steamapps/common/%'))"
rm -rf "$MODS/tower-settings-keeper" "$MODS/AutoMissionary" "$MODS/skc-probe"
cp "$OUT/AppOptions.txt.pre" "$S/AppOptions.txt"; cp "$OUT/LocalStorage.sqlite.pre" "$S/LocalStorage.sqlite"
[ -f "$OUT/HallofFame.sqlite.pre" ] && cp "$OUT/HallofFame.sqlite.pre" "$S/HallofFame.sqlite"
rm -rf "$S/Saves/Single/auto"; cp -R "$OUT/auto.pre" "$S/Saves/Single/auto"
say "post rows: $(sqlite3 "$OUT/LocalStorage.sqlite.post" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
say "restored: enabled non-bundle rows $(sqlite3 "$DB" "select count(*) from Mods m join ScannedFiles s on m.ScannedFileRowId=s.ScannedFileRowId where s.Path not like '%/steamapps/common/%' and ifnull(m.Disabled,0)=0"); live store $(sqlite3 "$S/LocalStorage.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
say "FINISHED result=$result"
