#!/bin/zsh
# run-embed-matrix.sh: the full embed matrix (after run-embed.sh init). Verdicts go to runs/EMB/verdicts.txt.
set -u
cd "$(dirname "$0")"
V=runs/EMB/verdicts.txt
ALL="all-display-options build_wonders_over_antiquated_buildings canals cultural_diffusion dams emigration geographic_labels national_parks readable-tooltips universal_auto-explore demographics"
one() { # label prev env...
  local label=$1 prev=$2; shift 2
  env "$@" ./run-embed.sh run "$label" > /dev/null 2>&1
  { echo "===== $label ($*)"; python3 emb-check.py runs/EMB/$label ${prev:+runs/EMB/$prev} 2>&1; } >> $V
  sleep 15
}
for m in ${=ONLY:-$ALL}; do
  [ "${SKIP_SOLO:-0}" = 1 ] && break
  age=""; [ $m = national_parks ] && age=AGE_EXPLORATION
  one "S1-$m" ""        CARRIERS=$m STORE=base POISON=am START_AGE=$age
  one "S2-$m" "S1-$m"   CARRIERS=$m STORE=keep POISON=none START_AGE=$age
  one "S3-$m" "S2-$m"   CARRIERS=$m STORE=keep POISON=am WITH_K=1 START_AGE=$age
done
if [ -z "${ONLY:-}" ] || [ "${TOGETHER:-0}" = 1 ]; then
  E=AGE_EXPLORATION
  one T1-all ""        CARRIERS="$ALL" STORE=base POISON=am START_AGE=$E
  one T2-all T1-all    CARRIERS="$ALL" STORE=keep POISON=none START_AGE=$E
  one T3-allK T2-all   CARRIERS="$ALL" STORE=keep POISON=am WITH_K=1 START_AGE=$E
  one T4-allK T3-allK  CARRIERS="$ALL" STORE=keep POISON=none WITH_K=1 START_AGE=$E
  one T5-allK-unknown "" CARRIERS="$ALL" STORE=base POISON=unknown WITH_K=1 START_AGE=$E
  one T6-user-allK ""  CARRIERS="$ALL" STORE=base POISON=none WITH_K=1 USER_MODS=1 START_AGE=$E
  one T7-user-all T6-user-allK CARRIERS="$ALL" STORE=keep POISON=none USER_MODS=1 START_AGE=$E
fi
echo "MATRIX DONE" >> $V
