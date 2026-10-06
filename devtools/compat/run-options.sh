#!/bin/zsh
# run-options.sh - three launches through the REAL Options screen, with screenshots of the game window.
#   1  main menu: change four options (bz Map Trix, sib, Canals, Cultural Diffusion), Confirm, quit; no game
#   2  main menu after a restart: the same rows as the screen shows them; then a game, where three other options
#      are changed on the in-game Options screen and confirmed
#   3  after another restart: the Options screen in the menu and in a game, all seven rows
# The store is carried from launch to launch and the player's own store put back after each one.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; R="$HERE/runs"
build() { python3 - "$HERE/sko-common.js" "$HERE/$1" "$HERE/_built-$1" <<'EOF'
import sys
common, src, dst = sys.argv[1:4]
s = open(src).read().replace("//__COMMON__", open(common).read())
open(dst, "w").write(s)
EOF
}
build sko-shell.js; build sko-game.js
[ -x "$HERE/winid-bin" ] || swiftc -O "$HERE/winid.swift" -o "$HERE/winid-bin"
"$HERE/winid-bin" >/dev/null 2>&1; echo "winid helper ready"
export PROBE_SHELL=_built-sko-shell.js PROBE_GAME=_built-sko-game.js TIMEOUT=900
zsh "$HERE/run-compat.sh" O1 1
sleep 20
zsh "$HERE/run-compat.sh" O2 2 "$R/O1/LocalStorage.sqlite.post"
sleep 20
zsh "$HERE/run-compat.sh" O3 3 "$R/O2/LocalStorage.sqlite.post"
for p in O1 O2 O3; do echo "=== $p"; grep -a -E "\[SKC\]|\[settings-keeper\]" "$R/$p/full-UI.log" | grep -v " SHOT " | cut -c1-900; grep -E "shot " "$R/$p/runner.log"; done
echo "OPTIONS_FINISHED"
