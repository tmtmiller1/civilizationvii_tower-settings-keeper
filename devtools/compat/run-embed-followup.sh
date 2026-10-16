#!/bin/zsh
set -u; cd "$(dirname "$0")"; V=runs/EMB/verdicts.txt
ALL="all-display-options build_wonders_over_antiquated_buildings canals cultural_diffusion dams emigration geographic_labels national_parks readable-tooltips universal_auto-explore demographics numpad-unit-movement zoom-tilt-rotate strategic_resources_that_matter partisans"
one() { local label=$1 prev=$2; shift 2; env "$@" ./run-embed.sh run "$label" > /dev/null 2>&1
  { echo "===== $label ($*)"; python3 emb-check.py runs/EMB/$label ${prev:+runs/EMB/$prev} 2>&1; } >> $V; sleep 15; }
for m in emigration geographic_labels; do
  one "S1b-$m" ""       CARRIERS=$m STORE=base POISON=am
  one "S2b-$m" "S1b-$m" CARRIERS=$m STORE=keep POISON=none
  one "S3b-$m" "S2b-$m" CARRIERS=$m STORE=keep POISON=am WITH_K=1
done
E=AGE_EXPLORATION
one T5b-allK-unknown T5-allK-unknown CARRIERS="$ALL" STORE=keep POISON=none WITH_K=1 START_AGE=$E
one T5c-all-unknown ""               CARRIERS="$ALL" STORE=base POISON=unknown START_AGE=$E
one T5d-all-unknown T5c-all-unknown  CARRIERS="$ALL" STORE=keep POISON=none START_AGE=$E
echo "FOLLOWUP DONE" >> $V
