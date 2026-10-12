#!/bin/bash
# The giant's tools inside the real-time world: data v5 again (30,000 games, 8,000 crawl drills, 16,000 tools drills),
# then v5_M_s2r3 (init/v5_M_s2r3.pt) fine-tuned teacher-forced for TF minutes with rare rows (the tools among them)
# drawn OVER times more; its play graphs and its exams with the brain.   -> runs/v5_M_s2t, onnx/v5_M_s2t
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
set -e
cd /workspace/gn/game
P=/workspace/gn/init/nightmare_e.json
if [ ! -f /workspace/gn/data/v5/schema.json ]; then
  node tools/gen.mjs v5 30000 48 --out /workspace/gn/data --keys 0.35 --curious 0.5 --vary 0.5 --nightmare 0.8 --policy "$P" > /workspace/gn/gen_v5.log 2>&1
  node tools/gen.mjs v5d 8000 48 --out /workspace/gn/data --keys 0.35 --vary 0.5 --nightmare 0.8 --crawl 1 --policy "$P" > /workspace/gn/gen_v5d.log 2>&1
  node tools/gen.mjs v5t 16000 48 --out /workspace/gn/data --keys 0.35 --vary 0.5 --nightmare 0.8 --tools 1 --policy "$P" > /workspace/gn/gen_v5t.log 2>&1
  cd /workspace/gn/data
  for s in v5d/shard-*; do n=${s##*shard-}; mv "$s" "v5/shard-9$n"; done
  for s in v5t/shard-*; do n=${s##*shard-}; mv "$s" "v5/shard-8$n"; done
fi
cd /workspace/gn
bash game/train/pod/job.sh v5_M_s2t --data data/v5 --size M --data_device cpu --whole_map --oversample "${OVER:-10}" --stride 2 --minutes "${TF:-45}" --lr 2e-4 --init /workspace/gn/init/v5_M_s2r3.pt
python game/train/export.py --schema data/v5/schema.json --size M --ckpt runs/v5_M_s2t/best.pt --out onnx/v5_M_s2t --play
BRAIN=1 P=$P bash game/train/pod/v4_exams.sh v5_M_s2t 40 3 48 > exams_v5_M_s2t.log 2>&1
echo s2t done
