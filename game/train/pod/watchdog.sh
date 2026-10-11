#!/bin/bash
# The pod's own guard, independent of anyone watching from outside:
#  - a running job whose heartbeat is older than STALL seconds is killed (job.sh restarts it from its checkpoint);
#  - every 15 min a line goes to /workspace/gn/watchdog.log (the outside watchers read it);
#  - past MAX_HOURS of pod time it stops all training and stops the machine (the budget cap): on Vast.ai with the
#    instance's own key (CONTAINER_ID, CONTAINER_API_KEY), on Runpod with runpodctl (its key may be refused there, so
#    the outside watcher is the real stop).
STALL=${STALL:-900}; MAX_HOURS=${MAX_HOURS:-20}
LOG=/workspace/gn/watchdog.log
# the pod's own Runpod key and id live in its main process's environment (an ssh session does not have them)
while IFS= read -r -d '' kv; do case "$kv" in RUNPOD_API_KEY=*|RUNPOD_POD_ID=*|CONTAINER_ID=*|CONTAINER_API_KEY=*) export "$kv";; esac; done < /proc/1/environ
# pod time: since the container's main process started (/proc/uptime is the host's, days long)
BORN=$(stat -c %Y /proc/1)
echo "$(date -u +%FT%TZ) watchdog start: pod age $(( ($(date +%s) - BORN) / 60 )) min, stall ${STALL}s, budget ${MAX_HOURS} h" >> "$LOG"
last=0
while true; do
  now=$(date +%s); up=$(( now - BORN ))
  for d in /workspace/gn/runs/*/; do
    [ "$(cat "$d/status" 2>/dev/null)" = running ] || continue
    hb=$(cut -d' ' -f1 "$d/heartbeat" 2>/dev/null || echo 0)
    started=$(stat -c %Y "$d/status")
    ref=$(( hb > started ? hb : started ))
    if [ $(( now - ref )) -gt "$STALL" ]; then
      echo "$(date -u +%FT%TZ) STALL $d (no heartbeat for $(( now - ref )) s): killing its trainer" >> "$LOG"
      pkill -f -- "--out ${d%/}"; touch "$d/status"
    fi
  done
  if [ $(( now - last )) -ge 900 ]; then
    last=$now
    gpu=$(nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null)
    jobs=$(for d in /workspace/gn/runs/*/; do printf '%s=%s ' "$(basename "$d")" "$(cat "$d/status" 2>/dev/null)"; done)
    echo "$(date -u +%FT%TZ) alive age=$((up / 60))min gpu=[$gpu] $jobs" >> "$LOG"
  fi
  if [ "$up" -gt $(( MAX_HOURS * 3600 )) ]; then
    echo "$(date -u +%FT%TZ) BUDGET: pod up ${MAX_HOURS} h, stopping all training" >> "$LOG"
    pkill -f train.py; sleep 5
    if [ -n "$CONTAINER_ID" ]; then  # Vast.ai: stop (the disk and its checkpoints stay)
      curl -s -X PUT -H "Authorization: Bearer $CONTAINER_API_KEY" -H 'Content-Type: application/json' -d '{"state": "stopped"}'         "https://console.vast.ai/api/v0/instances/$CONTAINER_ID/" >> "$LOG" 2>&1 || echo "$(date -u +%FT%TZ) vast stop failed" >> "$LOG"
    else
      runpodctl stop pod "$RUNPOD_POD_ID" >> "$LOG" 2>&1 || echo "$(date -u +%FT%TZ) runpodctl stop refused: the outside watcher must stop the pod" >> "$LOG"
    fi
    exit 0
  fi
  sleep 60
done
