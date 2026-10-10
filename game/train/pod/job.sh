#!/bin/bash
# Run one training job, restarting it from its last checkpoint if it dies (up to 4 tries).
# usage: job.sh NAME [train.py args...]      status: /workspace/gn/runs/NAME/status (running | done | failed)
NAME=$1; shift
D=/workspace/gn/runs/$NAME; mkdir -p "$D"
echo running > "$D/status"
for try in 1 2 3 4; do
  python -u /workspace/gn/game/train/train.py --out "$D" "$@" >> "$D/stdout.log" 2>&1 && { echo done > "$D/status"; exit 0; }
  echo "=== try $try ended badly at $(date -u +%FT%TZ)" >> "$D/stdout.log"; sleep 10
done
echo failed > "$D/status"
