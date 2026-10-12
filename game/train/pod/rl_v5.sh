#!/bin/bash
# The nightmare relearns under the new rules (crawl spaces no longer safe), from its weights (init/nightmare.json and
# .pt), against stronger kids (skill 0.5-1) and in more of a hurry (a decision costs 0.003). RUN [extra ppo args]
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
cd /workspace/gn/game
RUN=${1:-e}; shift
RL_THREADS=8 PYTHONUNBUFFERED=1 nohup python train/rl/ppo.py --out /workspace/gn/rl/$RUN --init /workspace/gn/init/nightmare.json \
  --workers ${RLW:-32} --decisions ${RLD:-96000} --rounds 2000 --collect "--skill_min 0.5 --time 0.003" "$@" > /workspace/gn/rl_$RUN.log 2>&1 < /dev/null &
echo started $RUN
