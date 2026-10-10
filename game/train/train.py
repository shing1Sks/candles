"""Train the main model on a batch of recorded games.

usage: python train/train.py --data ../data/v2 --size M --out runs/M [--minutes 60 | --epochs 8] [--frac 1.0] [--bench]
Writes runs/<name>/: log.jsonl (one line per report), heartbeat (time and step, every report), ckpt.pt (resumable),
best.pt (best check-set loss), summary.json (final check and exam metrics).
"""
import argparse, json, math, os, sys, time
import torch
import torch.nn.functional as F

sys.path.insert(0, os.path.dirname(__file__))
from data import Data
from model import WorldModel, losses, predict_next, param_count, split_head, piece, gi_targets, GI_STICK, GI_AIM, GI_BUTTONS

SIZES = {  # width, stage A layers, stage B layers
    'T': (64, 1, 1), 'S': (256, 4, 4), 'M': (384, 6, 6), 'L': (512, 8, 8), 'XL': (768, 6, 6),
}
LOSS_W = dict(num=1.0, flag=1.0, cat=1.0, events=4.0, giant=1.0)


def cosine(step, total, warm, peak):
    if step < warm: return peak * (step + 1) / warm
    p = min(1.0, (step - warm) / max(1, total - warm))
    return peak * (0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * p)))


