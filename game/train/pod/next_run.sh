#!/bin/bash
# The next run (training spec section 10), after setup.sh has put Node on the pod:
#   data v3 (keyboard kids), SIZE for EPOCHS with rollouts in the last 30%, the play graphs, a summary line.
# usage: next_run.sh [SIZE=L] [EPOCHS=3] [GAMES=10000]
# The rows stay in RAM (--data_device cpu): 10,000 games are ~26 GB, more than a 4090 holds beside the model.
# Copy runs/main_SIZE/best.pt and summary.json off the pod as soon as they exist: at a $0 balance the pod is deleted.
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH  # Vast.ai images keep Python in a venv
set -e
cd /workspace/gn
SIZE=${1:-L}; EPOCHS=${2:-3}; GAMES=${3:-10000}
[ -f data/v3/schema.json ] || (cd game && node tools/gen.mjs v3 "$GAMES" "${WORKERS:-16}" --out /workspace/gn/data --keys 0.35 > /workspace/gn/gen_v3.log 2>&1)
tail -2 gen_v3.log 2>/dev/null || true
bash game/train/pod/job.sh "main_$SIZE" --data data/v3 --size "$SIZE" --epochs "$EPOCHS" --rollout_from 0.7 --data_device cpu
python game/train/export.py --schema data/v3/schema.json --size "$SIZE" --ckpt "runs/main_$SIZE/best.pt" --out "onnx/play_$SIZE" --play
python3 -c "import json; s=json.load(open('runs/main_$SIZE/summary.json')); print({k: s[k] for k in ('size', 'steps', 'best_check_loss', 'minutes')}, s['exam'])"
