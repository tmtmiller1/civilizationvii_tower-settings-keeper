#!/bin/zsh
# run-func.sh - behaviour that depends on the persisted options, control (player's own store, defaults) vs
# persisted (the store the Options run left, runs/O3/LocalStorage.sqlite.post). Two launches.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; R="$HERE/runs"
export PROBE_SHELL=skc-shell.js PROBE_GAME=sko-func.js TIMEOUT=600
zsh "$HERE/run-compat.sh" F-control control
sleep 20
zsh "$HERE/run-compat.sh" F-persisted persisted "$R/O3/LocalStorage.sqlite.post"
for p in F-control F-persisted; do
  echo "=== $p"; grep -a -E "\[SKC\] (START|bz|units|lens|CD|Canals|DONE)" "$R/$p/full-UI.log" | sed -E 's/^\[[^]]*\][[:space:]]*//' | cut -c1-600
  echo "--- mod lines"; grep -a -E "\[Canals\] active|LOAD (bz-map-trix\.(commanders|yieldBanner)|sib-celebratory-celebrations\.(masterEnable|showFireworks))=" "$R/$p/full-UI.log" | sed -E 's/^\[[^]]*\][[:space:]]*//' | sort -u
  grep -E "shot " "$R/$p/runner.log"
done
echo "FUNC_FINISHED"
