#!/bin/bash
# The rollout exam on the pod (tools/dream_exam.mjs): the trained model against the rules on the same seeded games,
# split over PARTS processes. usage: exam.sh SIZE [GAMES=40] [PARTS=8] [extra dream_exam flags, e.g. --mind 1]
# -> runs/main_SIZE/exam[TAG].json (TAG: EXAM_TAG env, for variants; MODEL env: another exported model dir)
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH  # Vast.ai images keep Python in a venv
set -e
cd /workspace/gn/game
SIZE=$1; GAMES=${2:-40}; PARTS=${3:-8}; shift 3 || true
export PATH=/opt/node-v24.19.0-linux-x64/bin:$PATH
[ -d node_modules/onnxruntime-web ] || npm install --no-save --no-audit --no-fund onnxruntime-web@1.30.0 > /dev/null 2>&1
OUT=/workspace/gn/runs/main_$SIZE; mkdir -p "$OUT/exam_parts"
THREADS=$(( $(nproc) / PARTS )); [ "$THREADS" -gt 4 ] && THREADS=4; [ "$THREADS" -lt 1 ] && THREADS=1
for k in $(seq 0 $((PARTS - 1))); do
  node tools/dream_exam.mjs "${MODEL:-/workspace/gn/onnx/play_$SIZE}" --games "$GAMES" --seconds 120 --part "$k/$PARTS" --threads "$THREADS" "$@" \
    --out "$OUT/exam_parts/p$k$EXAM_TAG.json" > "$OUT/exam_parts/p$k$EXAM_TAG.log" 2>&1 &
done
wait
node tools/dream_exam.mjs --merge "$OUT"/exam_parts/p*"$EXAM_TAG".json --out "$OUT/exam$EXAM_TAG.json" > "$OUT/exam$EXAM_TAG.txt"
grep -h "^game" "$OUT"/exam_parts/p*"$EXAM_TAG".log | sort -n -k2 >> "$OUT/exam$EXAM_TAG.txt"
echo "exam done: $OUT/exam$EXAM_TAG.json"
