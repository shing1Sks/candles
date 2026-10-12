#!/bin/bash
# After the s2r3 exams: round 4 of the real-time world on data v5 with the giant's-tools drills (and their rows and
# presses oversampled), RO minutes of rollouts at a lower rate; its play graphs and its exams with the brain.
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
set -e
cd /workspace/gn
COMMON="--data data/v5 --size M --data_device cpu --whole_map --oversample 6 --stride 2"
bash game/train/pod/job.sh v5_M_s2r4 $COMMON --minutes "${RO:-45}" --rollout_from 0 --rollout_k 2 --lr 1e-4 --init runs/v5_M_s2r3/best.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M_s2r4/best.pt --out onnx/v5_M_s2r4 --play
BRAIN=1 P=/workspace/gn/init/nightmare_e.json bash game/train/pod/v4_exams.sh v5_M_s2r4 40 3 48 > exams_v5_M_s2r4.log 2>&1
echo s2r4 done
