#!/bin/zsh
# run-embed.sh: watch the settings-keeper.js copies embedded in the tower mods, one Civ VII launch per call.
#   run-embed.sh init            back up the registry, store, options, Hall of Fame and autosaves once for the whole
#                                matrix, and move the subscribed Workshop keeper aside so it cannot join a run
#   run-embed.sh run <label>     one launch (env below); the store is left as the run ends so the next run can read it
#   run-embed.sh restore         put everything from init back
# Env for run:
#   CARRIERS="canals dams ..."   tower_mods folders to install as Mods/emb-<folder> (repo copies, no dist/)
#   WITH_K=1                     also install the standalone keeper (dev copy) as Mods/emb-tower_settings_keeper
#   STORE=base|keep              start from the matrix's saved store, or from what the previous run left
#   POISON=am|unknown|none       add a raw row sorting before modSettings: AutoMissionary's (a key the keeper knows) or
#                                an unknown one
#   START_AGE=AGE_EXPLORATION    Play Now in that age (National Parks loads its game scripts in Exploration and Modern)
#   USER_MODS=1                  keep the player's own enabled third-party mods on (only same-id tower rows go off)
# Runs land in devtools/compat/runs/EMB/<label>/ (gitignored).
set -u
S="$HOME/Library/Application Support/Civilization VII"; DB="$S/Mods.sqlite"; MODS="$S/Mods"; LOG="$S/Logs/UI.log"
WS="$HOME/Library/Application Support/Steam/steamapps/workshop/content/1295660"; WSK="3815023570"
HERE="$(cd "$(dirname "$0")" && pwd)"; TOWER="$(cd "$HERE/../../.." && pwd)"; M="$HERE/runs/EMB/_matrix"
TOWER_IDS="'all-display-options','tower-build-wonders-over-antiquated-buildings','tower-canals','cultural-diffusion','tower-dams','emigration','tmt-geographic-labels','tmt-geographic-labels-dev','tower-national-park','readable-tooltips','universal-auto-explore','demographics','tower-settings-keeper'"
say() { echo "[$(date +%H:%M:%S)] $*" | tee -a "${OUT:-$M}/runner.log"; }
busy() {
  if pgrep -x CivilizationVII >/dev/null; then echo "game is running; refusing"; return 0; fi
  local f; f=$(ls "$MODS" | grep -vE '^(Mods.sqlite|emb-.*)$' | grep -iE 'probe|repro|lab-|ynamp|harness|^tower-' | head -1)
  if [ -n "$f" ]; then echo "foreign test folder in Mods/: $f; refusing"; return 0; fi
  return 1
}

case "$1" in
init)
  busy && exit 1
  [ -d "$M" ] && { echo "matrix backup already exists at $M; restore first"; exit 1; }
  mkdir -p "$M"
  cp "$DB" "$M/Mods.sqlite"; cp "$S/LocalStorage.sqlite" "$M/LocalStorage.sqlite"; cp "$S/AppOptions.txt" "$M/AppOptions.txt"
  [ -f "$S/HallofFame.sqlite" ] && cp "$S/HallofFame.sqlite" "$M/HallofFame.sqlite"
  cp -R "$S/Saves/Single/auto" "$M/auto"
  [ -d "$S/Saves/Single/quick" ] && cp -R "$S/Saves/Single/quick" "$M/quick"
  if [ -d "$WS/$WSK" ]; then mkdir -p "$M/hold"; mv "$WS/$WSK" "$M/hold/$WSK"; say "moved Workshop keeper $WSK aside"; fi
  say "init done: store $(sqlite3 "$M/LocalStorage.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
  ;;
