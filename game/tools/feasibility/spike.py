"""Feasibility spike (throwaway): learn the kid's next move, walls and blowing out candles from recorded play.

usage: python tools/feasibility/spike.py [minutes]
Reads data/spike/ (from export.mjs). Prints PASS/FAIL per metric:
  median position error < 0.02 m, wall clipping < 0.5 %, candle-out F1 > 0.95.
"""
import json, os, sys, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'spike')
MINUTES = float(sys.argv[1]) if len(sys.argv) > 1 else 8
BINS, SPAN = 64, 0.2  # 3-tick moves binned over +-0.2 m (a 6 mm bin)
torch.manual_seed(0); np.random.seed(0); torch.set_num_threads(8)

meta = json.load(open(os.path.join(ROOT, 'meta.json')))
nin, nout = len(meta['inputs']), len(meta['targets'])
X = np.fromfile(os.path.join(ROOT, 'rows.f32'), np.float32).reshape(-1, nin + nout)
inp, tgt = X[:, :nin], X[:, nin:]
cont, patch = inp[:, :13], inp[:, 13:].astype(np.int64)  # 13 numbers + 25 tile codes
NT = int(patch.max()) + 1
blocked = np.zeros(NT, bool); blocked[meta['blocked']] = True

# 80/20 split by row blocks (neighbouring rows are near-duplicates, so split in chunks of 2000)
chunk = np.arange(len(X)) // 2000
test = (chunk % 5) == 0
def tens(a): return torch.from_numpy(np.ascontiguousarray(a))
cont_t, patch_t, tgt_t = tens(cont), tens(patch), tens(tgt)
tr, te = np.where(~test)[0], np.where(test)[0]
to_bin = lambda d: ((d + SPAN) / (2 * SPAN) * BINS).clamp(0, BINS - 1).long()
centre = lambda b: (b.float() + 0.5) / BINS * 2 * SPAN - SPAN

class Spike(nn.Module):
    def __init__(s):
        super().__init__()
        s.tile = nn.Embedding(NT, 8)
        s.body = nn.Sequential(nn.Linear(13 + 25 * 8, 256), nn.GELU(), nn.Linear(256, 256), nn.GELU(), nn.Linear(256, 256), nn.GELU())
        s.mx, s.mz, s.rest = nn.Linear(256, BINS), nn.Linear(256, BINS), nn.Linear(256, 2)
    def forward(s, c, p):
        h = s.body(torch.cat([c, s.tile(p).flatten(1)], 1))
        r = s.rest(h)
        return s.mx(h), s.mz(h), r[:, 0], r[:, 1]

m = Spike(); opt = torch.optim.AdamW(m.parameters(), 2e-3, weight_decay=1e-4)
pos = float(tgt[tr, 3].mean()); pw = torch.tensor(min(20.0, (1 - pos) / max(pos, 1e-6)))  # a rare event: weight it, but not 500x
print(f'{len(X)} rows ({len(tr)} train / {len(te)} test), candle-outs {int(tgt[:, 3].sum())}, params {sum(p.numel() for p in m.parameters())/1e6:.2f} M')

def loss_on(idx):
    c, p, y = cont_t[idx], patch_t[idx], tgt_t[idx]
    lx, lz, prog, out = m(c, p)
    return (F.cross_entropy(lx, to_bin(y[:, 0])) + F.cross_entropy(lz, to_bin(y[:, 1]))
            + F.mse_loss(prog, (y[:, 2] - c[:, 11]) * 30) + F.binary_cross_entropy_with_logits(out, y[:, 3], pos_weight=pw))

t0, ep = time.time(), 0
sched_steps = 0
while time.time() - t0 < MINUTES * 60:
    perm = np.random.permutation(tr)
    for i in range(0, len(perm), 2048):
        loss = loss_on(perm[i:i + 2048]); opt.zero_grad(); loss.backward(); opt.step(); sched_steps += 1
        if time.time() - t0 > MINUTES * 60: break
    ep += 1
    print(f'epoch {ep}  loss {loss.item():.4f}  {time.time() - t0:.0f} s', flush=True)

m.eval()
with torch.no_grad():
    c, p, y = cont_t[te], patch_t[te], tgt_t[te]
    lx, lz, prog, out = m(c, p)
    px, pz = centre(lx.argmax(1)), centre(lz.argmax(1))
    err = torch.hypot(px - y[:, 0], pz - y[:, 1]).numpy()
    # where the kid's centre lands: which cell of its 5x5 patch
    fx, fz = c[:, 0] + px, c[:, 1] + pz
    cx, cz = torch.floor(fx).long() + 2, torch.floor(fz).long() + 2
    cell = p[torch.arange(len(p)), (cz * 5 + cx).clamp(0, 24)]
    clip = blocked[cell.numpy()]
    # the hard rows: a wall right next to the kid and it is pushing toward it
    near = torch.zeros(len(p), dtype=torch.bool)
    for ddx, ddz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nb = torch.from_numpy(blocked[p[:, (2 + ddz) * 5 + 2 + ddx].numpy()])
        near |= nb & ((c[:, 4] * ddx + c[:, 5] * ddz) > 0.5)
    predout = (out > 0).numpy(); trueout = y[:, 3].numpy() > 0.5
    tp = (predout & trueout).sum(); f1 = 2 * tp / max(1, predout.sum() + trueout.sum())
    print(f'candle-out precision {tp / max(1, predout.sum()):.3f}, recall {tp / max(1, trueout.sum()):.3f}')
    dprog = prog / 30
    perr = (c[:, 11] + dprog - y[:, 2]).abs().numpy()
    # a lit candle's progress tops out at 0.99999 (90 ticks of 1/90 in floating point); the tick it goes out it
    # passes 1.011, so 'out' is the predicted progress passing 1.005
    derived = ((c[:, 11] + dprog) > 1.005).numpy()
    tpd = (derived & trueout).sum(); f1d = 2 * tpd / max(1, derived.sum() + trueout.sum())
    print(f'out from progress: precision {tpd / max(1, derived.sum()):.3f}, recall {tpd / max(1, trueout.sum()):.3f}, classifier F1 {f1:.3f}')

res = [
    ('median position error (m)', float(np.median(err)), '<', 0.02),
    ('wall clipping, all rows (%)', float(clip.mean() * 100), '<', 0.5),
    ('wall clipping, pushing into a wall (%)', float(clip[near.numpy()].mean() * 100), '<', 0.5),
    ('candle-out F1 (progress reaches 1)', float(f1d), '>', 0.95),
]
print(f'\n95th pct position error {np.percentile(err, 95):.4f} m, mean progress error {perr.mean():.4f}, candle-outs in test {int(trueout.sum())}, pushing-into-wall rows {int(near.sum())}')
for name, v, op, lim in res:
    ok = v < lim if op == '<' else v > lim
    print(f'{"PASS" if ok else "FAIL"}  {name}: {v:.4f}  (target {op} {lim})')
