"""Train the nightmare's policy with PPO. Each round: the current weights go to `workers` Node processes
(collect.mjs), which play games against the kid bots and write their decisions; then a few epochs of PPO on them.
The policy is the network nightmare.js runs (mlpPolicy): two relu layers of 256, a goal head (masked to what it can
pick now), run yes/no, a tool head (masked); here it also has a value head (its sense of how it is doing).

  python train/rl/ppo.py --out train/rl/runs/a --rounds 200 --workers 10 --decisions 60000
"""
import argparse, json, os, subprocess, time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='train/rl/runs/a')
ap.add_argument('--rounds', type=int, default=200)
ap.add_argument('--workers', type=int, default=10)
ap.add_argument('--decisions', type=int, default=60000)
ap.add_argument('--epochs', type=int, default=4)
ap.add_argument('--mb', type=int, default=4096)
ap.add_argument('--lr', type=float, default=3e-4)
ap.add_argument('--gamma', type=float, default=0.99)
ap.add_argument('--lam', type=float, default=0.95)
ap.add_argument('--ent', type=float, default=0.01)
ap.add_argument('--init', default='')
ap.add_argument('--hidden', type=int, default=256)
ap.add_argument('--switch', type=float, default=None, help='reward cost of a change of mind (collect.mjs default by side)')
ap.add_argument('--side', default='monster', help='who learns: monster (the nightmare) or kid (the evader)')
ap.add_argument('--opp', default='', help='the weights of the other side: the evader in the kid league, or the nightmare the kid plays')
ap.add_argument('--evaders', type=float, default=0.3, help='side monster with --opp: the share of games against the evader')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(os.path.dirname(HERE))
torch.set_num_threads(int(os.environ.get('RL_THREADS', 2)))


class Policy(nn.Module):
    def __init__(s, obs, ng, nt, h):
        super().__init__()
        s.l1, s.l2 = nn.Linear(obs, h), nn.Linear(h, h)
        s.g, s.r, s.t, s.v = nn.Linear(h, ng), nn.Linear(h, 2), nn.Linear(h, nt), nn.Linear(h, 1)

    def forward(s, x):
        h = F.relu(s.l2(F.relu(s.l1(x))))
        return s.g(h), s.r(h), s.t(h), s.v(h).squeeze(-1)

    def weights(s):
        f = lambda t: [round(v, 6) for v in t.detach().flatten().tolist()]
        return dict(W1=f(s.l1.weight), b1=f(s.l1.bias), W2=f(s.l2.weight), b2=f(s.l2.bias), Wg=f(s.g.weight), bg=f(s.g.bias),
                    Wr=f(s.r.weight), br=f(s.r.bias), Wt=f(s.t.weight), bt=f(s.t.bias))


def masked(logits, mask):
    return logits.masked_fill(mask < 0.5, -1e9)


def logp_ent(net, x, gm, tm, act):
    g, r, t, v = net(x)
    lg, lr_, lt = F.log_softmax(masked(g, gm), -1), F.log_softmax(r, -1), F.log_softmax(masked(t, tm), -1)
    logp = lg.gather(1, act[:, :1]).squeeze(1) + lr_.gather(1, act[:, 1:2]).squeeze(1) + lt.gather(1, act[:, 2:3]).squeeze(1)
    ent = -(lg.exp() * lg).sum(-1) - (lr_.exp() * lr_).sum(-1) - (lt.exp() * lt).sum(-1)
    return logp, ent, v


def collect(rnd, wpath):
    per = a.decisions // a.workers
    procs = []
    for k in range(a.workers):
        p = os.path.join(a.out, f'part{k}')
        procs.append((subprocess.Popen(['node', os.path.join(HERE, 'collect.mjs'), '--weights', wpath, '--decisions', str(per), '--seed', str(rnd * 1000 + k),
                                        '--out', p + '.bin', '--stats', p + '.json', '--gamma', str(a.gamma), '--side', a.side]
                                        + (['--switch', str(a.switch)] if a.switch is not None else []) + (['--opp', a.opp, '--evaders', str(a.evaders)] if a.opp else []), cwd=GAME), p))
    parts, games = [], []
    for proc, p in procs:
        if proc.wait() != 0: raise SystemExit(f'collect failed: {p}')
        st = json.load(open(p + '.json'))
        parts.append(np.fromfile(p + '.bin', dtype=np.float32).reshape(-1, st['rec']))
        games += st['games']
    return parts, games, st


