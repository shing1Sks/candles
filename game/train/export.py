"""Export the main model for playing: two ONNX graphs, one per stage, batch of one.
  stage_a.onnx: cur [1, S], persona [1, P]            -> tokens [1, n + 1, d], giant [1, G]   (the monster decides)
  stage_b.onnx: tokens, ki [1, K], gi [1, Gi]          -> world [1, W], events [1, E]          (the world moves)
With --play: play_a.onnx takes the tile ids round the movers as an input (the game computes them), play_b.onnx is
stage B, and play.json says how to turn `world` into the next state (src/model/decode.js).
`world` is every piece's head output, concatenated in schema order (see heads.json written next to them).

usage: python train/export.py --schema DATA/schema.json --size M [--ckpt runs/x/best.pt] --out OUTDIR
"""
import argparse, json, os, sys
import torch
import torch.nn as nn

sys.path.insert(0, os.path.dirname(__file__))
from data import Schema
from model import WorldModel, NB, SCALE, predict_next, GI_STICK, GI_AIM, gi_targets
from train import SIZES


class StageA(nn.Module):
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, cur, persona):
        m, B = s.m, cur.shape[0]
        a = torch.cat([m.tokens(cur), m.persona(persona).unsqueeze(1), m.qa.expand(B, 1, -1)], 1)
        for blk in m.blocks_a: a = blk(a)
        a = m.norm_a(a)
        return a[:, :-1], m.giant(a[:, -1])


class StageB(nn.Module):
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, toks, ki, gi):
        m, B = s.m, toks.shape[0]
        b = torch.cat([toks, m.ki(ki).unsqueeze(1), m.gi(gi).unsqueeze(1), m.qb.expand(B, 1, -1)], 1)
        for blk in m.blocks_b: b = blk(b)
        b = m.norm_b(b)
        outs = [m.out[k['kind']](b[:, k['first']: k['first'] + k['count']]).flatten(1) for k in m.S.kinds]
        return torch.cat(outs, 1), m.events(b[:, -1])


class PlayA(nn.Module):
    """stage A for playing: the tile patches come in as float ids (the game computes them), looked up by a one-hot product"""
    def __init__(s, m): super().__init__(); s.m = m
    def forward(s, cur, persona, ids):
        m, B = s.m, cur.shape[0]
        a = torch.cat([m.tokens(cur, ids), m.persona(persona).unsqueeze(1), m.qa.expand(B, 1, -1)], 1)
        for blk in m.blocks_a: a = blk(a)
        a = m.norm_a(a)
        return a[:, :-1], m.giant(a[:, -1])


class Play(nn.Module):
    """the whole tick in one graph (one run, one readback: on WebGPU each run costs ~20 ms however small):
    stage A, the giant's buttons decided in the graph, stage B.
    gnoise [1, 4*21 + 2*32] Gumbel noise for its sticks and aims, gtemp [1] (0: the likeliest bin, 1: a draw),
    gu [1, 7] uniform for its buttons (0.5: pressed when likelier than not)
    -> gi [1, 13] the giant's input as recorded, world [1, W] the pieces' head outputs, events [1, E] odds"""
    def __init__(s, m):
        super().__init__(); s.m = m
        s.register_buffer('stick_v', torch.linspace(-1, 1, GI_STICK))
        s.register_buffer('aim_v', torch.linspace(-0.1, 1.1, GI_AIM))

    def forward(s, cur, persona, ids, ki, gnoise, gtemp, gu):
        m, B = s.m, cur.shape[0]
        a = torch.cat([m.tokens(cur, ids), m.persona(persona).unsqueeze(1), m.qa.expand(B, 1, -1)], 1)
        for blk in m.blocks_a: a = blk(a)
        a = m.norm_a(a)
        g = m.giant(a[:, -1])
        ns, na = 4 * GI_STICK, 2 * GI_AIM
        z = g[:, :ns].reshape(B, 4, GI_STICK) + gnoise[:, :ns].reshape(B, 4, GI_STICK) * gtemp
        st = ((z == z.amax(-1, keepdim=True)).float() * s.stick_v).sum(-1)  # the max by equality: no integer ops
        z = g[:, ns: ns + na].reshape(B, 2, GI_AIM) + gnoise[:, ns:].reshape(B, 2, GI_AIM) * gtemp
        am = ((z == z.amax(-1, keepdim=True)).float() * s.aim_v).sum(-1)
        bt = (torch.sigmoid(g[:, ns + na:]) > gu).float()
        gi = torch.cat([st[:, :2], bt, am, st[:, 2:]], 1)  # mx mz | run lunge use bash yell light reach | ax az | lx lz
        b = torch.cat([a[:, :-1], m.ki(ki).unsqueeze(1), m.gi(gi).unsqueeze(1), m.qb.expand(B, 1, -1)], 1)
        for blk in m.blocks_b: b = blk(b)
        b = m.norm_b(b)
        outs = [m.out[k['kind']](b[:, k['first']: k['first'] + k['count']]).flatten(1) for k in m.S.kinds]
        return gi, torch.cat(outs, 1), m.events(b[:, -1])


