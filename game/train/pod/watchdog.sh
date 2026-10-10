#!/bin/bash
# The pod's own guard, independent of anyone watching from outside:
#  - a running job whose heartbeat is older than STALL seconds is killed (job.sh restarts it from its checkpoint);
#  - every 15 min a line goes to /workspace/gn/watchdog.log (the outside watchers read it);
#  - past MAX_HOURS of pod time it stops everything and stops the pod (the budget cap).
STALL=${STALL:-900}; MAX_HOURS=${MAX_HOURS:-20}
LOG=/workspace/gn/watchdog.log
last=0
while true; do
  now=$(date +%s); up=$(cut -d. -f1 /proc/uptime)
  for d in /workspace/gn/runs/*/; do
    [ "$(cat "$d/status" 2>/dev/null)" = running ] || continue
    hb=$(cut -d' ' -f1 "$d/heartbeat" 2>/dev/null || echo 0)
    started=$(stat -c %Y "$d/status")
    ref=$(( hb > started ? hb : started ))
    if [ $(( now - ref )) -gt "$STALL" ]; then
      echo "$(date -u +%FT%TZ) STALL $d (no heartbeat for $(( now - ref )) s): killing its trainer" >> "$LOG"
      pkill -f -- "--out ${d%/}" ; touch "$d/status"
    fi
  done
  if [ $(( now - last )) -ge 900 ]; then
    last=$now
    gpu=$(nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null)
    jobs=$(for d in /workspace/gn/runs/*/; do printf '%s=%s ' "$(basename "$d")" "$(cat "$d/status" 2>/dev/null)"; done)
    echo "$(date -u +%FT%TZ) alive up=$((up/60))min gpu=[$gpu] $jobs" >> "$LOG"
  fi
  if [ "$up" -gt $(( MAX_HOURS * 3600 )) ]; then
    echo "$(date -u +%FT%TZ) BUDGET: pod up ${MAX_HOURS} h, stopping everything" >> "$LOG"
    pkill -f train.py; sleep 5
    runpodctl stop pod "$RUNPOD_POD_ID" >> "$LOG" 2>&1 || echo "runpodctl stop failed" >> "$LOG"
    exit 0
  fi
  sleep 60
done
