#!/bin/bash
# Backup watcher on the laptop (in case the main watcher, the agent, dies): every 15 min it asks the pod how its jobs
# are doing and appends the answer to .work/pod_watch.log; three silent checks in a row write an ALERT line.
# usage: local_watch.sh HOST PORT        (runs until killed; one copy at a time via a lock file)
HOST=$1; PORT=$2
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="$ROOT/.work/pod_watch.log"; LOCK="$ROOT/.work/local_watch.pid"
echo $$ > "$LOCK"
fails=0
while [ "$(cat "$LOCK" 2>/dev/null)" = "$$" ]; do
  out=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20 -p "$PORT" "root@$HOST" \
    'tail -1 /workspace/gn/watchdog.log; for d in /workspace/gn/runs/*/; do n=$(basename $d); s=$(cat $d/status 2>/dev/null); hb=$(cut -d" " -f1 $d/heartbeat 2>/dev/null || echo 0); echo "$n $s hb_age=$(( $(date +%s) - hb ))s last=$(tail -1 $d/log.jsonl 2>/dev/null | cut -c1-160)"; done' 2>&1)
  if [ $? -eq 0 ]; then fails=0; echo "$(date '+%F %T') OK" >> "$LOG"; echo "$out" | sed 's/^/    /' >> "$LOG"
  else fails=$((fails + 1)); echo "$(date '+%F %T') no answer ($fails): $(echo "$out" | tail -1)" >> "$LOG"
    [ $fails -ge 3 ] && echo "$(date '+%F %T') ALERT: pod silent for 45 min" >> "$LOG"
  fi
  sleep 900
done
