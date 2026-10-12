#!/bin/bash
# After v5_run.sh: the 10-steps-a-second world (each step 0.1 s: real time on the laptop) from v5_M_r3: TF minutes
# teacher-forced at stride 2, then RO minutes of rollouts; the monster's brain plays the monster, so the world only has
# to carry out its buttons over the longer step.   -> runs/v5_M_s2, runs/v5_M_s2r3, onnx/...
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
set -e
cd /workspace/gn
COMMON="--data data/v5 --size M --data_device cpu --whole_map --oversample 6 --stride 2"
bash game/train/pod/job.sh v5_M_s2 $COMMON --minutes "${TF:-40}" --lr 2e-4 --init runs/v5_M_r3/best.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M_s2/best.pt --out onnx/v5_M_s2 --play
bash game/train/pod/job.sh v5_M_s2r3 $COMMON --minutes "${RO:-50}" --rollout_from 0 --rollout_k 2 --lr 2e-4 --init runs/v5_M_s2/best.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M_s2r3/best.pt --out onnx/v5_M_s2r3 --play
echo s2 done
