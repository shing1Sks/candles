#!/bin/bash
# One-time pod setup: Node (for the data generator), then generate the dataset on the pod's CPUs.
# usage: setup.sh BATCH COUNT [WORKERS=24]   (nproc shows the host's cores, not the pod's share)
set -e
cd /workspace/gn
if ! command -v node >/dev/null; then
  curl -fsSL https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz | tar -xJ -C /opt
  ln -sf /opt/node-v24.19.0-linux-x64/bin/node /usr/local/bin/node
fi
node --version
cd game && node tools/gen.mjs "$1" "$2" "${3:-24}" --out /workspace/gn/data > /workspace/gn/gen.log 2>&1
tail -2 /workspace/gn/gen.log