net = None
log = open(os.path.join(a.out, 'log.jsonl'), 'a')
best = -1e9
for rnd in range(a.rounds):
    t0 = time.time()
    wpath = os.path.join(a.out, 'policy.json')
    if net is None and not a.init: wpath = 'none'
    elif net is None: wpath = a.init
    parts, games, st = collect(rnd, wpath)
    O, NG, NT = st['obs'], st['ng'], st['nt']
    if net is None:
        net = Policy(O, NG, NT, a.hidden)
        if a.init:
            w = json.load(open(a.init))
            with torch.no_grad():
                for name, lin in (('1', net.l1), ('2', net.l2), ('g', net.g), ('r', net.r), ('t', net.t)):
                    lin.weight.copy_(torch.tensor(w['W' + name]).view_as(lin.weight)); lin.bias.copy_(torch.tensor(w['b' + name]))
            if os.path.exists(a.init.replace('.json', '.pt')): net.load_state_dict(torch.load(a.init.replace('.json', '.pt')))
        opt = torch.optim.Adam(net.parameters(), lr=a.lr)
    # advantages per worker stream (each ends at the end of a game)
    X, GM, TM, ACT, ADV, RET = [], [], [], [], [], []
    with torch.no_grad():
        for d in parts:
            x = torch.tensor(d[:, :O]); gm = torch.tensor(d[:, O:O + NG]); tm = torch.tensor(d[:, O + NG:O + NG + NT])
            act = torch.tensor(d[:, O + NG + NT:O + NG + NT + 3]).long(); r = d[:, -2]; done = d[:, -1]
            v = net(x)[3].numpy()
            adv = np.zeros_like(r); last = 0.0
            for i in range(len(r) - 1, -1, -1):
                nv = 0.0 if done[i] else v[i + 1] if i + 1 < len(r) else 0.0
                delta = r[i] + a.gamma * nv - v[i]
                last = delta + a.gamma * a.lam * (0.0 if done[i] else last)
                adv[i] = last
            X.append(x); GM.append(gm); TM.append(tm); ACT.append(act); ADV.append(torch.tensor(adv)); RET.append(torch.tensor(adv + v))
    X, GM, TM, ACT, ADV, RET = map(lambda z: torch.cat(z), (X, GM, TM, ACT, ADV, RET))
    with torch.no_grad(): old, _, _ = logp_ent(net, X, GM, TM, ACT)
    if wpath == 'none': old = torch.full_like(old, float('nan'))  # random play: no old policy; plain policy gradient this round
    ADV = (ADV - ADV.mean()) / (ADV.std() + 1e-8)
    n = len(X); stats = dict(pl=0.0, vl=0.0, ent=0.0, kl=0.0); steps = 0
    for _ in range(a.epochs):
        perm = torch.randperm(n)
        for i in range(0, n, a.mb):
            j = perm[i:i + a.mb]
            logp, ent, v = logp_ent(net, X[j], GM[j], TM[j], ACT[j])
            if torch.isnan(old[j]).any(): pl = -(logp * ADV[j]).mean()
            else:
                ratio = (logp - old[j]).exp()
                pl = -torch.min(ratio * ADV[j], ratio.clamp(0.8, 1.2) * ADV[j]).mean()
                stats['kl'] += (old[j] - logp).mean().item()
            vl = F.mse_loss(v, RET[j])
            loss = pl + 0.5 * vl - a.ent * ent.mean()
            opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(net.parameters(), 0.5); opt.step()
            stats['pl'] += pl.item(); stats['vl'] += vl.item(); stats['ent'] += ent.mean().item(); steps += 1
    stats = {k: round(v / steps, 4) for k, v in stats.items()}
    json.dump(net.weights(), open(os.path.join(a.out, 'policy.json'), 'w'))
    torch.save(net.state_dict(), os.path.join(a.out, 'policy.pt'))
    g = len(games); caught = sum(x['outcome'] == 'caught' for x in games); won = sum(x['outcome'] == 'won' for x in games)
    tc = [x['t'] for x in games if x['outcome'] == 'caught']
    row = dict(round=rnd, games=g, caught=round(caught / g, 3), won=round(won / g, 3), t_catch=round(float(np.mean(tc)), 1) if tc else None,
               out=round(float(np.mean([x['out'] for x in games])), 2), switch_min=round(60 * sum(x.get('switches', 0) for x in games) / max(1, sum(x['t'] for x in games)), 1), reward=round(float(sum(p[:, -2].sum() for p in parts)) / g, 3),
               decisions=n, secs=round(time.time() - t0, 1), **stats)
    if a.opp and a.side == 'monster':  # how it does against the evader alone
        ev = [x for x in games if x['style'] == 'evader']
        if ev: row['vs_evader'] = dict(n=len(ev), caught=round(sum(x['outcome'] == 'caught' for x in ev) / len(ev), 3), won=round(sum(x['outcome'] == 'won' for x in ev) / len(ev), 3))
    print(json.dumps(row), flush=True); log.write(json.dumps(row) + '\n'); log.flush()
    score = row['caught'] - row['won'] - 0.002 * (row['t_catch'] or 150) if a.side == 'monster' else row['won'] - row['caught']
    if score > best and rnd > 0:
        best = score
        json.dump(net.weights(), open(os.path.join(a.out, 'best.json'), 'w')); torch.save(net.state_dict(), os.path.join(a.out, 'best.pt'))