restore)
  busy && exit 1
  rm -rf "$MODS"/emb-*
  cp "$M/Mods.sqlite" "$DB"; cp "$M/LocalStorage.sqlite" "$S/LocalStorage.sqlite"; cp "$M/AppOptions.txt" "$S/AppOptions.txt"
  [ -f "$M/HallofFame.sqlite" ] && cp "$M/HallofFame.sqlite" "$S/HallofFame.sqlite"
  rm -rf "$S/Saves/Single/auto"; cp -R "$M/auto" "$S/Saves/Single/auto"
  if [ -d "$M/quick" ]; then rm -rf "$S/Saves/Single/quick"; cp -R "$M/quick" "$S/Saves/Single/quick"; fi
  if [ -d "$M/hold/$WSK" ]; then mv "$M/hold/$WSK" "$WS/$WSK"; say "Workshop keeper $WSK put back"; fi
  say "restored: store $(sqlite3 "$S/LocalStorage.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
  mv "$M" "$M.restored-$(date +%H%M%S)"
  ;;
run)
  LABEL="$2"; OUT="$HERE/runs/EMB/$LABEL"; rm -rf "$OUT"; mkdir -p "$OUT"
  [ -d "$M" ] || { echo "run init first"; exit 1; }
  if busy; then say "busy; refusing"; exit 1; fi
  CARRIERS="${CARRIERS:-}"; WITH_K="${WITH_K:-0}"; STORE="${STORE:-keep}"; POISON="${POISON:-none}"
  START_AGE="${START_AGE:-}"; USER_MODS="${USER_MODS:-0}"
  say "run $LABEL carriers=[$CARRIERS] with_k=$WITH_K store=$STORE poison=$POISON age=${START_AGE:-antiquity} user_mods=$USER_MODS"
  # registry: fresh copy of the player's, then switch off everything (or only the tower rows) so only our copies load
  cp "$M/Mods.sqlite" "$DB"
  if [ "$USER_MODS" = "1" ]; then
    sqlite3 "$DB" "update Mods set Disabled=1 where ModId in ($TOWER_IDS)"
  else
    sqlite3 "$DB" "update Mods set Disabled=1 where ScannedFileRowId in (select ScannedFileRowId from ScannedFiles where Path not like '%/steamapps/common/%')"
  fi
  # store
  [ "$STORE" = "base" ] && cp "$M/LocalStorage.sqlite" "$S/LocalStorage.sqlite"
  case "$POISON" in
    am) sqlite3 "$S/LocalStorage.sqlite" "insert or replace into \"Values\" values('fs://game','AutoMissionary.settings.v2','{\"autoSpread\":true,\"targetCityStates\":true,\"targetTriumphs\":true,\"garrisonLastCharge\":false,\"ignoreAsleep\":true,\"showDockButton\":false}')";;
    unknown) sqlite3 "$S/LocalStorage.sqlite" "insert or replace into \"Values\" values('fs://game','!emb-unknown','{\"someone\":\"else\",\"n\":42}')";;
  esac
  cp "$S/LocalStorage.sqlite" "$OUT/LocalStorage.pre.sqlite"
  say "store before: $(sqlite3 "$S/LocalStorage.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
  # install carriers, keeper, probe
  rm -rf "$MODS"/emb-*
  for c in ${=CARRIERS}; do
    d="$MODS/emb-$c"; mkdir -p "$d"; cp "$TOWER/$c"/*.modinfo "$d/"
    for sub in ui text data icons images lib; do [ -d "$TOWER/$c/$sub" ] && cp -R "$TOWER/$c/$sub" "$d/"; done
    find "$d" -name '*.DS_Store' -delete
  done
  if [ "$WITH_K" = "1" ]; then d="$MODS/emb-tower_settings_keeper"; mkdir -p "$d"; cp -R "$TOWER/tower_settings_keeper/ui" "$TOWER/tower_settings_keeper/text" "$TOWER/tower_settings_keeper/tower-settings-keeper.modinfo" "$d/"; fi
  P="$MODS/emb-probe"; mkdir -p "$P/ui"; cp "$HERE/emb-probe.modinfo" "$P/"
  for scope in shell game; do
    mw=false; [ $scope = shell ] && mw=true
    PX="${PROBE_PREFIX:-emb}"
    { echo "const SCOPE = \"$scope\"; const TOKEN = \"$LABEL\"; const WRITE = true; const MODWRITE = $mw; const START_AGE = \"$START_AGE\"; const PHASE = \"${PHASE:-W}\";"
      cat "$HERE/$PX-common.js" "$HERE/$PX-$scope-tail.js"; } > "$P/ui/emb-$scope.js"
  done
  find "$MODS"/emb-* -type f -exec touch {} +
  ls "$MODS" > "$OUT/mods-dir.txt"
  # the copies match the repo's file byte for byte
  for c in ${=CARRIERS} $([ "$WITH_K" = "1" ] && echo tower_settings_keeper); do
    f=$(find "$MODS/emb-$c/ui" -name settings-keeper.js | head -1)
    cmp -s "$f" "$TOWER/tower_settings_keeper/ui/settings-keeper.js" && echo "$c identical" >> "$OUT/copies.txt" || echo "$c DIFFERS ($f)" >> "$OUT/copies.txt"
  done

  ips_before=$(ls ~/Library/Logs/DiagnosticReports/ 2>/dev/null | grep -i civilization | sort)
  : > "$LOG" 2>/dev/null
  open steam://rungameid/1295660
  n=0; until pgrep -x CivilizationVII >/dev/null; do sleep 2; n=$((n+1)); if [ $n -gt 90 ]; then say "GAME DID NOT START"; break; fi; done
  PID=$(pgrep -x CivilizationVII | head -1); say "game pid $PID"
  t=0; result=timeout
  while [ $t -lt ${TIMEOUT:-420} ]; do
    sleep 4; t=$((t+4))
    if grep -qE "${DONE_RE:-\[(EMB|EO)\] game DONE-GAME}" "$LOG" 2>/dev/null; then result=done; sleep 3; break; fi
    if grep -qE "\[(EMB|EO|MX)\] game LOAD gave up" "$LOG" 2>/dev/null; then result=loadfail; break; fi
    if ! pgrep -x CivilizationVII >/dev/null; then result=crashed; sleep 30; break; fi
  done
  say "result=$result after ${t}s"
  cp "$LOG" "$OUT/full-UI.log" 2>/dev/null; cp "$S/Logs/Modding.log" "$OUT/Modding.log" 2>/dev/null
  grep -E "\[(EMB|EO|MX)\]|\[settings-keeper\]" "$LOG" | cut -c1-1500 > "$OUT/probe.log"
  grep -n "Loading Mod - " "$S/Logs/Modding.log" | sed 's/.*Loading Mod - //' > "$OUT/loaded-mods.txt"
  grep -iE "error|exception|uncaught|failed" "$LOG" | grep -v -E "\[EMB\]|\[settings-keeper\]" | cut -c1-300 > "$OUT/other-errors.txt"
  if pgrep -x CivilizationVII >/dev/null; then pkill -TERM -x CivilizationVII; sleep 8; pgrep -x CivilizationVII >/dev/null && { sleep 10; pkill -KILL -x CivilizationVII; sleep 3; }; fi
  cp "$S/LocalStorage.sqlite" "$OUT/LocalStorage.post.sqlite"
  say "store after: $(sqlite3 "$OUT/LocalStorage.post.sqlite" 'select key||":"||length(value) from "Values";' | tr '\n' ' ')"
  ips_after=$(ls ~/Library/Logs/DiagnosticReports/ 2>/dev/null | grep -i civilization | sort)
  for f in $(comm -13 <(printf '%s\n' "$ips_before") <(printf '%s\n' "$ips_after")); do cp ~/Library/Logs/DiagnosticReports/"$f" "$OUT/"; say "crash report: $f"; done
  # per-run cleanup of what a Play Now game touches; the store stays for the next run, the registry is reset per run
  rm -rf "$MODS"/emb-*
  cp "$M/AppOptions.txt" "$S/AppOptions.txt"; [ -f "$M/HallofFame.sqlite" ] && cp "$M/HallofFame.sqlite" "$S/HallofFame.sqlite"
  rm -rf "$S/Saves/Single/auto"; cp -R "$M/auto" "$S/Saves/Single/auto"
  cp "$M/Mods.sqlite" "$DB"
  say "FINISHED $LABEL result=$result"
  ;;
esac
