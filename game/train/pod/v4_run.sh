#!/bin/bash
# Data v4 and the whole-house model (2026-10-12), after setup.sh has put Node on the machine:
#   data v4: GAMES games against the nightmare (the learned monster, weights game/public/nightmare.json), 35% keyboard
#   kids, 50% curious kids (doors, toys, squeaks, boards, wardrobes), half the bots' styles varied; then SIZE with --whole_map and rare moments drawn
#   OVER times more, EPOCHS with rollouts from ROLL; then R3 epochs of rollout training on top (round 3, the recipe
#   that played best on 2026-10-11); the play graphs of both.
# usage: [OVER=6] [ROLL=0.7] [R3=2] [EXTRA=...] v4_run.sh [SIZE=M] [EPOCHS=3] [GAMES=15000]
#   -> runs/v4_SIZE, runs/v4_SIZE_r3, onnx/v4_SIZE, onnx/v4_SIZE_r3
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH  # Vast.ai images keep Python in a venv
set -e
cd /workspace/gn
SIZE=${1:-M}; EPOCHS=${2:-3}; GAMES=${3:-15000}; OVER=${OVER:-6}; R3=${R3:-2}
[ -f data/v4/schema.json ] || (cd game && node tools/gen.mjs v4 "$GAMES" "${WORKERS:-16}" --out /workspace/gn/data --keys 0.35 --curious 0.5 --vary 0.5 \
  --nightmare 1 --policy /workspace/gn/game/public/nightmare.json > /workspace/gn/gen_v4.log 2>&1)
tail -2 gen_v4.log 2>/dev/null || true
COMMON="--data data/v4 --size $SIZE --data_device cpu --whole_map --oversample $OVER $EXTRA"
bash game/train/pod/job.sh "v4_$SIZE" $COMMON --epochs "$EPOCHS" --rollout_from "${ROLL:-0.7}"
python game/train/export.py --schema data/v4/schema.json --size "$SIZE" --ckpt "runs/v4_$SIZE/best.pt" --out "onnx/v4_$SIZE" --play
if [ "$R3" != "0" ]; then
  bash game/train/pod/job.sh "v4_${SIZE}_r3" $COMMON --epochs "$R3" --rollout_from 0 --rollout_k 2 --lr 2e-4 --init "runs/v4_$SIZE/best.pt"
  python game/train/export.py --schema data/v4/schema.json --size "$SIZE" --ckpt "runs/v4_${SIZE}_r3/best.pt" --out "onnx/v4_${SIZE}_r3" --play
fi
echo v4 done
