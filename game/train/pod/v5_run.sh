#!/bin/bash
# The day of 2026-10-12, after setup.sh: crawl spaces are no longer safe (rules VENT) and the monster's brain is a
# separate player, so the world model only has to carry out the giant's buttons.
#   data v5: GAMES games under the new rules, NM of them against the nightmare (the rest the coded types: more kinds
#   of buttons to carry out), 35% keyboard kids, 50% curious, half varied; then v4_M_r3 (init/v4_M_r3.pt) fine-tuned on
#   it: TF minutes teacher-forced, then RO minutes of rollouts (round 3's recipe); the play graphs of both.
# usage: [GAMES=30000] [NM=0.8] [TF=50] [RO=70] v5_run.sh      -> runs/v5_M, runs/v5_M_r3, onnx/v5_M, onnx/v5_M_r3
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
set -e
cd /workspace/gn
GAMES=${GAMES:-30000}; NM=${NM:-0.8}
[ -f data/v5/schema.json ] || (cd game && node tools/gen.mjs v5 "$GAMES" "${WORKERS:-24}" --out /workspace/gn/data --keys 0.35 --curious 0.5 --vary 0.5 \
  --nightmare "$NM" --policy /workspace/gn/init/nightmare.json > /workspace/gn/gen_v5.log 2>&1)
tail -2 gen_v5.log 2>/dev/null || true
COMMON="--data data/v5 --size M --data_device cpu --whole_map --oversample 6"
bash game/train/pod/job.sh v5_M $COMMON --minutes "${TF:-50}" --lr 2e-4 --init /workspace/gn/init/v4_M_r3.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M/best.pt --out onnx/v5_M --play
bash game/train/pod/job.sh v5_M_r3 $COMMON --minutes "${RO:-70}" --rollout_from 0 --rollout_k 2 --lr 2e-4 --init runs/v5_M/best.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M_r3/best.pt --out onnx/v5_M_r3 --play
echo v5 done
