#!/bin/bash
# One-time pod setup: Node (for the data generator), then generate the dataset on the pod's CPUs.
# usage: setup.sh BATCH COUNT [WORKERS=24] [gen.mjs flags, e.g. --keys 0.35]   (nproc shows the host's cores, not the pod's share)
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH  # Vast.ai images keep Python in a venv
set -e
cd /workspace/gn
if ! command -v node >/dev/null; then
  curl -fsSL https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz | tar -xJ -C /opt
  ln -sf /opt/node-v24.19.0-linux-x64/bin/node /usr/local/bin/node
fi
node --version
# onnx for export.py (pip may refuse the system Python without the flag)
python -c "import onnx, onnxscript" 2>/dev/null || pip install -q onnx onnxscript 2>/dev/null || pip install -q --break-system-packages onnx onnxscript
[ -z "$1" ] && exit 0  # no batch: tools only
cd game && node tools/gen.mjs "$1" "$2" "${3:-24}" --out /workspace/gn/data "${@:4}" > /workspace/gn/gen.log 2>&1
tail -2 /workspace/gn/gen.log