class Packed(nn.Module):
    """Play with one input row and one output row (ORT on WebGPU pays per tensor moved, ~4 ms each):
    x = [cur | persona | ids (225) | ki | gnoise | gtemp (1) | gu (7)] -> [gi | world | events]"""
    def __init__(s, play, sizes):
        super().__init__(); s.p, s.sizes = play, sizes

    def forward(s, x):
        parts, o = [], 0
        for n in s.sizes: parts.append(x[:, o: o + n]); o += n
        cur, persona, ids, ki, gnoise, gtemp, gu = parts
        gi, world, ev = s.p(cur, persona, ids.reshape(-1, 9, 5, 5), ki, gnoise, gtemp.reshape(-1), gu)
        return torch.cat([gi, world, ev], 1)


def export_play(m, S, out):
    """the two graphs the game runs, plus play.json: the input sizes, the pieces' head layout and the bins, so the game
    decides every number, flag and choice itself (src/model/decode.js; in the graph that took WebGPU 7x longer), and a
    check row: the head outputs for one state and the next state the trainer decodes from them"""
    cur = torch.rand(1, S.size); persona = torch.zeros(1, len(S.traits) + 6)
    ids = torch.zeros(1, 9, 5, 5)  # float tile ids: WebGPU runs integer ops on the CPU
    ki = torch.zeros(1, len(S.ki)); gi = torch.zeros(1, len(S.gi))
    A, Bm = PlayA(m).eval(), StageB(m).eval()
    with torch.no_grad():
        toks, giant = A(cur, persona, ids)
        world, ev = Bm(toks, ki, gi)
        tc = torch.rand(1, S.size)
        o = m(tc, torch.rand(1, len(S.ki)), torch.rand(1, len(S.gi)), torch.rand(1, len(S.traits) + 6))
        tw = torch.cat([o['world'][k['kind']].flatten(1) for k in S.kinds], 1)
        tn = predict_next(m, o, tc)
    kw = dict(opset_version=17, dynamo=False, do_constant_folding=True)
    torch.onnx.export(A, (cur, persona, ids), os.path.join(out, 'play_a.onnx'), input_names=['cur', 'persona', 'ids'], output_names=['tokens', 'giant'], **kw)
    torch.onnx.export(Bm, (toks, ki, gi), os.path.join(out, 'play_b.onnx'), input_names=['tokens', 'ki', 'gi'], output_names=['world', 'events'], **kw)
    feeds = (cur, persona, ids, ki, torch.zeros(1, 4 * GI_STICK + 2 * GI_AIM), torch.zeros(1), torch.full((1, 7), 0.5))
    torch.onnx.export(Play(m).eval(), feeds, os.path.join(out, 'play.onnx'), input_names=['cur', 'persona', 'ids', 'ki', 'gnoise', 'gtemp', 'gu'],
                      output_names=['gi', 'world', 'events'], **kw)
    sizes = [S.size, len(S.traits) + 6, 225, len(S.ki), 4 * GI_STICK + 2 * GI_AIM, 1, 7]
    x = torch.cat([cur, persona, ids.flatten(1), ki, torch.zeros(1, sizes[4]), torch.zeros(1, 1), torch.full((1, 7), 0.5)], 1)
    torch.onnx.export(Packed(Play(m).eval(), sizes).eval(), (x,), os.path.join(out, 'packed.onnx'), input_names=['x'], output_names=['y'], **kw)
    kinds, o = [], 0
    for k in S.kinds:
        w = len(k['num']) * NB + len(k['flag']) + sum(n for _, n in k['cat'])
        kinds.append(dict(kind=k['kind'], count=k['count'], width=k['width'], offset=k['offset'], num=k['num'], flag=k['flag'],
                          cat=[list(c) for c in k['cat']], head=w, at=o)); o += k['count'] * w
    r = lambda t: [round(float(v), 7) for v in t.flatten()]
    json.dump(dict(state=S.size, persona=len(S.traits) + 6, ki=len(S.ki), gi=len(S.gi), giant=giant.shape[1], nb=NB, scale=SCALE,
                   bins=r(m.bins), world=world.shape[1], events=ev.shape[1], tokens=list(toks.shape), kinds=kinds,
                   check=dict(cur=r(tc), world=r(tw), next=r(tn))), open(os.path.join(out, 'play.json'), 'w'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--schema', required=True); ap.add_argument('--size', default='M'); ap.add_argument('--ckpt')
    ap.add_argument('--out', required=True); ap.add_argument('--fp16', action='store_true'); ap.add_argument('--play', action='store_true')
    a = ap.parse_args()
    S = Schema(a.schema)
    d, la, lb = SIZES[a.size]
    ck = torch.load(a.ckpt, map_location='cpu') if a.ckpt else {}
    m = WorldModel(S, d, la, lb, fourier=ck.get('fourier', 0)).eval()
    if a.ckpt: m.load_state_dict(ck['model'])
    os.makedirs(a.out, exist_ok=True)
    if a.play:
        export_play(m, S, a.out)
        mb = lambda f: os.path.getsize(os.path.join(a.out, f)) / 1e6
        print(f"{a.size}: play_a {mb('play_a.onnx'):.1f} MB, play_b {mb('play_b.onnx'):.1f} MB, play {mb('play.onnx'):.1f} MB")
        return
    cur = torch.zeros(1, S.size); persona = torch.zeros(1, len(S.traits) + 6)
    ki = torch.zeros(1, len(S.ki)); gi = torch.zeros(1, len(S.gi))
    A, Bm = StageA(m), StageB(m)
    with torch.no_grad():
        toks, giant = A(cur, persona)
        world, events = Bm(toks, ki, gi)
    kw = dict(opset_version=17, dynamo=False, do_constant_folding=True)
    torch.onnx.export(A, (cur, persona), os.path.join(a.out, 'stage_a.onnx'), input_names=['cur', 'persona'], output_names=['tokens', 'giant'], **kw)
    torch.onnx.export(Bm, (toks, ki, gi), os.path.join(a.out, 'stage_b.onnx'), input_names=['tokens', 'ki', 'gi'], output_names=['world', 'events'], **kw)
    heads, o = [], 0
    for k in S.kinds:
        w = len(k['num']) * NB + len(k['flag']) + sum(n for _, n in k['cat'])
        heads.append(dict(kind=k['kind'], count=k['count'], width=w, offset=o)); o += k['count'] * w
    json.dump(dict(size=a.size, d=d, nb=NB, tokens=list(toks.shape), giant=giant.shape[1], world=world.shape[1], events=events.shape[1], heads=heads),
              open(os.path.join(a.out, 'heads.json'), 'w'), indent=1)
    mb = lambda f: os.path.getsize(os.path.join(a.out, f)) / 1e6
    print(f"{a.size}: stage_a {mb('stage_a.onnx'):.1f} MB, stage_b {mb('stage_b.onnx'):.1f} MB, world outputs {world.shape[1]}")


if __name__ == '__main__':
    main()