@torch.no_grad()
def evaluate(model, data, split, batches=40, B=1024):
    model.eval()
    S, M = data.schema, data.schema.map
    W, H = M['w'], M['h']
    blocked_types = torch.tensor([M['tileTypes'].index(t) for t in ('WALL', 'LOW', 'TALL')], device=data.out)
    acc = dict(loss=0.0, num=0.0, flag=0.0, cat=0.0, events=0.0, giant=0.0)
    kid_err, mon_err, clip, n = [], [], 0, 0
    out_tp = out_fp = out_fn = 0
    ev_tp = torch.zeros(len(S.events), device=data.out); ev_fp = torch.zeros_like(ev_tp); ev_fn = torch.zeros_like(ev_tp)
    btn_tp = torch.zeros(7, device=data.out); btn_fp = torch.zeros_like(btn_tp); btn_fn = torch.zeros_like(btn_tp)
    btn_p = torch.zeros_like(btn_tp); btn_y = torch.zeros_like(btn_tp)  # how often it presses each, predicted and real
    stick_ok = 0.0
    for _ in range(batches):
        b = data.batch(split, B)
        with torch.autocast('cuda', dtype=torch.bfloat16, enabled=b['cur'].is_cuda):
            out = model(b['cur'], b['ki'], b['gi'], b['persona'])
        L = losses(model, out, b)
        for k in L: acc[k] += L[k].mean().item()
        acc['loss'] += sum(LOSS_W[k] * L[k].mean().item() for k in L)
        pred = predict_next(model, out, b['cur'])
        for kind, errs in (('kid', kid_err), ('monster', mon_err)):
            px, pz = pred[:, S.field(kind, 'x')] * W, pred[:, S.field(kind, 'z')] * H
            ax, az = b['nxt'][:, S.field(kind, 'x')] * W, b['nxt'][:, S.field(kind, 'z')] * H
            errs.append(torch.hypot(px - ax, pz - az))
        # the kid's predicted centre inside something it cannot be in (walls, furniture, a shut door)
        kx = (pred[:, S.field('kid', 'x')] * W).floor().long().clamp(0, W - 1)
        kz = (pred[:, S.field('kid', 'z')] * H).floor().long().clamp(0, H - 1)
        t = model.tiles[kz, kx]
        d = model.door_at[kz, kx]
        shut = (d >= 0) & (pred[:, model.door_open].gather(1, d.clamp(min=0).unsqueeze(1)).squeeze(1) < 0.5)
        clip += ((t.unsqueeze(1) == blocked_types).any(1) | shut).sum().item()
        n += B
        # candles going out
        lit = [S.field('candle', 'lit', i) for i in range(6)]
        was, now, said = b['cur'][:, lit] > 0.5, b['nxt'][:, lit] > 0.5, pred[:, lit] > 0.5
        out_tp += (was & ~now & ~said).sum().item(); out_fp += (was & now & ~said).sum().item(); out_fn += (was & ~now & said).sum().item()
        e = torch.sigmoid(out['events'].float()) > 0.5; y = b['ev'] > 0.5
        ev_tp += (e & y).sum(0); ev_fp += (e & ~y).sum(0); ev_fn += (~e & y).sum(0)
        g = out['giant'].float(); stick, _, buttons = gi_targets(b['gi'])
        pp = torch.sigmoid(g[:, 4 * GI_STICK + 2 * GI_AIM:]); pb = pp > 0.5; yb = buttons > 0.5
        btn_p += pp.sum(0); btn_y += yb.float().sum(0)
        btn_tp += (pb & yb).sum(0); btn_fp += (pb & ~yb).sum(0); btn_fn += (~pb & yb).sum(0)
        stick_ok += (g[:, :GI_STICK].argmax(1) == stick[:, 0]).float().mean().item()
    model.train()
    f1 = lambda tp, fp, fn: (2 * tp / max(1e-9, 2 * tp + fp + fn))
    kid_err, mon_err = torch.cat(kid_err), torch.cat(mon_err)
    seen = (ev_tp + ev_fn) >= 10
    ev_f1 = (2 * ev_tp / (2 * ev_tp + ev_fp + ev_fn).clamp_min(1e-9))[seen]
    res = {k: v / batches for k, v in acc.items()}
    res.update(kid_err_mm=kid_err.mean().item() * 1000, kid_err_p99_mm=kid_err.quantile(0.99).item() * 1000,
               monster_err_mm=mon_err.mean().item() * 1000, wall_clip_pct=100 * clip / n,
               candle_out_f1=f1(out_tp, out_fp, out_fn), events_f1=ev_f1.mean().item() if len(ev_f1) else 0.0,
               giant_stick_acc=stick_ok / batches,
               giant_buttons_f1={name: round(f1(btn_tp[i].item(), btn_fp[i].item(), btn_fn[i].item()), 3)
                                 for i, name in enumerate(GI_BUTTONS)},
               # rare buttons are pressed on hidden beliefs: the model should press them as often, if not at the same moments
               giant_buttons_rate={name: [round(btn_p[i].item() / n, 4), round(btn_y[i].item() / n, 4)] for i, name in enumerate(GI_BUTTONS)})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True); ap.add_argument('--size', default='S'); ap.add_argument('--out', required=True)
    ap.add_argument('--minutes', type=float, default=0); ap.add_argument('--epochs', type=float, default=0)
    ap.add_argument('--frac', type=float, default=1.0); ap.add_argument('--batch', type=int, default=1024)
    ap.add_argument('--lr', type=float, default=0); ap.add_argument('--bench', action='store_true')
    ap.add_argument('--report', type=int, default=200); ap.add_argument('--evalevery', type=int, default=2000)
    ap.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    ap.add_argument('--data_device', help='keep the rows here (cpu: data bigger than the GPU), batches go to --device')
    # rollout training: from this share of the schedule on, every batch is two steps in a row and the second starts
    # from the model's own guess of the first (drawn, as the game draws), so it learns to carry on from its own errors
    ap.add_argument('--rollout_from', type=float, default=1.0)
    ap.add_argument('--init', help='start from these weights (a best.pt or ckpt.pt), with a fresh optimizer')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    torch.backends.cuda.matmul.allow_tf32 = True
    t0 = time.time()
    data = Data(a.data, a.data_device or a.device, frac=a.frac, out=a.device)
    log = open(os.path.join(a.out, 'log.jsonl'), 'a')
    def say(**kw):
        kw['time'] = round(time.time() - t0, 1)
        line = json.dumps(kw); print(line, flush=True); log.write(line + '\n'); log.flush()
        with open(os.path.join(a.out, 'heartbeat'), 'w') as f: f.write(f"{time.time():.0f} {kw.get('step', -1)}\n")
    d, la, lb = SIZES[a.size]
    model = WorldModel(data.schema, d, la, lb).to(a.device)
    peak = a.lr or (6e-4 * (256 / d) ** 0.5)
    opt = torch.optim.AdamW(model.parameters(), lr=peak, betas=(0.9, 0.95), weight_decay=0.05)
    say(event='start', size=a.size, params=param_count(model), sizes=data.sizes(), load_s=round(time.time() - t0, 1), device=a.device, frac=a.frac)
    train_rows = data.sizes()['train']
    total = int(a.epochs * train_rows / a.batch) if a.epochs else 10 ** 9
    if a.bench: total = 60
    ck = os.path.join(a.out, 'ckpt.pt')
    step, best = 0, float('inf')
    if a.init and not os.path.exists(ck):
        model.load_state_dict(torch.load(a.init, map_location=a.device)['model']); say(event='init', path=a.init)
    if os.path.exists(ck) and not a.bench:
        st = torch.load(ck, map_location=a.device)
        model.load_state_dict(st['model']); opt.load_state_dict(st['opt']); step, best = st['step'], st['best']
        say(event='resume', step=step)
    deadline = time.time() + a.minutes * 60 if a.minutes else float('inf')
    if a.minutes and not a.epochs: total = None  # time-limited: the schedule is set from measured speed after warmup
    model.train()
    tick, seen = time.time(), 0
    while True:
        if total is None and step == 300:
            rate = seen / (time.time() - tick)
            total = int(rate * max(60, deadline - time.time()) / a.batch) + step
            say(event='schedule', steps=total, samples_per_s=round(rate))
        sched_total = total or 10 ** 9
        if step >= sched_total or time.time() > deadline: break
        for g in opt.param_groups: g['lr'] = cosine(step, sched_total, 500, peak)
        rolling = step >= a.rollout_from * sched_total
        steps = data.batch2('train', a.batch // 2) if rolling else [data.batch('train', a.batch)]
        loss, prev = 0.0, None
        for b in steps:
            if prev is not None:  # the second step starts where the model said the first would end
                b['cur'] = predict_next(model, prev[0], prev[1], sample=True)
            with torch.autocast('cuda', dtype=torch.bfloat16, enabled=a.device.startswith('cuda')):
                out = model(b['cur'], b['ki'], b['gi'], b['persona'])
            L = losses(model, out, b)
            per = sum(LOSS_W[k] * L[k] for k in L)
            loss = loss + (per * b['w']).sum() / b['w'].sum() / len(steps)
            prev = ({'world': {k: v.detach() for k, v in out['world'].items()}}, b['cur'])
        if not torch.isfinite(loss):
            say(event='nan', step=step); raise SystemExit('loss is not finite')
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        step += 1; seen += a.batch
        if step % a.report == 0:
            el = time.time() - tick
            say(event='train', step=step, loss=round(loss.item(), 4), rollout=rolling, **{k: round(v.mean().item(), 4) for k, v in L.items()},
                lr=round(opt.param_groups[0]['lr'], 6), samples_per_s=round(seen / el), epoch=round(step * a.batch / train_rows, 3))
        if a.bench and step == total:
            torch.cuda.synchronize() if a.device.startswith('cuda') else None
            say(event='bench', size=a.size, params=param_count(model), samples_per_s=round(seen / (time.time() - tick)))
            return
        if step % a.evalevery == 0:
            r = evaluate(model, data, 'check', batches=20)
            say(event='check', step=step, **r)
            if r['loss'] < best:
                best = r['loss']; torch.save({'model': model.state_dict(), 'size': a.size, 'step': step}, os.path.join(a.out, 'best.pt'))
            torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'step': step, 'best': best, 'size': a.size}, ck)
    r = evaluate(model, data, 'check', batches=40)
    if r['loss'] < best:
        best = r['loss']; torch.save({'model': model.state_dict(), 'size': a.size, 'step': step}, os.path.join(a.out, 'best.pt'))
    torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'step': step, 'best': best, 'size': a.size}, ck)
    st = torch.load(os.path.join(a.out, 'best.pt'), map_location=a.device)
    model.load_state_dict(st['model'])
    exam = evaluate(model, data, 'exam', batches=60)
    summary = dict(size=a.size, params=param_count(model), steps=step, frac=a.frac, best_check_loss=best, check=r, exam=exam,
                   minutes=round((time.time() - t0) / 60, 1))
    json.dump(summary, open(os.path.join(a.out, 'summary.json'), 'w'), indent=1)
    say(event='done', **{k: v for k, v in summary.items() if k not in ('check', 'exam')}, exam=exam)


if __name__ == '__main__':
    main()
